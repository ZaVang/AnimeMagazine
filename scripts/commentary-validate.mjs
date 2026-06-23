import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NARRATIVE_EVENT_TYPES } from "../src/narrativeBeats.js";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PACKS_ROOT = path.join(ROOT, "assets", "image-packs");
const AUDIT_PATH = path.join(ROOT, "docs", "commentary-audit.md");
const SCHEMA_VERSION = "commentary-bilingual-v1";
const LOCALES = ["ja", "zh"];
const PARTS = ["jacket", "top", "bottom", "dress", "bag", "shoes", "accessory", "hair", "makeup", "other"];
const EXPRESSIONS = ["neutral", "smile", "thinking"];
const EVENT_TYPES = new Set(NARRATIVE_EVENT_TYPES);
const PART_SET = new Set(PARTS);
const EXPRESSION_SET = new Set(EXPRESSIONS);

const NORMALIZATION_NOTES = [
  "`coat` and `outer` were normalized to `jacket` for outerwear items.",
  "`prop` and `umbrella` were normalized to `other` for non-garment props.",
  "No wording, anchors, item order, names, tags, or bilingual commentary copy were changed.",
];

const SPOT_CHECKS = [
  {
    pack: "1",
    title: "structured commuter baseline",
    notes: [
      "Hotspots follow the visible blazer, knit, trousers, bag, and shoes from top to bottom.",
      "Japanese tone is calm editorial commentary rather than command copy.",
      "Chinese meaning mirrors the Japanese fashion judgment without adding new facts.",
      "Expressions alternate neutral/smile in places where the outfit text softens or resolves.",
    ],
  },
  {
    pack: "8",
    title: "academic library spread",
    notes: [
      "The book prop is intentionally `other`; it is a narrative object, not a fashion category.",
      "The thinking expression links to the book/academic mood and stays within supported hints.",
      "The Japanese and Chinese copy both keep the library distance-and-judgment idea.",
      "Anchors stay on coat, neckline, tie/scarf, book, and shoes without weak filler points.",
    ],
  },
  {
    pack: "14",
    title: "sports/city utility spread",
    notes: [
      "The bottle is intentionally `other`; it supports the active scene but is not apparel.",
      "The jacket, pants, shoulder bag, and shoes remain strong visible outfit anchors.",
      "Japanese tone keeps the practical-athletic read, while Chinese stays explanatory.",
      "Expression linkage remains neutral/smile only, so the 3x2 sheet hint map is covered.",
    ],
  },
];

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function addError(errors, pack, fieldPath, message) {
  errors.push(`[pack ${pack}] ${fieldPath}: ${message}`);
}

