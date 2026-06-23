import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT_DIR = path.join(ROOT, "tmp", "visual-smoke");
const VITE_PORT = Number(process.env.VISUAL_SMOKE_PORT || 5178);
const HOST = "127.0.0.1";
const APP_URL = `http://${HOST}:${VITE_PORT}/`;

const VIEWPORTS = [
  { name: "desktop-1280x800", width: 1280, height: 800, dpr: 1, mobile: false, reducedMotion: false },
  { name: "mobile-375x812", width: 375, height: 812, dpr: 2, mobile: true, reducedMotion: true },
];

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
  if (!existsSync(viteBin)) {
    throw new Error(`Missing ${viteBin}; run npm install before visual smoke.`);
  }

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
  if (!found) {
    throw new Error("Could not find Chrome or Edge. Set CHROME_PATH or EDGE_PATH for visual smoke.");
  }
  return found;
}

async function startBrowser() {
  const browserPath = findBrowser();
  const port = await freePort();
  const profile = path.join(os.tmpdir(), `atelier-visual-smoke-${Date.now()}-${process.pid}`);
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

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  await waitForHttp(`http://${HOST}:${port}/json/version`, 30000);
  return { process: child, port, profile, browserPath, stderr: () => stderr };
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
      this.ws.addEventListener("error", (event) => {
        clearTimeout(timer);
        reject(new Error(`WebSocket error: ${event.message ?? "unknown"}`));
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
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
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
    // Best effort; the whole browser process is also killed during cleanup.
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

async function runViewport(browserPort, viewport) {
  const { page, targetId } = await newPage(browserPort);
  try {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.dpr,
      mobile: viewport.mobile,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    });
    await page.send("Emulation.setEmulatedMedia", {
      features: viewport.reducedMotion
        ? [{ name: "prefers-reduced-motion", value: "reduce" }]
        : [{ name: "prefers-reduced-motion", value: "no-preference" }],
    });

    const loadEvent = page.waitForEvent("Page.loadEventFired", null, 30000).catch(() => null);
    await page.send("Page.navigate", { url: `${APP_URL}?visual-smoke=${viewport.name}` });
    await loadEvent;
    await waitForExpression(page, "window.__magazineScene && window.__magazineScene.assetsReady", 60000);
    await waitForExpression(page, "(window.__magazineScene?.standees?.size ?? 0) >= 15", 60000);

    const setup = await page.evaluate(
      `(
        async () => {
          const scene = window.__magazineScene;
          scene.landOnSpread(3, { persist: false, snapCamera: true });
          const standee = scene.standees.get(7);
          if (standee && standee.state === "folded") scene.toggleStandee(standee);
          for (let i = 0; i < 120; i += 1) {
            scene.updateStandees(1 / 60, scene.elapsedTime + i / 60);
          }
          scene.updateCamera(1, performance.now());
          scene.updateMicroMotion(scene.elapsedTime);
          scene.renderer.shadowMap.needsUpdate = true;
          scene.composer.render();
          const { RENDER } = await import("/src/render-config.js");
          return {
            state: scene.state,
            spreadIndex: scene.spreadIndex,
            standeeCount: scene.standees.size,
            targetStandee: standee ? {
              state: standee.state,
              visible: standee.pivot.visible,
              angle: Number(standee.angle.toFixed(3)),
              materialHasShader: typeof standee.mesh.material.onBeforeCompile === "function",
            } : null,
            bokehEnabled: scene.bokehPass.enabled,
            toneMappingMatchesConfig: scene.renderer.toneMapping === RENDER.renderer.toneMapping,
            reducedMotion: scene.reducedMotion,
            grainEnabled: scene.grainPass.enabled,
            grainTime: Number(scene.grainPass.uniforms.uTime.value.toFixed(4)),
          };
        }
      )()`,
      30000,
    );

    const metrics = await page.evaluate(
      `(() => {
        const scene = window.__magazineScene;
        scene.composer.render();
        const source = scene.renderer.domElement;
        const canvas = document.createElement("canvas");
        canvas.width = source.width;
        canvas.height = source.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(source, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let samples = 0;
        let nonBlank = 0;
        let lumSum = 0;
        let dark = 0;
        let bright = 0;
        const stride = Math.max(4, Math.floor(Math.sqrt((canvas.width * canvas.height) / 12000)));
        for (let y = 0; y < canvas.height; y += stride) {
          for (let x = 0; x < canvas.width; x += stride) {
            const i = (y * canvas.width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            samples += 1;
            lumSum += lum;
            if (a > 0 && (r > 3 || g > 3 || b > 3)) nonBlank += 1;
            if (lum < 24) dark += 1;
            if (lum > 190) bright += 1;
          }
        }
        return {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          samples,
          nonBlankFraction: Number((nonBlank / samples).toFixed(4)),
          avgLum: Number((lumSum / samples).toFixed(2)),
          darkFraction: Number((dark / samples).toFixed(4)),
          brightFraction: Number((bright / samples).toFixed(4)),
        };
      })()`,
      30000,
    );

    const screenshot = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true }, 30000);
    const screenshotPath = path.join(OUT_DIR, `${viewport.name}.png`);
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

    const pass =
      setup.standeeCount >= 15 &&
      setup.targetStandee?.visible === true &&
      setup.bokehEnabled === false &&
      setup.toneMappingMatchesConfig === true &&
      (!viewport.reducedMotion || (setup.reducedMotion === true && setup.grainEnabled === false)) &&
      metrics.nonBlankFraction > 0.08 &&
      metrics.avgLum > 8;

    return {
      viewport: viewport.name,
      size: `${viewport.width}x${viewport.height}`,
      dpr: viewport.dpr,
      screenshotPath,
      setup,
      metrics,
      pass,
    };
  } finally {
    await closeTarget(browserPort, targetId);
    await page.close();
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const vite = await startVite();
  const browser = await startBrowser();
  const results = [];

  try {
    for (const viewport of VIEWPORTS) {
      results.push(await runViewport(browser.port, viewport));
    }
  } finally {
    stopChild(browser.process);
    stopChild(vite.process);
  }

  const failed = results.filter((result) => !result.pass);
  const summary = {
    appUrl: APP_URL,
    vite: vite.reused ? "reused" : "started",
    browser: browser.browserPath,
    results,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (failed.length) {
    process.stderr.write(`visual smoke failed: ${failed.map((result) => result.viewport).join(", ")}\n`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
