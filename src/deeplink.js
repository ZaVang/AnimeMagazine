// Deep-link codec — the pure URL ⇄ reading-state mapping (E5 + CODEC-1).
//
// The magazine's whole "where am I, in what language, looking at which item"
// can be encoded into the address bar so a second person opens it in the same
// state. This file holds ONLY the pure logic (parse params → state, state →
// share URL) so it can be asserted headlessly without a DOM or a live scene:
//
//   parseDeepLink("?spread=3&lang=zh")        → { spread: 3, locale: "zh", item: null }
//   parseDeepLink("?spread=3&item=2")         → { spread: 3, locale: null, item: 2 }
//   parseDeepLink("?spread=-1")               → { spread: null, locale: null, item: null }
//   parseDeepLink("?item=2")                  → { spread: null, locale: null, item: null }  (orphan ignored)
//   buildShareUrl("https://x/", state)        → "https://x/?spread=3&lang=zh&item=2"
//
// Out-of-range / malformed params resolve to null (the caller falls back to its
// default landing), never throwing. Spread bounds are validated by the caller,
// which owns leafCount(); here we only reject clearly invalid shapes.
//
// CODEC-1 — the `item` field is OPTIONAL and NESTED: it rides on `spread`.
//   - An orphan `?item=2` (no spread) is ignored — item without an anchoring
//     spread is meaningless (a card lives on a spread).
//   - An out-of-range item is NOT rejected here (this layer has no card-count);
//     the caller clamps/ignores it (lands the whole spread, opens no empty card).
//   - An old `?spread=N` link omits item entirely → item null → lands the whole
//     spread → byte-for-byte the old behavior (zero break). We NEVER add a third
//     flat param (?char= etc.) — item stays nested under spread.

const SPREAD_PARAM = "spread";
const LOCALE_PARAM = "lang";
const ITEM_PARAM = "item";
const SUPPORTED_LOCALES = new Set(["ja", "zh"]);

// Parse a query string (with or without a leading "?") into a partial reading
// state. Missing or invalid fields come back as null so the caller can decide
// the fallback per-field. Never throws.
export function parseDeepLink(search) {
  const result = { spread: null, locale: null, item: null };
  if (typeof search !== "string" || !search) return result;
  let params;
  try {
    params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return result;
  }

  const rawSpread = params.get(SPREAD_PARAM);
  if (rawSpread !== null && rawSpread !== "") {
    const n = Number(rawSpread);
    // a non-negative integer; upper bound is clamped by the caller (leafCount)
    if (Number.isInteger(n) && n >= 0) result.spread = n;
  }

  const rawLocale = params.get(LOCALE_PARAM);
  if (rawLocale && SUPPORTED_LOCALES.has(rawLocale)) result.locale = rawLocale;

  // item is nested under spread: only parse it when a valid spread anchors it,
  // so an orphan ?item=2 (no spread) is silently ignored. Item upper bound is
  // the card's own (items.length); the caller clamps/ignores out-of-range.
  if (result.spread !== null) {
    const rawItem = params.get(ITEM_PARAM);
    if (rawItem !== null && rawItem !== "") {
      const m = Number(rawItem);
      if (Number.isInteger(m) && m >= 0) result.item = m;
    }
  }

  return result;
}

// Whether a parsed deep link carries any actionable state at all. item alone is
// never actionable (it is ignored without a spread), so it never makes a link
// "active" on its own — but parse already nulls an orphan item, so this stays
// in sync by checking spread/locale.
export function hasDeepLinkState(state) {
  return !!state && (state.spread !== null || state.locale !== null);
}

// Build a shareable URL for the given reading state. `base` is typically
// window.location.origin + pathname (no query/hash); existing query params are
// dropped so the link is a clean snapshot. Returns the base unchanged if no
// state is supplied. item is appended only when a spread anchors it (nested
// contract, mirroring parse) and a non-empty item never bleeds without spread.
export function buildShareUrl(base, { spread = null, locale = null, item = null } = {}) {
  const root = typeof base === "string" && base ? base : "";
  const params = new URLSearchParams();
  const hasSpread = Number.isInteger(spread) && spread >= 0;
  if (hasSpread) params.set(SPREAD_PARAM, String(spread));
  if (locale && SUPPORTED_LOCALES.has(locale)) params.set(LOCALE_PARAM, locale);
  // nested: item is emitted only alongside a valid spread; a missing/empty item
  // is omitted so a plain spread share stays a clean ?spread=N snapshot.
  if (hasSpread && Number.isInteger(item) && item >= 0) params.set(ITEM_PARAM, String(item));
  const query = params.toString();
  return query ? `${root}?${query}` : root;
}

export { SPREAD_PARAM, LOCALE_PARAM, ITEM_PARAM };
