import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PACKS_DIR = path.join(ROOT, "assets", "image-packs");

// These are display-only copies for Three.js, not source-of-truth art.
// Keep alpha-heavy assets lossless: character-transparent drives silhouette
// analysis, and transparent expression/action sheets can show edge halos if
// their alpha is quantized. Opaque background/expression sheets are q90 lossy
// because they are visual surfaces only and give the useful size win.
const VARIANTS = [
  { source: "background-only.png", target: "background-only.webp", mode: "lossy", quality: 90 },
  { source: "expression-sheet.png", target: "expression-sheet.webp", mode: "lossy", quality: 90 },
  { source: "character-transparent.png", target: "character-transparent.webp", mode: "lossless" },
  { source: "expression-sheet-transparent.png", target: "expression-sheet-transparent.webp", mode: "lossless" },
  { source: "action-sheet-transparent.png", target: "action-sheet-transparent.webp", mode: "lossless" },
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited ${code}\n${stderr.trim()}`));
    });
  });
}

async function assertFfmpegAvailable() {
  try {
    await runFfmpeg(["-hide_banner", "-version"]);
  } catch (error) {
    throw new Error(
      "ffmpeg with libwebp support is required for npm run asset:webgl-variants. " +
        "Install ffmpeg or regenerate WebGL variants on a machine that has it.\n" +
        error.message,
    );
  }
}

async function listPackDirs() {
  const entries = await fs.readdir(PACKS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => Number(a) - Number(b));
}

async function encodeVariant(sourcePath, targetPath, variant) {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    sourcePath,
    "-c:v",
    "libwebp",
    "-compression_level",
    "6",
  ];
  if (variant.mode === "lossless") {
    args.push("-lossless", "1");
  } else {
    args.push("-quality", String(variant.quality));
  }
  args.push(targetPath);
  await runFfmpeg(args);
}

const summary = new Map(VARIANTS.map((variant) => [variant.source, { source: 0, target: 0, files: 0 }]));

await assertFfmpegAvailable();

for (const packId of await listPackDirs()) {
  const imagesDir = path.join(PACKS_DIR, packId, "images");
  const outputDir = path.join(PACKS_DIR, packId, "images-webgl");
  await fs.mkdir(outputDir, { recursive: true });

  for (const variant of VARIANTS) {
    const sourcePath = path.join(imagesDir, variant.source);
    if (!(await pathExists(sourcePath))) continue;

    const targetPath = path.join(outputDir, variant.target);
    await encodeVariant(sourcePath, targetPath, variant);

    const sourceStat = await fs.stat(sourcePath);
    const targetStat = await fs.stat(targetPath);
    const row = summary.get(variant.source);
    row.source += sourceStat.size;
    row.target += targetStat.size;
    row.files += 1;
  }
}

console.log("# WebGL Variant Generation");
console.log("");
console.log("| Family | Files | Source PNG | WebP variant | Reduction |");
console.log("|---|---:|---:|---:|---:|");
for (const [family, row] of summary.entries()) {
  const reduction = row.source - row.target;
  console.log(
    `| ${family} | ${row.files} | ${formatBytes(row.source)} | ${formatBytes(row.target)} | ${formatBytes(reduction)} |`,
  );
}