function addCount(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateBilingualText(value, pack, fieldPath, errors) {
  if (!isPlainObject(value)) {
    addError(errors, pack, fieldPath, "expected bilingual object with ja and zh strings");
    return;
  }
  for (const locale of LOCALES) {
    if (!isNonEmptyString(value[locale])) {
      addError(errors, pack, `${fieldPath}.${locale}`, "expected non-empty string");
    }
  }
}

function validateBilingualList(value, pack, fieldPath, errors) {
  if (!isPlainObject(value)) {
    addError(errors, pack, fieldPath, "expected bilingual object with ja and zh arrays");
    return;
  }
  for (const locale of LOCALES) {
    const list = value[locale];
    if (!Array.isArray(list) || list.length === 0) {
      addError(errors, pack, `${fieldPath}.${locale}`, "expected non-empty string array");
      continue;
    }
    list.forEach((entry, index) => {
      if (!isNonEmptyString(entry)) {
        addError(errors, pack, `${fieldPath}.${locale}[${index}]`, "expected non-empty string");
      }
    });
  }
}

function validateExpression(value, pack, fieldPath, errors) {
  if (!EXPRESSION_SET.has(value)) {
    addError(errors, pack, fieldPath, `expected one of ${EXPRESSIONS.join(", ")}`);
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateVoice(value, pack, packDir, fieldPath, errors, stats) {
  if (value === undefined) return;
  addCount(stats.optionalCounts, "voice");
  if (!isNonEmptyString(value)) {
    addError(errors, pack, fieldPath, "expected pack-relative non-empty string path");
    return;
  }
  if (path.isAbsolute(value)) {
    addError(errors, pack, fieldPath, "must be relative to the image pack, not absolute");
    return;
  }
  const resolved = path.resolve(packDir, value);
  if (!resolved.startsWith(`${packDir}${path.sep}`)) {
    addError(errors, pack, fieldPath, "must stay inside the image pack directory");
    return;
  }
  if (await pathExists(resolved)) {
    stats.voice.present += 1;
  } else {
    stats.voice.missing.push(`pack ${pack} ${fieldPath} -> ${value}`);
    addError(errors, pack, fieldPath, `missing voice file ${value}`);
  }
}

function validateEmotion(value, pack, fieldPath, errors, stats) {
  if (value === undefined) return;
  addCount(stats.optionalCounts, "emotion");
  if (!isNonEmptyString(value)) {
    addError(errors, pack, fieldPath, "expected non-empty string");
  }
}

function validateMouth(value, pack, fieldPath, errors, stats) {
  if (value === undefined) return;
  addCount(stats.optionalCounts, "mouth");
  if (isNonEmptyString(value)) return;
  if (isPlainObject(value)) return;
  addError(errors, pack, fieldPath, "expected non-empty string or object");
}

function validateEventMetadata(value, pack, fieldPath, errors, stats) {
  if (value === undefined) return;
  addCount(stats.optionalCounts, fieldPath.endsWith(".beat") ? "beat" : "focus");

  if (typeof value === "string") {
    if (!EVENT_TYPES.has(value)) {
      addError(errors, pack, fieldPath, `expected event type: ${NARRATIVE_EVENT_TYPES.join(", ")}`);
    }
    return;
  }

  if (!isPlainObject(value)) {
    addError(errors, pack, fieldPath, "expected event type string or metadata object");
    return;
  }

  const requestedType = value.type ?? value.event ?? value.kind ?? value.primary ?? value.targetEvent;
  if (requestedType !== undefined && !EVENT_TYPES.has(requestedType)) {
    addError(errors, pack, `${fieldPath}.type`, `expected event type: ${NARRATIVE_EVENT_TYPES.join(", ")}`);
  }
  if (value.label !== undefined && typeof value.label !== "string") {
    validateBilingualText(value.label, pack, `${fieldPath}.label`, errors);
  }
  if (value.prompt !== undefined && typeof value.prompt !== "string") {
    validateBilingualText(value.prompt, pack, `${fieldPath}.prompt`, errors);
  }
}

async function validateOptionalFields(value, pack, packDir, fieldPath, errors, stats) {
  if (!isPlainObject(value)) return;
  await validateVoice(value.voice, pack, packDir, `${fieldPath}.voice`, errors, stats);
  validateEmotion(value.emotion, pack, `${fieldPath}.emotion`, errors, stats);
  validateMouth(value.mouth, pack, `${fieldPath}.mouth`, errors, stats);
  validateEventMetadata(value.beat, pack, `${fieldPath}.beat`, errors, stats);
  validateEventMetadata(value.focus, pack, `${fieldPath}.focus`, errors, stats);
}

async function commentaryFiles() {
  const entries = await fs.readdir(PACKS_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => Number(a) - Number(b));
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function validatePack(pack, stats, errors) {
  const packDir = path.join(PACKS_ROOT, pack);
  const filePath = path.join(packDir, "commentary.json");
  if (!(await pathExists(filePath))) {
    addError(errors, pack, "commentary.json", "missing file");
    return;
  }

  let data;
  try {
    data = await readJson(filePath);
  } catch (error) {
    addError(errors, pack, "commentary.json", `invalid JSON: ${error.message}`);
    return;
  }

  stats.fileCount += 1;
  if (data.schemaVersion !== SCHEMA_VERSION) {
    addError(errors, pack, "schemaVersion", `expected ${SCHEMA_VERSION}`);
  }
  if (!LOCALES.includes(data.defaultLocale)) {
    addError(errors, pack, "defaultLocale", `expected one of ${LOCALES.join(", ")}`);
  }

  validateBilingualText(data.title, pack, "title", errors);
  validateBilingualText(data.character?.name, pack, "character.name", errors);
  validateBilingualText(data.character?.intro, pack, "character.intro", errors);
  validateBilingualText(data.intro, pack, "intro", errors);
  validateBilingualText(data.runwayIntro, pack, "runwayIntro", errors);
  if (data.intro?.expression !== undefined) validateExpression(data.intro.expression, pack, "intro.expression", errors);
  if (data.runwayIntro?.expression !== undefined) {
    validateExpression(data.runwayIntro.expression, pack, "runwayIntro.expression", errors);
  }

  await validateOptionalFields(data, pack, packDir, "commentary", errors, stats);
  await validateOptionalFields(data.intro, pack, packDir, "intro", errors, stats);
  await validateOptionalFields(data.runwayIntro, pack, packDir, "runwayIntro", errors, stats);

  if (!Array.isArray(data.items)) {
    addError(errors, pack, "items", "expected array");
    return;
  }
  if (data.items.length < 4 || data.items.length > 6) {
    addError(errors, pack, "items", "expected 4-6 strong items");
  }
  stats.itemCount += data.items.length;

  const ids = new Set();
  for (let index = 0; index < data.items.length; index += 1) {
    const item = data.items[index];
    const itemPath = `items[${index}]`;
    if (!isPlainObject(item)) {
      addError(errors, pack, itemPath, "expected object");
      continue;
    }

    if (!isNonEmptyString(item.id) || !/^[a-z0-9][a-z0-9-]*$/.test(item.id)) {
      addError(errors, pack, `${itemPath}.id`, "expected non-empty kebab-case id");
    } else if (ids.has(item.id)) {
      addError(errors, pack, `${itemPath}.id`, `duplicate id ${item.id}`);
    } else {
      ids.add(item.id);
    }

    if (!PART_SET.has(item.part)) {
      addError(errors, pack, `${itemPath}.part`, `expected one of ${PARTS.join(", ")}`);
    } else {
      addCount(stats.partCounts, item.part);
    }

    if (!Array.isArray(item.anchor) || item.anchor.length !== 2) {
      addError(errors, pack, `${itemPath}.anchor`, "expected [x, y]");
    } else {
      item.anchor.forEach((value, anchorIndex) => {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
          addError(errors, pack, `${itemPath}.anchor[${anchorIndex}]`, "expected number in [0, 1]");
        }
      });
    }

    validateExpression(item.expression, pack, `${itemPath}.expression`, errors);
    if (EXPRESSION_SET.has(item.expression)) addCount(stats.expressionCounts, item.expression);
    validateBilingualText(item.name, pack, `${itemPath}.name`, errors);
    validateBilingualList(item.tags, pack, `${itemPath}.tags`, errors);
    validateBilingualText(item.text, pack, `${itemPath}.text`, errors);
    await validateOptionalFields(item, pack, packDir, itemPath, errors, stats);
  }
}

function rowsFromCounts(counts) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function table(title, keyLabel, counts) {
  const rows = rowsFromCounts(counts);
  return [
    `## ${title}`,
    "",
    `| ${keyLabel} | Count |`,
    "|---|---:|",
    ...rows.map(([key, count]) => `| \`${key}\` | ${count} |`),
    "",
  ];
}

async function writeAudit(stats) {
  const optionalRows = rowsFromCounts(stats.optionalCounts);
  const lines = [
    "# Commentary Audit",
    "",
    `Generated by \`${stats.command}\`.`,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Commentary files | ${stats.fileCount} |`,
    `| Image packs | ${stats.packCount} |`,
    `| Items | ${stats.itemCount} |`,
    `| Average items per pack | ${(stats.itemCount / Math.max(stats.fileCount, 1)).toFixed(1)} |`,
    "",
    ...table("part distribution", "Part", stats.partCounts),
    ...table("Expression usage", "Expression", stats.expressionCounts),
    "## Optional field usage",
    "",
    "| Field | Count |",
    "|---|---:|",
    ...(optionalRows.length ? optionalRows.map(([key, count]) => `| \`${key}\` | ${count} |`) : ["| `(none)` | 0 |"]),
    "",
    "## Voice status",
    "",
    stats.voice.present
      ? `- ${stats.voice.present} \`voice\` paths are present and exist.`
      : "- No `voice` fields are present. This is valid: the app falls back to subtitles, swing tags, look-card, and guided tour text.",
    "",
    "## Spot checks",
    "",
    ...SPOT_CHECKS.flatMap((check) => [
      `### Pack ${check.pack}: ${check.title}`,
      "",
      ...check.notes.map((note) => `- ${note}`),
      "",
    ]),
    "## Corrections",
    "",
    ...NORMALIZATION_NOTES.map((note) => `- ${note}`),
    "",
  ];
  await fs.writeFile(AUDIT_PATH, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const packs = await commentaryFiles();
  const stats = {
    command: "npm run commentary:validate",
    packCount: packs.length,
    fileCount: 0,
    itemCount: 0,
    partCounts: new Map(),
    expressionCounts: new Map(),
    optionalCounts: new Map(),
    voice: { present: 0, missing: [] },
  };
  const errors = [];

  for (const pack of packs) {
    await validatePack(pack, stats, errors);
  }

  if (errors.length) {
    console.error(`Commentary validation failed with ${errors.length} error(s).`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  await writeAudit(stats);
  console.log("Commentary validation passed.");
  console.log(`Packs: ${stats.fileCount}/${stats.packCount}`);
  console.log(`Items: ${stats.itemCount}`);
  console.log(`Part distribution: ${rowsFromCounts(stats.partCounts).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`Expression usage: ${rowsFromCounts(stats.expressionCounts).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`Voice fields: ${stats.voice.present || 0}`);
  console.log(`Audit: ${toRepoPath(AUDIT_PATH)}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
