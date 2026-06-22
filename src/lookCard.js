// Look card data layer (CARD-1) — the pure "spread → commentary → card fields"
// mapping, kept free of any DOM or live-scene dependency so it can be asserted
// headlessly (like deeplink.js).
//
// THE HEADLINE RED LINE (R-CARD-DATASOURCE / N-1)
// ------------------------------------------------------------------------------
// Card data MUST come from the module-level commentary that ships with the page
// packs — the same `import.meta.glob({ eager: true })` data that is synchronously
// ready at module load — reached through `STANDEE_SOURCES` (which already carries
// each pack's `page` index + `commentary`) reverse-mapped by the magazine's own
// `pageToSpread()` single source of truth.
//
// It must NEVER read `this.standees` / `currentSpreadCharacter()`: those traverse
// the run-time, frame-by-frame `loadStandees` build, so a deep link that opens a
// card cold (`?spread=N&item=M`) would find an empty Map and render a blank card
// (the C9b cold-start race). The commentary data here is ready before any standee
// is built, so a cold-opened card always has data.
//
// `pageToSpread` is an *instance* method (it needs the magazine's leaf layout), so
// the index is built lazily from a reverse-lookup function the scene passes in —
// keeping this file a pure function of (STANDEE_SOURCES, pageToSpread) with no
// import of the heavy scene module.

// Build a spread → commentary index from the standee sources, using the caller's
// page→spread reverse lookup (the single source of truth `pageToSpread`). Each
// source already carries `page` (its page index) + `commentary` (the eager-loaded
// JSON). Sources without commentary, or whose page maps to no settled spread, are
// skipped. Returns a Map<spreadIndex, commentary>.
//
//   sources       : array of { page, commentary, ... } (STANDEE_SOURCES)
//   pageToSpread  : (pageIndex) => { spread, side } | null  (instance method)
export function buildSpreadCommentaryIndex(sources, pageToSpread) {
  const index = new Map();
  if (!Array.isArray(sources) || typeof pageToSpread !== "function") return index;
  for (const source of sources) {
    if (!source || !source.commentary) continue;
    const located = pageToSpread(source.page);
    if (!located || typeof located.spread !== "number") continue;
    // first writer wins: a spread maps to one commentary character; if two packs
    // ever shared a spread the left/earlier one anchors it (deterministic).
    if (!index.has(located.spread)) index.set(located.spread, source.commentary);
  }
  return index;
}

// Whether a spread has a commentary character — the single predicate the card
// entry guard and the open path both consult (built once, used in two places, so
// they can never drift). Reads the index, never `this.standees`.
export function spreadHasCommentary(index, spreadIndex) {
  return !!index && index.has(spreadIndex);
}

// Pick a bilingual {ja,zh} field in the active locale, falling back to the other
// side so a one-sided row never renders blank. Mirrors magazineScene's localeText
// so the card and the rest of the UI read identically.
function pick(field, locale) {
  if (!field) return "";
  return locale === "zh" ? field.zh ?? field.ja ?? "" : field.ja ?? field.zh ?? "";
}

function pickList(field, locale) {
  if (!field) return [];
  const list = locale === "zh" ? field.zh ?? field.ja : field.ja ?? field.zh;
  return Array.isArray(list) ? list : [];
}

// Build the locale-resolved view model the card renders, from a spread's
// commentary. Pure: same (index, spread, locale) → same fields, no scene state.
// Returns null when the spread has no commentary (so the caller opens no card).
//
// `activeItem` is clamped into the items range; an out-of-range index resolves to
// null (highlight nothing) rather than throwing — the deep-link item-out-of-range
// "land the spread, open no empty card" contract is enforced by the caller, but
// this stays safe even if a stale index slips through.
export function buildCardViewModel(index, spreadIndex, locale, activeItem = null) {
  const commentary = index?.get?.(spreadIndex);
  if (!commentary) return null;
  const lang = locale === "zh" ? "zh" : "ja";

  const rawItems = Array.isArray(commentary.items) ? commentary.items : [];
  const items = rawItems.map((item) => ({
    id: item?.id ?? "",
    part: item?.part ?? "",
    name: pick(item?.name, lang),
    tags: pickList(item?.tags, lang),
    text: pick(item?.text, lang),
  }));

  let active = null;
  if (Number.isInteger(activeItem) && activeItem >= 0 && activeItem < items.length) {
    active = activeItem;
  }

  return {
    spread: spreadIndex,
    locale: lang,
    title: pick(commentary.title, lang),
    character: {
      name: pick(commentary.character?.name, lang),
      intro: pick(commentary.character?.intro, lang),
    },
    runwayIntro: pick(commentary.runwayIntro, lang),
    items,
    activeItem: active,
  };
}

// Whether an item index is in range for a spread's card (used to clamp/ignore a
// deep-link item: out-of-range → false → land the spread, open no card on that
// item). Reads the index only.
export function isItemInRange(index, spreadIndex, itemIndex) {
  const commentary = index?.get?.(spreadIndex);
  if (!commentary || !Array.isArray(commentary.items)) return false;
  return Number.isInteger(itemIndex) && itemIndex >= 0 && itemIndex < commentary.items.length;
}
