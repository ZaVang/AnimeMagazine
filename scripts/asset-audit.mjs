import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPORT_PATH = path.join(ROOT, "docs", "asset-audit.md");
const COMMAND = "npm run asset:audit";

const OPTIMIZATION_RECORDS = [
  {
    label: "Sprint 13b paper normal map runtime source",
    path: "public/pbr/paper_0026/paper_0026_normal_opengl_2k.png",
    beforeBytes: 23597649,
    note: "Downsampled from 2048px to 1024px; filename preserved for the existing TextureLoader URL.",
  },
  {
    label: "Sprint 13b paper normal map built copy",
    path: "dist/pbr/paper_0026/paper_0026_normal_opengl_2k.png",
    beforeBytes: 23597649,
    note: "Dist copy should match the runtime public source after build.",
  },
  {
    label: "Sprint 13b wood normal map runtime source",
    path: "public/pbr/wood_0066/wood_0066_normal_opengl_2k.png",
    beforeBytes: 20977974,
    note: "Downsampled from 2048px to 1024px; filename preserved for the existing TextureLoader URL.",
  },
  {
    label: "Sprint 13b wood normal map built copy",
    path: "dist/pbr/wood_0066/wood_0066_normal_opengl_2k.png",
    beforeBytes: 20977974,
    note: "Dist copy should match the runtime public source after build.",
  },
];

const WEBGL_VARIANT_FAMILIES = [
  { label: "WebGL background pages", source: "background-only.png", target: "background-only.webp" },
  { label: "WebGL expression sheets", source: "expression-sheet.png", target: "expression-sheet.webp" },
  { label: "WebGL figure cutouts", source: "character-transparent.png", target: "character-transparent.webp" },
  {
    label: "WebGL transparent expression sheets",
    source: "expression-sheet-transparent.png",
    target: "expression-sheet-transparent.webp",
  },
  { label: "WebGL action sheets", source: "action-sheet-transparent.png", target: "action-sheet-transparent.webp" },
];

const SCOPES = [
  { label: "source assets", root: "assets" },
  { label: "source public", root: "public" },
  { label: "built dist", root: "dist" },
];

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function extensionOf(filePath) {
  return path.extname(filePath).toLowerCase() || "(none)";
}

function categoryOf(scopeRoot, relativePath) {
  const parts = relativePath.split(path.sep);
  if (scopeRoot === "assets" && parts[0] === "image-packs" && /^\d+$/.test(parts[1] ?? "")) {
    return `assets/image-packs/${parts[2] ?? "(root)"}`;
  }
  if (scopeRoot === "dist" && parts[0] === "assets") {
    return "dist/assets";
  }
  return `${scopeRoot}/${parts[0] ?? "(root)"}`;
}

function addTotal(map, key, size) {
  const current = map.get(key) ?? { files: 0, bytes: 0 };
  current.files += 1;
  current.bytes += size;
  map.set(key, current);
}

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

function tableFromTotals(title, totals) {
  const rows = [...totals.entries()].sort((a, b) => b[1].bytes - a[1].bytes || a[0].localeCompare(b[0]));
  return [
    `## ${title}`,
    "",
    "| Key | Files | Bytes | Size |",
    "|---|---:|---:|---:|",
    ...rows.map(([key, total]) => `| \`${key}\` | ${total.files} | ${total.bytes} | ${formatBytes(total.bytes)} |`),
    "",
  ].join("\n");
}

function renderOptimizationRecords(files) {
  const filesByPath = new Map(files.map((file) => [file.path, file]));

  return [
    "## Tracked optimizations",
    "",
    "| Label | File | Before | Current | Reduction | Note |",
    "|---|---|---:|---:|---:|---|",
    ...OPTIMIZATION_RECORDS.map((record) => {
      const current = filesByPath.get(record.path);
      const currentBytes = current?.bytes ?? null;
      const reduction = currentBytes === null ? null : record.beforeBytes - currentBytes;
      const reductionText = reduction === null
        ? "(missing)"
        : `${reduction} (${formatBytes(reduction)})`;
      const currentText = currentBytes === null
        ? "(missing)"
        : `${currentBytes} (${formatBytes(currentBytes)})`;
      return [
        `| ${record.label}`,
        `\`${record.path}\``,
        `${record.beforeBytes} (${formatBytes(record.beforeBytes)})`,
        currentText,
        reductionText,
        record.note,
      ].join(" | ") + " |";
    }),
    "",
  ].join("\n");
}

