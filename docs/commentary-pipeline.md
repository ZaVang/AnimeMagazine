# Commentary Pipeline

This document is the authoring contract for
`assets/image-packs/N/commentary.json`. It keeps the fashion commentary data
repeatable without requiring `magazineScene.js` edits.

## Authoring Workflow

1. Inspect the pack context:
   - Read `assets/image-packs/N/source.md`.
   - Read the prompt files under `assets/image-packs/N/prompts/`, especially
     `main-visual.md`, `character-chromakey.md`, and `background-only.md`.
   - Open `images/main-visual.png` for the final printed look and
     `images/character-transparent.png` for the figure-only coordinate space.

2. Extract candidate fashion items:
   - Start from garments and accessories named in `source.md` and prompts.
   - Keep only visible objects that a reader can reasonably tap on the final
     visual.
   - Prefer editorially strong items: silhouette-defining outerwear, top,
     bottom, dress, bag, shoes, accessories, hair/makeup choices, or a prop that
     clearly carries the scene.

3. Choose 4-6 strong items:
   - Five items is the current house default.
   - Do not fill weak hotspots just to hit a higher count.
   - If an object is visible but not fashion-relevant, omit it unless it shapes
     the outfit story. When it is kept, use `other` intentionally.

4. Confirm visually:
   - Check `main-visual.png` for what the reader actually sees.
   - Check `character-transparent.png` for the normalized `anchor` coordinate.
   - If generated art contradicts the prompt, trust the image, not the prompt.

5. Place `anchor` coordinates:
   - `anchor` is `[x, y]`, normalized to the
     `character-transparent.png` canvas.
   - `x=0` is the left edge, `x=1` is the right edge.
   - `y=0` is the top edge, `y=1` is the bottom edge.
   - Place anchors at the readable center of the item, not at the geometric
     center of the full garment if the visible/tappable part is elsewhere.
   - Revise anchors after a visual check; do not compensate in frontend code.

6. Write bilingual commentary:
   - Every user-facing field must have both `ja` and `zh`.
   - Japanese should read like quiet editorial styling commentary.
   - Chinese should preserve meaning and fashion judgment without adding facts
     not present in the Japanese/source material.
   - `expression` must stay within supported hints: `neutral`, `smile`,
     `thinking`.

7. Validate:
   - Run `npm run commentary:validate`.
   - Fix any reported pack/field path.
   - The same command refreshes `docs/commentary-audit.md`.

## Schema Contract

Required top-level fields:

```json
{
  "schemaVersion": "commentary-bilingual-v1",
  "defaultLocale": "ja",
  "title": { "ja": "...", "zh": "..." },
  "character": {
    "name": { "ja": "...", "zh": "..." },
    "intro": { "ja": "...", "zh": "..." }
  },
  "intro": { "ja": "...", "zh": "...", "expression": "smile" },
  "items": [],
  "runwayIntro": { "ja": "...", "zh": "...", "expression": "neutral" }
}
```

Required item fields:

```json
{
  "id": "ivory-structured-blazer",
  "part": "jacket",
  "anchor": [0.54, 0.34],
  "expression": "neutral",
  "name": { "ja": "...", "zh": "..." },
  "tags": { "ja": ["..."], "zh": ["..."] },
  "text": { "ja": "...", "zh": "..." }
}
```

`part` is a finite enum:

- `jacket`
- `top`
- `bottom`
- `dress`
- `bag`
- `shoes`
- `accessory`
- `hair`
- `makeup`
- `other`

Use `jacket` for coats, cardigans, windbreakers, and other outerwear because the
current frontend only needs a stable outerwear bucket. Use `other` for books,
umbrellas, bottles, cups, and other narrative props.

Supported `expression` hints:

- `neutral`
- `smile`
- `thinking`

If a new expression hint is added later, update both the data validator and the
runtime `EXPRESSION_HINTS` mapping before using it in commentary.

## Optional Fields

All optional fields are backward-compatible. Omitted values must not break
subtitles, swing tags, look-card, guided tour, runway, or narrative smoke.
Unknown future optional fields are allowed as authored metadata, but the current
UI must not depend on them until code support and validation rules are added.

`voice`:

- String path relative to the image pack, for example
  `"voice/item-01.ogg"`.
- If present, the file must exist.
- If absent, the app degrades to subtitles and tags. Missing voice is valid.
- Do not make voice generation or TTS training part of commentary authoring.

`emotion`:

- Non-empty string such as `"calm"`, `"confident"`, or `"soft"`.
- Reserved for later voice/acting direction.
- Current UI does not require it.

`mouth`:

- Non-empty string or object.
- Reserved for future mouth-open / mouth-closed / viseme mapping.
- Current UI does not require it.

`beat` / `focus`:

- Optional root-level metadata for Sprint 15 primary-event resolution.
- May be an event type string or metadata object.
- Supported event types are `read`, `standee`, `commentary`, `lookCard`,
  `runway`, `cover`, and `back`.
- Object metadata may include `type`, `label`, `prompt`, `emphasis`, `cue`, and
  `target`.
- Item-level `beat` / `focus` can be authored as future metadata, but current
  narrative resolution reads the commentary-level field.

## Compatibility Rules

- New or edited commentary must not require `magazineScene.js` changes.
- Card and narrative availability must continue to come from module-level
  commentary helpers, not runtime `this.standees`.
- The DOM `鑑賞` layer reads printed `main-visual.png`; WebGL-only variants do
  not change commentary semantics.
- A pack with no `voice` directory is valid.
- Schema normalization should be semantic-preserving: fix enum drift such as
  `coat` -> `jacket` or `prop` -> `other`, but do not rewrite copy for taste.
