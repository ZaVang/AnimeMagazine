// Voice pipeline smoke (Sprint 18, S18-VERIFY-1).
//
// Drives the REAL voice path in a real Chrome via CDP, with a SYNTHETIC
// AudioBuffer generated in-page — no committed audio binary. Asserts:
//   - gesture unlock resumes the AudioContext (autoplay-safe),
//   - a caption shows when a line starts and clears after it ends,
//   - the analyser produces a non-zero RMS while a voice plays,
//   - the mouth toggles iff the line carries a `mouth` cell mapping,
//   - a mid-line page turn stops the audio and clears the caption.
//
// Pitfalls respected:
//   - preview_screenshot times out on this rAF canvas → we drive
//     window.__magazineScene via CDP Runtime.evaluate, never screenshots.
//   - CDP smoke must explicitly close the target + kill child processes and
//     process.exit, or it hangs after assertions write out (S14-VERIFY-1).
//
// Shares the CDP/Vite/Chrome harness shape with narrative-smoke.mjs.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT_DIR = path.join(ROOT, "tmp", "voice-smoke");
const VITE_PORT = Number(process.env.VOICE_SMOKE_PORT || 5178);
const HOST = "127.0.0.1";
const APP_URL = `http://${HOST}:${VITE_PORT}/`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? 10000;
    const requestOptions = { ...options };
    delete requestOptions.timeoutMs;
    const req = http.request(url, requestOptions, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`HTTP timeout after ${timeoutMs}ms: ${url}`));
    });
    req.on("error", reject);
    req.end();
  });
}

async function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await requestText(url);
      if (response.status >= 200 && response.status < 500) return response;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("Unable to allocate a local port"));
      });
    });
    server.on("error", reject);
  });
}

async function startVite() {
  try {
    await waitForHttp(APP_URL, 800);
    return { reused: true, process: null, logs: [`Reused existing Vite server at ${APP_URL}`] };
  } catch {
    // Start our own server below.
  }

  const viteBin = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteBin)) throw new Error(`Missing ${viteBin}; run npm install first.`);

  const logs = [];
  const child = spawn(
    process.execPath,
    [viteBin, "--host", HOST, "--port", String(VITE_PORT), "--strictPort"],
    {
      cwd: ROOT,
      env: { ...process.env, BROWSER: "none" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => logs.push(chunk.trimEnd()));
  child.stderr.on("data", (chunk) => logs.push(chunk.trimEnd()));
  child.on("exit", (code) => {
    if (code !== null && code !== 0) logs.push(`Vite exited with code ${code}`);
  });

  await waitForHttp(APP_URL, 30000);
  return { reused: false, process: child, logs };
}

function browserCandidates() {
  const envCandidates = [process.env.CHROME_PATH, process.env.EDGE_PATH].filter(Boolean);
  if (process.platform !== "win32") {
    return [...envCandidates, "google-chrome", "chromium", "chromium-browser", "microsoft-edge"];
  }
  return [
    ...envCandidates,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
}

function findBrowser() {
  const found = browserCandidates().find((candidate) => {
    if (!candidate) return false;
    return candidate.includes(path.sep) || candidate.includes(":") ? existsSync(candidate) : true;
  });
  if (!found) throw new Error("Could not find Chrome or Edge. Set CHROME_PATH or EDGE_PATH.");
  return found;
}

async function startBrowser() {
  const browserPath = findBrowser();
  const port = await freePort();
  const profile = path.join(os.tmpdir(), `atelier-voice-smoke-${Date.now()}-${process.pid}`);
  await fs.mkdir(profile, { recursive: true });
  const child = spawn(
    browserPath,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-dev-shm-usage",
      // a synthetic AudioContext needs an output device that never blocks; the
      // fake media stack keeps decode/playback deterministic in headless.
      "--autoplay-policy=no-user-gesture-required",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
  );
  await waitForHttp(`http://${HOST}:${port}/json/version`, 30000);
  return { process: child, port, profile, browserPath };
}

function stopChild(child) {
  if (!child) return;
  try {
    child.kill("SIGKILL");
  } catch {
    // Best effort.
  }
  child.stdout?.destroy?.();
  child.stderr?.destroy?.();
  child.stdin?.destroy?.();
  child.unref?.();
}

class CdpPage {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out opening ${this.wsUrl}`)), 10000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("WebSocket error"));
      }, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      void this.handleMessage(event.data);
    });
  }

  async handleMessage(data) {
    const text = typeof data === "string" ? data : Buffer.from(await data.arrayBuffer()).toString("utf8");
    const message = JSON.parse(text);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, timer } = this.pending.get(message.id);
      clearTimeout(timer);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message}: ${message.error.data ?? ""}`));
      else resolve(message.result ?? {});
      return;
    }
    if (message.method) {
      for (const waiter of [...this.waiters]) {
        if (waiter.method === message.method && (!waiter.predicate || waiter.predicate(message.params))) {
          clearTimeout(waiter.timer);
          this.waiters.splice(this.waiters.indexOf(waiter), 1);
          waiter.resolve(message.params ?? {});
        }
      }
    }
  }

  send(method, params = {}, timeoutMs = 15000) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(payload);
    });
  }

  waitForEvent(method, predicate = null, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter.resolve !== resolve);
        reject(new Error(`Timed out waiting for CDP event ${method}`));
      }, timeoutMs);
      this.waiters.push({ method, predicate, resolve, timer });
    });
  }

  async evaluate(expression, timeoutMs = 15000) {
    const result = await this.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true, userGesture: true },
      timeoutMs,
    );
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.text || result.exceptionDetails.exception?.description || "Runtime exception";
      throw new Error(text);
    }
    return result.result?.value;
  }

  async close() {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1000);
      this.ws.addEventListener("close", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      try {
        this.ws.close();
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });
  }
}