function familyTotal(files, directory, filename) {
  const suffix = `/${directory}/${filename}`;
  return files
    .filter((file) => /^assets\/image-packs\/\d+\//.test(file.path) && file.path.endsWith(suffix))
    .reduce(
      (total, file) => {
        total.files += 1;
        total.bytes += file.bytes;
        return total;
      },
      { files: 0, bytes: 0 },
    );
}

function renderWebglVariantRecords(files) {
  return [
    "## WebGL display variants",
    "",
    "| Label | Files | Canonical PNG | WebP display copy | WebGL import reduction |",
    "|---|---:|---:|---:|---:|",
    ...WEBGL_VARIANT_FAMILIES.map((family) => {
      const source = familyTotal(files, "images", family.source);
      const target = familyTotal(files, "images-webgl", family.target);
      const reduction = target.files ? source.bytes - target.bytes : null;
      return [
        `| ${family.label}`,
        `${target.files || source.files}`,
        `${source.bytes} (${formatBytes(source.bytes)})`,
        target.files ? `${target.bytes} (${formatBytes(target.bytes)})` : "(missing)",
        reduction === null ? "(missing)" : `${reduction} (${formatBytes(reduction)})`,
      ].join(" | ") + " |";
    }),
    "",
  ].join("\n");
}

async function collect() {
  const files = [];
  const missingScopes = [];

  for (const scope of SCOPES) {
    const scopePath = path.join(ROOT, scope.root);
    if (!(await pathExists(scopePath))) {
      missingScopes.push(scope);
      continue;
    }
    const scopeFiles = await walkFiles(scopePath);
    for (const fullPath of scopeFiles) {
      const stat = await fs.stat(fullPath);
      const relativePath = path.relative(ROOT, fullPath);
      files.push({
        scope: scope.label,
        path: relativePath.split(path.sep).join("/"),
        extension: extensionOf(fullPath),
        category: categoryOf(scope.root, path.relative(scopePath, fullPath)),
        bytes: stat.size,
      });
    }
  }

  return { files, missingScopes };
}

async function validateWebglVariants() {
  const issues = [];
  const packsRoot = path.join(ROOT, "assets", "image-packs");
  if (!(await pathExists(packsRoot))) return issues;

  const entries = await fs.readdir(packsRoot, { withFileTypes: true });
  const packIds = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => Number(a) - Number(b));

  for (const packId of packIds) {
    for (const family of WEBGL_VARIANT_FAMILIES) {
      const sourcePath = path.join(packsRoot, packId, "images", family.source);
      const targetPath = path.join(packsRoot, packId, "images-webgl", family.target);
      const sourceExists = await pathExists(sourcePath);
      const targetExists = await pathExists(targetPath);

      if (sourceExists && !targetExists) {
        issues.push({
          packId,
          family: family.label,
          source: path.relative(ROOT, sourcePath).split(path.sep).join("/"),
          target: path.relative(ROOT, targetPath).split(path.sep).join("/"),
          status: "missing",
        });
        continue;
      }
      if (!sourceExists && targetExists) {
        issues.push({
          packId,
          family: family.label,
          source: path.relative(ROOT, sourcePath).split(path.sep).join("/"),
          target: path.relative(ROOT, targetPath).split(path.sep).join("/"),
          status: "orphaned",
        });
        continue;
      }
      if (!sourceExists || !targetExists) continue;

      const [sourceStat, targetStat] = await Promise.all([fs.stat(sourcePath), fs.stat(targetPath)]);
      if (sourceStat.mtimeMs - targetStat.mtimeMs > 1000) {
        issues.push({
          packId,
          family: family.label,
          source: path.relative(ROOT, sourcePath).split(path.sep).join("/"),
          target: path.relative(ROOT, targetPath).split(path.sep).join("/"),
          status: "stale",
        });
      }
    }
  }

  return issues;
}

function renderWebglVariantDrift(issues) {
  if (!issues.length) {
    return [
      "## WebGL variant drift check",
      "",
      "- None. Every canonical WebGL-only PNG has a matching, up-to-date `images-webgl/*.webp` display copy.",
      "",
    ].join("\n");
  }

  return [
    "## WebGL variant drift check",
    "",
    "| Pack | Family | Status | Source | Target |",
    "|---:|---|---|---|---|",
    ...issues.map(
      (issue) =>
        `| ${issue.packId} | ${issue.family} | ${issue.status} | \`${issue.source}\` | \`${issue.target}\` |`,
    ),
    "",
  ].join("\n");
}

function renderReport({ files, missingScopes, webglVariantIssues }) {
  const byExtension = new Map();
  const byCategory = new Map();
  const byScope = new Map();

  for (const file of files) {
    addTotal(byExtension, file.extension, file.bytes);
    addTotal(byCategory, file.category, file.bytes);
    addTotal(byScope, file.scope, file.bytes);
  }

  const largest = [...files].sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).slice(0, 25);
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const generatedAt = new Date().toISOString();

  const missingText = missingScopes.length
    ? missingScopes.map((scope) => `- \`${scope.root}/\` missing, skipped.`).join("\n")
    : "- None.";

  return [
    "# Asset Audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Command",
    "",
    `\`${COMMAND}\``,
    "",
    "## Summary",
    "",
    `- Files audited: ${files.length}`,
    `- Total bytes: ${totalBytes}`,
    `- Total size: ${formatBytes(totalBytes)}`,
    "- Scope: `assets/`, `public/`, and `dist/` when present.",
    "",
    "## Missing Scopes",
    "",
    missingText,
    "",
    tableFromTotals("Totals by scope", byScope),
    tableFromTotals("Totals by extension", byExtension),
    tableFromTotals("Totals by category", byCategory),
    renderOptimizationRecords(files),
    renderWebglVariantRecords(files),
    renderWebglVariantDrift(webglVariantIssues),
    "## Largest files",
    "",
    "| Rank | File | Scope | Bytes | Size |",
    "|---:|---|---|---:|---:|",
    ...largest.map(
      (file, index) =>
        `| ${index + 1} | \`${file.path}\` | ${file.scope} | ${file.bytes} | ${formatBytes(file.bytes)} |`,
    ),
    "",
  ].join("\n");
}

const audit = await collect();
const webglVariantIssues = await validateWebglVariants();
const report = renderReport({ ...audit, webglVariantIssues });
await fs.writeFile(REPORT_PATH, `${report}\n`, "utf8");
console.log(report);

if (webglVariantIssues.length) {
  console.error(
    `WebGL variant drift check failed: ${webglVariantIssues.length} issue(s). Run npm run asset:webgl-variants.`,
  );
  process.exitCode = 1;
}
