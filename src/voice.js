// Voice URL resolution (Sprint 18, S18-BUS-1).
//
// `voice` is an OPTIONAL per-line field in commentary.json: a pack-relative
// path string such as "voice/intro.ogg". Today there are zero voice assets in
// the repo, so every lookup resolves to null and the app degrades to subtitles
// only. When Sprint 17 ships real audio, the files land under
// assets/image-packs/<id>/voice/* and resolve through the build-time glob with
// no further wiring.
//
// Resolution is BUILD-TIME (import.meta.glob), mirroring how page images
// resolve in magazineScene.js — never a runtime fetch of a hand-built path
// string that may 404 (Sprint 18 pitfall). A missing file resolves to null.
//
// This module is pure (no DOM / no scene / no AudioContext), so the resolver
// can be headless-asserted in isolation.

// Eager URL glob over every file under any pack's voice/ directory. Empty today
// (no voice/ dirs exist), which is exactly the degraded path we ship.
const voiceFileUrls = import.meta.glob("../assets/image-packs/*/voice/*", {
  eager: true,
  query: "?url",
  import: "default",
});

// Build a lookup keyed by "<packId>/<packRelativePath>" → hashed URL.
// e.g. key "3/voice/intro.ogg" → "/assets/intro.deadbeef.ogg".
function buildVoiceUrlIndex(entries) {
  const index = new Map();
  for (const [filePath, url] of Object.entries(entries)) {
    const match = filePath.match(/image-packs\/(\d+)\/(voice\/.+)$/);
    if (!match) continue;
    const packId = Number(match[1]);
    const relative = match[2];
    index.set(`${packId}/${relative}`, url);
  }
  return index;
}

const VOICE_URL_INDEX = buildVoiceUrlIndex(voiceFileUrls);

// Normalize a pack-relative voice path the same way the validator expects it:
// a non-empty string, no leading slash, no absolute path, no parent escapes.
// Anything malformed resolves to null (never throws).
function normalizeVoicePath(voicePath) {
  if (typeof voicePath !== "string") return null;
  const trimmed = voicePath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") || /^[a-zA-Z]:/.test(trimmed)) return null;
  if (trimmed.includes("..")) return null;
  // Tolerate an authored "voice/x" or a bare "x" that already lives under voice/.
  return trimmed;
}

// Resolve an optional pack-relative `voice` path for a given pack id to a
// build-time URL, or null when the field is absent / malformed / the file does
// not exist. `resolveVoiceUrl(index, packId, voicePath)` is the injectable form
// for tests; the default export uses the module-level glob index.
export function resolveVoiceUrl(index, packId, voicePath) {
  const relative = normalizeVoicePath(voicePath);
  if (relative === null) return null;
  if (!Number.isInteger(packId) || packId < 0) return null;
  return index.get(`${packId}/${relative}`) ?? null;
}

// Default resolver bound to the module-level glob index.
export function voiceUrlFor(packId, voicePath) {
  return resolveVoiceUrl(VOICE_URL_INDEX, packId, voicePath);
}

// Exposed for headless assertions / smoke harnesses that want to inspect the
// (currently empty) index without re-globbing.
export function voiceUrlIndexSize() {
  return VOICE_URL_INDEX.size;
}

export { buildVoiceUrlIndex, normalizeVoicePath };