async function newPage(browserPort) {
  const response = await requestText(`http://${HOST}:${browserPort}/json/new`, { method: "PUT" });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Could not create Chrome target: HTTP ${response.status} ${response.body}`);
  }
  const target = JSON.parse(response.body);
  const page = new CdpPage(target.webSocketDebuggerUrl);
  await page.connect();
  return { page, targetId: target.id };
}

async function closeTarget(browserPort, targetId) {
  try {
    await requestText(`http://${HOST}:${browserPort}/json/close/${targetId}`, { timeoutMs: 1200 });
  } catch {
    // Best effort; browser process is also killed during cleanup.
  }
}

async function waitForExpression(page, expression, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastValue = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await page.evaluate(`Boolean(${expression})`, 5000);
    if (lastValue) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for expression: ${expression}; last=${lastValue}`);
}

async function preparePage(browserPort, { url, reducedMotion = false }) {
  const { page, targetId } = await newPage(browserPort);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 900,
    height: 700,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 900,
    screenHeight: 700,
  });
  await page.send("Emulation.setEmulatedMedia", {
    features: reducedMotion
      ? [{ name: "prefers-reduced-motion", value: "reduce" }]
      : [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  const loadEvent = page.waitForEvent("Page.loadEventFired", null, 30000).catch(() => null);
  await page.send("Page.navigate", { url });
  await loadEvent;
  await waitForExpression(page, "window.__magazineScene && window.__magazineScene.assetsReady", 60000);
  await waitForExpression(page, "(window.__magazineScene?.standees?.size ?? 0) >= 15", 60000);
  return { page, targetId };
}

// The in-page voice exercise. Returns a structured report the Node side asserts
// against. Everything runs against the REAL scene methods (playVoice / stopVoice
// / updateLipSync / setCaption); the only synthetic part is the AudioBuffer,
// pre-seeded into voiceUrlCache so decodeVoiceBuffer returns it with no fetch.
const VOICE_EXERCISE = String.raw`
(async () => {
  const scene = window.__magazineScene;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const step = (frames = 30) => { for (let i = 0; i < frames; i += 1) scene.updateLipSync(); };

  // ---- gesture unlock (autoplay-safe) --------------------------------------
  const ctxBefore = scene.audio.ctx ? scene.audio.ctx.state : "none";
  scene.startAudio();                 // first gesture path
  if (scene.audio.ctx && scene.audio.ctx.state === "suspended") {
    await scene.audio.ctx.resume().catch(() => {});
  }
  const ctxAfter = scene.audio.ctx ? scene.audio.ctx.state : "none";
  const hasVoiceGraph = !!(scene.voiceGain && scene.voiceAnalyser);

  // ---- synthesize a voice buffer (no committed binary) ---------------------
  const ctx = scene.audio.ctx;
  const sampleRate = ctx.sampleRate;
  // a long tone (4 s) so the voice is still playing while we sample the analyser
  // (a short buffer would end before the sampling window and read as silence).
  const seconds = 4;
  const buffer = ctx.createBuffer(1, Math.floor(sampleRate * seconds), sampleRate);
  const ch = buffer.getChannelData(0);
  for (let i = 0; i < ch.length; i += 1) {
    // a loud 220 Hz tone so the analyser reads a clearly non-zero RMS
    ch[i] = 0.8 * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
  }
  const FAKE_URL = "/__synthetic__/voice-a.wav";
  scene.voiceUrlCache.set(FAKE_URL, buffer);

  // ---- caption + voice + lip sync (WITH mouth mapping) ---------------------
  // a card to drive lip sync on (first risen card, or just any standee card).
  const standee = [...scene.standees.values()].find((s) => s.card) || null;
  const card = standee ? standee.card : null;
  const cellBefore = card ? card.cell : null;
  const lineWithMouth = {
    voiceUrl: FAKE_URL,
    mouth: { closed: 0, open: 1 },
    text: { ja: "声のテスト", zh: "语音测试" },
  };
  scene.playVoice(lineWithMouth, lineWithMouth.text, card, { dedupKey: "smoke-a" });

  // caption shows immediately (independent of async decode)
  const captionOnAtStart = scene.hudCaption.classList.contains("is-on");

  // wait for the async decode→start, then sample RMS over several frames.
  let maxRms = 0;
  let sourceStarted = false;
  for (let i = 0; i < 120 && !sourceStarted; i += 1) {
    await sleep(16);
    sourceStarted = !!(scene.voice && scene.voice.source);
  }
  const diag = {
    ctxState: scene.audio.ctx ? scene.audio.ctx.state : "none",
    hasVoiceSession: !!scene.voice,
    hasVoiceGain: !!scene.voiceGain,
    cacheHasUrl: scene.voiceUrlCache.has(FAKE_URL),
    cachedIsBuffer:
      scene.voiceUrlCache.get(FAKE_URL) &&
      typeof scene.voiceUrlCache.get(FAKE_URL).getChannelData === "function",
  };
  let rawSpread = 0;
  // The mouth toggles open/closed each frame from the instantaneous RMS, so we
  // track whether the OPEN cell was ever written during the window (capturing
  // card.cell once at the end is racy — the last sample may be a closed frame).
  let sawOpenCell = false;
  let sawClosedCell = false;
  let mouthEverOpened = false;
  for (let i = 0; i < 80; i += 1) {
    const rms = scene.updateLipSync();
    if (rms > maxRms) maxRms = rms;
    if (scene.voice && scene.voice.mouth && scene.voice.mouth.lastOpen === true) {
      mouthEverOpened = true;
    }
    if (card && card.cell === 1) sawOpenCell = true;
    if (card && card.cell === 0) sawClosedCell = true;
    // also inspect the raw analyser bytes to tell "silent graph" from "tiny RMS"
    if (scene.voiceAnalyser && scene.voiceFreqData) {
      scene.voiceAnalyser.getByteTimeDomainData(scene.voiceFreqData);
      let lo = 255;
      let hi = 0;
      for (let j = 0; j < scene.voiceFreqData.length; j += 1) {
        const v = scene.voiceFreqData[j];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo > rawSpread) rawSpread = hi - lo;
    }
    await sleep(8);
  }
  diag.rawByteSpread = rawSpread;
  diag.ctxTime = scene.audio.ctx ? scene.audio.ctx.currentTime : -1;
  diag.sawOpenCell = sawOpenCell;
  diag.sawClosedCell = sawClosedCell;
  // The mouth read as "open" at least once (RMS crossed the threshold and the
  // open mapping was applied). writeExpressionUv rewrites the card's mouth UVs
  // transiently without touching card.cell (the expression cell), so the open
  // state is read from mouth.lastOpen, not from card.cell.
  const mouthToggled = mouthEverOpened;

  // ---- mid-line page turn stops audio + clears caption ---------------------
  // land on spread 0 so a forward turn is always available, then re-arm a fresh
  // voice and interrupt it mid-line with a real page turn.
  scene.landOnSpread(0, { persist: false, snapCamera: true });
  scene.voiceUrlCache.set(FAKE_URL, buffer);
  scene.playVoice(lineWithMouth, lineWithMouth.text, card, { dedupKey: "smoke-b" });
  for (let i = 0; i < 60 && !(scene.voice && scene.voice.source); i += 1) await sleep(16);
  const voicePlayingBeforeTurn = !!(scene.voice && scene.voice.source);
  const turnDir = scene.canTurnForward() ? 1 : -1;
  scene.beginTurn(turnDir, "auto");    // a real page turn tears captions down
  const voiceAfterTurn = scene.voice;  // should be null
  const captionAfterTurn = scene.hudCaption.classList.contains("is-on");

  // ---- no-mouth line → subtitle only, no forced mouth flicker --------------
  if (card) scene.writeExpressionUv(card, card.cell); // reset to expression cell
  const cellBeforeNoMouth = card ? card.cell : null;
  const lineNoMouth = {
    voiceUrl: FAKE_URL,
    text: { ja: "口パクなし", zh: "无口型" },
  };
  scene.voiceUrlCache.set(FAKE_URL, buffer);
  scene.playVoice(lineNoMouth, lineNoMouth.text, card, { dedupKey: "smoke-c" });
  for (let i = 0; i < 60 && !(scene.voice && scene.voice.source); i += 1) await sleep(16);
  let noMouthToggled = false;
  for (let i = 0; i < 30; i += 1) {
    scene.updateLipSync();
    if (scene.voice && scene.voice.mouth) noMouthToggled = true; // mapping must be null
    await sleep(8);
  }
  const cellAfterNoMouth = card ? card.cell : null;
  scene.stopVoice();

  // ---- caption fades after a line ends --------------------------------------
  // a very short buffer so onVoiceEnded fires quickly, then the fade timer runs.
  const shortBuf = ctx.createBuffer(1, Math.floor(sampleRate * 0.06), sampleRate);
  const sch = shortBuf.getChannelData(0);
  for (let i = 0; i < sch.length; i += 1) sch[i] = 0.6 * Math.sin((2 * Math.PI * 200 * i) / sampleRate);
  const SHORT_URL = "/__synthetic__/voice-short.wav";
  scene.voiceUrlCache.set(SHORT_URL, shortBuf);
  const shortLine = { voiceUrl: SHORT_URL, text: { ja: "短い", zh: "短" } };
  scene.playVoice(shortLine, shortLine.text, null, { dedupKey: "smoke-d" });
  const captionOnShort = scene.hudCaption.classList.contains("is-on");
  // wait for the buffer to end (60ms) + the caption fade window (~900ms) + slack
  await sleep(1400);
  const captionAfterFade = scene.hudCaption.classList.contains("is-on");
  const fadeTimerCleared = scene.captionFadeTimer === null;

  return {
    ctxBefore,
    ctxAfter,
    hasVoiceGraph,
    captionOnAtStart,
    sourceStarted,
    diag,
    maxRms,
    mouthToggled,
    cellBefore,
    voicePlayingBeforeTurn,
    voiceClearedAfterTurn: voiceAfterTurn === null,
    captionAfterTurn,
    noMouthMappingPresent: noMouthToggled,
    cellBeforeNoMouth,
    cellAfterNoMouth,
    captionOnShort,
    captionAfterFade,
    fadeTimerCleared,
  };
})()
`;

async function runVoiceSmoke(browserPort) {
  const prepared = await preparePage(browserPort, { url: `${APP_URL}?spread=1&voice-smoke=1` });
  try {
    // Land on a spread with a commentary standee and raise it so a card exists.
    await prepared.page.evaluate(
      `(() => {
        const scene = window.__magazineScene;
        const standee = [...scene.standees.values()].find((s) => s.commentary && s.card)
          || [...scene.standees.values()].find((s) => s.card);
        if (standee) {
          scene.landOnSpread(standee.spread, { persist: false, snapCamera: true });
          if (standee.state === "folded") scene.toggleStandee(standee);
          for (let i = 0; i < 200; i += 1) scene.updateStandees(1 / 60, scene.elapsedTime + i / 60);
        }
        return true;
      })()`,
      20000,
    );
    return await prepared.page.evaluate(VOICE_EXERCISE, 60000);
  } finally {
    await closeTarget(browserPort, prepared.targetId);
    await prepared.page.close();
  }
}

// Reduced-motion: audio still plays + RMS non-zero, but the mouth never toggles.
async function runReducedMotionSmoke(browserPort) {
  const prepared = await preparePage(browserPort, {
    url: `${APP_URL}?spread=1&voice-smoke=rm`,
    reducedMotion: true,
  });
  try {
    await prepared.page.evaluate(
      `(() => {
        const scene = window.__magazineScene;
        const standee = [...scene.standees.values()].find((s) => s.card);
        if (standee) {
          scene.landOnSpread(standee.spread, { persist: false, snapCamera: true });
          if (standee.state === "folded") scene.toggleStandee(standee);
          for (let i = 0; i < 200; i += 1) scene.updateStandees(1 / 60, scene.elapsedTime + i / 60);
        }
        return true;
      })()`,
      20000,
    );
    return await prepared.page.evaluate(
      String.raw`
      (async () => {
        const scene = window.__magazineScene;
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        scene.startAudio();
        if (scene.audio.ctx && scene.audio.ctx.state === "suspended") {
          await scene.audio.ctx.resume().catch(() => {});
        }
        const ctx = scene.audio.ctx;
        // a long tone so the voice is still playing through the sampling window
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 4), ctx.sampleRate);
        const ch = buffer.getChannelData(0);
        for (let i = 0; i < ch.length; i += 1) ch[i] = 0.8 * Math.sin((2 * Math.PI * 220 * i) / ctx.sampleRate);
        const URL = "/__synthetic__/voice-rm.wav";
        scene.voiceUrlCache.set(URL, buffer);
        const standee = [...scene.standees.values()].find((s) => s.card) || null;
        const card = standee ? standee.card : null;
        const cellBefore = card ? card.cell : null;
        const line = { voiceUrl: URL, mouth: { closed: 0, open: 1 }, text: { ja: "RM", zh: "RM" } };
        scene.playVoice(line, line.text, card, { dedupKey: "smoke-rm" });
        for (let i = 0; i < 60 && !(scene.voice && scene.voice.source); i += 1) await sleep(16);
        let maxRms = 0;
        for (let i = 0; i < 40; i += 1) {
          const rms = scene.updateLipSync();
          if (rms > maxRms) maxRms = rms;
          await sleep(8);
        }
        const cellAfter = card ? card.cell : null;
        const mouthToggled = !!(scene.voice && scene.voice.mouth && scene.voice.mouth.lastOpen === true);
        scene.stopVoice();
        return {
          reducedMotion: scene.reducedMotion,
          audioPlayed: maxRms > 0,
          maxRms,
          cellUnchanged: cellBefore === cellAfter,
          mouthToggled,
        };
      })()
      `,
      40000,
    );
  } finally {
    await closeTarget(browserPort, prepared.targetId);
    await prepared.page.close();
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const vite = await startVite();
  const browser = await startBrowser();
  let voice;
  let reducedMotion;

  try {
    voice = await runVoiceSmoke(browser.port);
    reducedMotion = await runReducedMotionSmoke(browser.port);
  } finally {
    stopChild(browser.process);
    stopChild(vite.process);
  }

  // --- assertions -----------------------------------------------------------
  assert(voice.hasVoiceGraph, "voice gain/analyser graph was not built on unlock");
  assert(voice.ctxAfter === "running", `AudioContext did not resume on gesture (state=${voice.ctxAfter})`);
  assert(voice.captionOnAtStart, "caption did not show when the line started");
  assert(
    voice.sourceStarted,
    `synthetic voice buffer never started through the real path; diag=${JSON.stringify(voice.diag)}`,
  );
  assert(voice.maxRms > 0.01, `analyser produced no RMS (max=${voice.maxRms}); diag=${JSON.stringify(voice.diag)}`);
  assert(
    voice.mouthToggled,
    `mouth did not toggle for a line WITH a mouth mapping; diag=${JSON.stringify(voice.diag)}`,
  );
  assert(voice.voicePlayingBeforeTurn, "voice was not playing before the mid-line page turn");
  assert(voice.voiceClearedAfterTurn, "mid-line page turn did not stop the voice");
  assert(!voice.captionAfterTurn, "mid-line page turn did not clear the caption");
  assert(!voice.noMouthMappingPresent, "a line WITHOUT a mouth mapping got a mouth session");
  assert(
    voice.cellBeforeNoMouth === voice.cellAfterNoMouth,
    "a line without a mouth mapping forced a mouth/expression change",
  );
  assert(voice.captionOnShort, "short line caption did not show");
  assert(!voice.captionAfterFade, "caption did not fade out after the line ended");
  assert(voice.fadeTimerCleared, "caption fade timer leaked after fading");

  assert(reducedMotion.reducedMotion, "reduced-motion was not active");
  assert(reducedMotion.audioPlayed, "reduced-motion disabled the audio itself (must not)");
  assert(reducedMotion.maxRms > 0.01, "reduced-motion produced no RMS (audio should still play)");
  assert(reducedMotion.cellUnchanged, "reduced-motion still toggled the mouth cell (must freeze)");
  assert(!reducedMotion.mouthToggled, "reduced-motion still flipped mouth.lastOpen (must freeze)");

  const summary = {
    appUrl: APP_URL,
    vite: vite.reused ? "reused" : "started",
    browser: browser.browserPath,
    voice,
    reducedMotion,
  };
  const summaryPath = path.join(OUT_DIR, "summary.json");
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ...summary, summaryPath }, null, 2)}\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
