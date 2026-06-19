// Persisted user preferences — the product's first persistence layer and the
// shared base for locale and skip-intro restore.
//
// Design notes:
// - One versioned namespace key holds a single JSON blob, so adding a field
//   later never disturbs existing values and the read/write surface stays tiny.
// - Every storage touch is wrapped: a private window, a full quota, a corrupt
//   value, or a missing localStorage all degrade silently to in-memory defaults
//   rather than throwing into the 3D init path.

const STORAGE_KEY = "atelier.prefs.v1";

export const DEFAULT_PREFERENCES = Object.freeze({
  locale: "ja", // primary subtitle language; "ja" | "zh"
  skipIntro: false, // set true once the cinematic intro has played through once
  guidedOnce: false, // whether this visitor has been guided before (returning visitor)
  lastSpread: 0, // last settled open spread index, for skip-intro restore
});

const SUPPORTED_LOCALES = new Set(["ja", "zh"]);

function getStorage() {
  // Some environments expose localStorage but throw on access (private mode,
  // disabled cookies). Probe with a real round-trip and treat any throw as
  // "no storage available".
  try {
    const storage = window.localStorage;
    if (!storage) return null;
    const probe = "__atelier_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

// Coerce an arbitrary parsed value into a clean preferences object, dropping
// unknown/corrupt fields and falling back to defaults per field. Never throws.
// Use this for blob entry points (storage read, external import) where the
// caller has no current-value to fall back to.
function sanitize(raw) {
  const prefs = { ...DEFAULT_PREFERENCES };
  if (!raw || typeof raw !== "object") return prefs;

  if (typeof raw.locale === "string" && SUPPORTED_LOCALES.has(raw.locale)) {
    prefs.locale = raw.locale;
  }
  if (typeof raw.skipIntro === "boolean") prefs.skipIntro = raw.skipIntro;
  if (typeof raw.guidedOnce === "boolean") prefs.guidedOnce = raw.guidedOnce;
  if (Number.isInteger(raw.lastSpread) && raw.lastSpread >= 0) {
    prefs.lastSpread = raw.lastSpread;
  }
  return prefs;
}

// PREF-1 (Sprint 6 / Iter 4): merge a partial patch over current preferences
// at the FIELD level — invalid patch fields are dropped while leaving the
// caller's existing good values intact. The pre-PREF-1 path
// `sanitize({...current, ...patch})` would `...patch`-clobber a good `lastSpread:7`
// to default `0` whenever a caller passed `{lastSpread:"abc"}`. Today all
// 3 in-app callers send well-typed values, so this is a latent contract bug
// (defense in depth for future callers, headless-asserted in PREF-1 spec).
// The blob-level `sanitize` above stays — loadPreferences still needs it for
// the disk-blob entry point where there is no "current" to fall back to.
function sanitizePatch(patch, current) {
  const next = { ...current };
  if (!patch || typeof patch !== "object") return next;
  if (typeof patch.locale === "string" && SUPPORTED_LOCALES.has(patch.locale)) {
    next.locale = patch.locale;
  }
  if (typeof patch.skipIntro === "boolean") next.skipIntro = patch.skipIntro;
  if (typeof patch.guidedOnce === "boolean") next.guidedOnce = patch.guidedOnce;
  if (Number.isInteger(patch.lastSpread) && patch.lastSpread >= 0) {
    next.lastSpread = patch.lastSpread;
  }
  return next;
}

export function loadPreferences() {
  const storage = getStorage();
  if (!storage) return { ...DEFAULT_PREFERENCES };
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return { ...DEFAULT_PREFERENCES };
    return sanitize(JSON.parse(text));
  } catch {
    // corrupt JSON or read failure → safe defaults
    return { ...DEFAULT_PREFERENCES };
  }
}

// Persist a partial update merged over current values, returning the merged set
// so callers can keep their in-memory copy in sync without a re-read. Storage
// failures are swallowed; the returned object is still authoritative in-memory.
export function savePreferences(patch) {
  // PREF-1 (Sprint 6 / Iter 4): merge at field level (sanitizePatch) — a bad
  // patch field is dropped without wiping the caller's prior good value.
  // The pre-PREF-1 path used `sanitize({...loadPreferences(), ...patch})`
  // which let any bad patch field clobber the stored value back to default.
  const merged = sanitizePatch(patch, loadPreferences());
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* quota or write failure: keep the in-memory value, drop persistence */
    }
  }
  return merged;
}

export { STORAGE_KEY as PREFERENCES_STORAGE_KEY, SUPPORTED_LOCALES };
