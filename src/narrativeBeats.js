// Narrative beats (Sprint 15)
// -----------------------------------------------------------------------------
// Pure spread -> primary-event resolution. This is intentionally free of DOM,
// Three.js objects, and runtime standee state so it can be asserted headlessly.
// Existing commentary.json files remain valid: beat/focus metadata is optional,
// and deterministic fallbacks still produce exactly one event for every spread.

export const NARRATIVE_EVENT_TYPES = Object.freeze([
  "read",
  "standee",
  "commentary",
  "lookCard",
  "runway",
  "cover",
  "back",
]);

const EVENT_TYPE_SET = new Set(NARRATIVE_EVENT_TYPES);

const DEFAULT_COPY = Object.freeze({
  read: {
    label: { ja: "静かに読む", zh: "安静阅读" },
    prompt: { ja: "余白と紙面を見る", zh: "先看版面留白" },
    emphasis: "quiet",
  },
  standee: {
    label: { ja: "立ち上がる頁", zh: "立起的人物页" },
    prompt: { ja: "人物にふれる", zh: "轻触人物" },
    emphasis: "figure",
  },
  commentary: {
    label: { ja: "コーデ解説", zh: "单品解说" },
    prompt: { ja: "服の点を見る", zh: "看服装热点" },
    emphasis: "outfit",
  },
  lookCard: {
    label: { ja: "コーデカード", zh: "造型卡片" },
    prompt: { ja: "カードで読む", zh: "打开卡片阅读" },
    emphasis: "card",
  },
  runway: {
    label: { ja: "ランウェイ", zh: "走秀" },
    prompt: { ja: "線の動きを見る", zh: "看线条动起来" },
    emphasis: "stage",
  },
  cover: {
    label: { ja: "表紙の儀式", zh: "封面仪式" },
    prompt: { ja: "表紙をひらく", zh: "打开封面" },
    emphasis: "cover",
  },
  back: {
    label: { ja: "裏表紙", zh: "封底" },
    prompt: { ja: "最後の紙面を閉じる", zh: "合上最后一页" },
    emphasis: "closing",
  },
});

function bilingual(value, fallback = { ja: "", zh: "" }) {
  if (typeof value === "string") return { ja: value, zh: value };
  if (!value || typeof value !== "object") return { ...fallback };
  return {
    ja: String(value.ja ?? value.zh ?? fallback.ja ?? ""),
    zh: String(value.zh ?? value.ja ?? fallback.zh ?? ""),
  };
}

function metadataFrom(commentary) {
  const raw = commentary?.beat ?? commentary?.focus ?? null;
  if (typeof raw === "string") return { type: raw };
  return raw && typeof raw === "object" ? raw : null;
}

function normalizeType(type, fallback) {
  return EVENT_TYPE_SET.has(type) ? type : fallback;
}

function fallbackType(source) {
  if (!source) return "read";
  if (source.video) return "runway";
  if (source.commentary?.items?.length) return "commentary";
  if (source.commentary?.character) return "lookCard";
  if (source.figure || source.background) return "standee";
  return "read";
}

function pickPrimarySource(sources) {
  if (!sources.length) return null;
  return (
    sources.find((source) => metadataFrom(source.commentary)) ??
    sources.find((source) => source.video) ??
    sources.find((source) => source.commentary?.items?.length) ??
    sources.find((source) => source.commentary?.character) ??
    sources[0]
  );
}

export function resolveNarrativeBeat(spread, spreadSources = []) {
  const sources = Array.isArray(spreadSources) ? spreadSources.filter(Boolean) : [];
  const source = pickPrimarySource(sources);
  const meta = metadataFrom(source?.commentary);
  const copyBase = DEFAULT_COPY[fallbackType(source)] ?? DEFAULT_COPY.read;
  const requestedType =
    meta?.type ?? meta?.event ?? meta?.kind ?? meta?.primary ?? meta?.targetEvent;
  const type = normalizeType(requestedType, fallbackType(source));
  const copy = DEFAULT_COPY[type] ?? copyBase;

  return {
    id: `spread-${spread}-${type}`,
    spread,
    type,
    sourcePage: Number.isInteger(source?.page) ? source.page : null,
    label: bilingual(meta?.label ?? meta?.title, copy.label),
    prompt: bilingual(meta?.prompt ?? meta?.gentlePrompt ?? meta?.hint, copy.prompt),
    emphasis: String(meta?.emphasis ?? copy.emphasis ?? "primary"),
    cue: meta?.cue ?? meta?.discoveryCue ?? type,
    target: meta?.target ?? meta?.item ?? null,
    availability: {
      reader: true,
      standee: !!source,
      commentary: !!source?.commentary?.items?.length,
      lookCard: !!source?.commentary?.character,
      runway: !!source?.video,
    },
  };
}

export function buildNarrativeBeatIndex({ spreadCount, sources, pageToSpread }) {
  const count = Math.max(0, Math.trunc(spreadCount) || 0);
  const bySpread = new Map();

  if (Array.isArray(sources) && typeof pageToSpread === "function") {
    for (const source of sources) {
      const located = pageToSpread(source?.page);
      if (!located || !Number.isInteger(located.spread)) continue;
      if (!bySpread.has(located.spread)) bySpread.set(located.spread, []);
      bySpread.get(located.spread).push(source);
    }
  }

  const index = new Map();
  for (let spread = 0; spread < count; spread += 1) {
    index.set(spread, resolveNarrativeBeat(spread, bySpread.get(spread) ?? []));
  }
  return index;
}

export function narrativeEventText(event, locale, field = "label") {
  const value = event?.[field];
  if (!value) return "";
  return locale === "zh" ? value.zh ?? value.ja ?? "" : value.ja ?? value.zh ?? "";
}
