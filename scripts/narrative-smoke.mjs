import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNarrativeBeatIndex } from "../src/narrativeBeats.js";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT_DIR = path.join(ROOT, "tmp", "narrative-smoke");
const VITE_PORT = Number(process.env.NARRATIVE_SMOKE_PORT || 5178);
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
  const profile = path.join(os.tmpdir(), `atelier-narrative-smoke-${Date.now()}-${process.pid}`);
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

function runPureBeatSmoke() {
  const sources = [
    {
      page: 0,
      figure: "figure.webp",
      background: "bg.webp",
      commentary: {
        beat: {
          type: "lookCard",
          label: { ja: "カードで読む", zh: "读造型卡" },
          gentlePrompt: { ja: "小さく開く", zh: "轻轻打开" },
          emphasis: "card",
        },
        character: { name: { ja: "A", zh: "A" } },
      },
    },
    {
      page: 2,
      figure: "figure.webp",
      background: "bg.webp",
      video: "runway.mp4",
      commentary: { items: [{ id: "coat" }], character: { name: { ja: "B", zh: "B" } } },
    },
  ];
  const pageToSpread = (page) => {
    if (page === 0) return { spread: 0, side: "left" };
    if (page === 2) return { spread: 1, side: "right" };
    return null;
  };
  const index = buildNarrativeBeatIndex({ spreadCount: 3, sources, pageToSpread });
  assert(index.size === 3, `expected 3 narrative beats, got ${index.size}`);
  assert(index.get(0)?.type === "lookCard", "beat metadata did not override fallback type");
  assert(index.get(0)?.prompt?.zh === "轻轻打开", "gentlePrompt metadata was not preserved");
  assert(index.get(1)?.type === "runway", "video source should fall back to runway");
  assert(index.get(2)?.type === "read", "empty spread should fall back to read");
  return [...index.values()].map((event) => ({ spread: event.spread, type: event.type }));
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

async function runInteractiveSmoke(browserPort) {
  const deep = await preparePage(browserPort, {
    url: `${APP_URL}?spread=3&item=0&lang=zh&narrative-smoke=deep`,
  });
  try {
    return await deep.page.evaluate(
      `(
        async () => {
          const scene = window.__magazineScene;
          const stepStandees = (frames = 150) => {
            for (let i = 0; i < frames; i += 1) scene.updateStandees(1 / 60, scene.elapsedTime + i / 60);
          };

          const beats = [...scene.narrativeBeatIndex().values()];
          const beatCount = beats.length;
          const beatTypes = beats.map((event) => event.type);
          const exactlyOneBeatPerSpread = beatCount === scene.leafCount() + 1 && beats.every((event) => !!event?.id);
          const deepLink = {
            state: scene.state,
            spreadIndex: scene.spreadIndex,
            locale: scene.locale,
            lookCard: !!scene.lookCard,
            activeItem: scene.lookCard?.item ?? null,
          };

          scene.closeLookCard();
          const lookCardOpen = scene.openLookCard(3, 0);
          const lookCardState = {
            open: lookCardOpen && !!scene.lookCard,
            spread: scene.lookCard?.spread ?? null,
            item: scene.lookCard?.item ?? null,
            persisted: scene.prefs.lastSpread === 3,
          };
          scene.closeLookCard();

          scene.toggleGallery();
          const galleryState = {
            open: !!scene.gallery,
            realImgPages: document.querySelectorAll(".gallery-page img").length,
            hasCanvasFallback: !!document.querySelector(".gallery-page canvas"),
          };
          scene.closeGallery();
          const galleryLanding = {
            galleryClosed: !scene.gallery,
            state: scene.state,
            spreadIndex: scene.spreadIndex,
          };

          const tourStandee = [...scene.standees.values()].find((standee) => standee.commentary);
          scene.landOnSpread(tourStandee.spread, { persist: false, snapCamera: true });
          if (tourStandee.state === "folded") scene.toggleStandee(tourStandee);
          stepStandees();
          scene.toggleTourOnCurrentSpread();
          const tourState = { open: !!scene.tour, standeeSpread: scene.tour?.standee?.spread ?? null };
          scene.endTour();

          const runwayStandee = [...scene.standees.values()].find((standee) => standee.videoUrl);
          scene.landOnSpread(runwayStandee.spread, { persist: false, snapCamera: true });
          if (runwayStandee.state === "folded") scene.toggleStandee(runwayStandee);
          stepStandees();
          scene.startShow(runwayStandee);
          const runwayState = { open: !!scene.show, inShowClass: scene.container.classList.contains("in-show") };
          scene.endShow(true);

          scene.syncNarrativeBeat(true);
          const hudState = {
            beatVisible: !scene.hudBeat.hidden,
            primaryEvent: scene.container.dataset.primaryEvent,
            primaryButtons: [...document.querySelectorAll(".hud-read.is-primary,.hud-tour.is-primary,.hud-card.is-primary")].length,
            discoverySeen: [...scene.discoverySeen].sort(),
          };

          return {
            exactlyOneBeatPerSpread,
            beatCount,
            beatTypes,
            deepLink,
            lookCardState,
            galleryState,
            galleryLanding,
            tourState,
            runwayState,
            hudState,
          };
        }
      )()`,
      60000,
    );
  } finally {
    await closeTarget(browserPort, deep.targetId);
    await deep.page.close();
  }
}

async function runReducedMotionSmoke(browserPort) {
  const rm = await preparePage(browserPort, {
    url: `${APP_URL}?spread=1&narrative-smoke=reduced`,
    reducedMotion: true,
  });
  try {
    return await rm.page.evaluate(
      `(() => {
        const scene = window.__magazineScene;
        scene.landOnSpread(1, { persist: false, snapCamera: true });
        scene.syncNarrativeBeat(true);
        return {
          reducedMotion: scene.reducedMotion,
          grainEnabled: scene.grainPass.enabled,
          discoveryClassCount: document.querySelectorAll(".is-discovery").length,
          beatVisible: !scene.hudBeat.hidden,
        };
      })()`,
      30000,
    );
  } finally {
    await closeTarget(browserPort, rm.targetId);
    await rm.page.close();
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const pure = runPureBeatSmoke();
  const vite = await startVite();
  const browser = await startBrowser();
  let interactive;
  let reducedMotion;

  try {
    interactive = await runInteractiveSmoke(browser.port);
    reducedMotion = await runReducedMotionSmoke(browser.port);
  } finally {
    stopChild(browser.process);
    stopChild(vite.process);
  }

  assert(interactive.exactlyOneBeatPerSpread, "not every spread resolved exactly one primary event");
  assert(interactive.deepLink.state === "open" && interactive.deepLink.spreadIndex === 3, "deep link did not land on spread 3");
  assert(interactive.deepLink.locale === "zh" && interactive.deepLink.lookCard, "deep link item card did not open in zh");
  assert(interactive.lookCardState.open && interactive.lookCardState.item === 0, "look-card did not open on item 0");
  assert(interactive.galleryState.open && interactive.galleryState.realImgPages > 0, "gallery did not use real img pages");
  assert(!interactive.galleryState.hasCanvasFallback, "gallery regressed to canvas pages");
  assert(interactive.galleryLanding.galleryClosed && interactive.galleryLanding.state === "open", "gallery landing did not close cleanly");
  assert(interactive.tourState.open, "guided tour did not start on a risen commentary standee");
  assert(interactive.runwayState.open && interactive.runwayState.inShowClass, "runway show did not start");
  assert(interactive.hudState.beatVisible && interactive.hudState.primaryEvent, "primary-event HUD did not render");
  assert(reducedMotion.reducedMotion && reducedMotion.grainEnabled === false, "reduced-motion rendering guard regressed");
  assert(reducedMotion.discoveryClassCount === 0, "reduced-motion received animated discovery emphasis");

  const summary = {
    appUrl: APP_URL,
    vite: vite.reused ? "reused" : "started",
    browser: browser.browserPath,
    pure,
    interactive,
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
