# State Matrix — Sprint 15

This matrix records how ATELIER handles the seven active interaction states:
`state`, `turn`, `show`, `tour`, `gallery`, `lookCard`, and `peel`.

## State Vocabulary

| State | Meaning | Owner |
|---|---|---|
| `state` | Magazine pose: `closed`, `open`, `turning`, `closing`, or `closedBack`. | `MagazineScene.state` |
| `turn` | Active page turn or drag-settle animation. | `this.turn` |
| `show` | Runway dim/video state. | `this.show` |
| `tour` | Guided commentary tour across outfit items. | `this.tour` |
| `gallery` | DOM `鑑賞` reading overlay, using real `<img>` pages. | `this.gallery` |
| `lookCard` | Paper look-card overlay. | `this.lookCard` |
| `peel` | Lightweight hover/drag page preview before a committed turn. | `this.peel` |

## Entry Policy

| Entry | `state` guard | `turn` | `show` | `tour` | `gallery` | `lookCard` | `peel` |
|---|---|---|---|---|---|---|---|
| Page turn / drag | Requires `state === "open"` and a flippable side. | Owns it. | Return. | Ends tour before acting through pointer path. | Return; gallery owns input. | Return; card owns keyboard/pointer. | Owns it. |
| `toggleGallery` / `鑑賞` | Allows `open`, `closed`, `closedBack`. | Clears the full turn object before opening. | Return. | Closes tour. | Closes if already open. | Closes look-card before opening. | Clears peel. |
| `openLookCard` | Requires a commentary-bearing spread. | Return. | Return. | Closes tour. | Closes gallery first. | Retargets existing card. | Clears peel. |
| `startTour` | Requires `open`, risen commentary standee. | Return. | Return. | Return if already touring. | Return. | Return. | No queue; current peel is ignored by guard. |
| `startShow` | Requires risen video standee. | Return. | Return if already showing. | Closes tour. | Return. | Return. | Clears peel. |
| Discovery cue | Does not mutate 3D state. | No queue. | Return. | Return. | Return. | Return. | No queue. |
| Gallery landing | Writes back through `applyGalleryLanding`. | Already cleared on entry. | Not applicable. | Already closed. | Closes overlay. | Not applicable. | Fold current standees before landing. |

## Sprint 15 Additions

- `narrativeBeatIndex()` resolves exactly one primary event per spread from optional `commentary.json` `beat` / `focus` metadata or deterministic fallback.
- `syncNarrativeBeat()` is display-only: it updates a small HUD beat chip and control emphasis, but it never queues turns, shows, cards, gallery transitions, or preference writes.
- Discovery cues are per-session (`discoverySeen`) and are skipped while `show`, `tour`, `gallery`, or `lookCard` owns the experience.
- Reduced-motion users do not receive animated discovery control emphasis; the grain pass remains disabled under reduced motion.

## Smoke Coverage

`npm run narrative:smoke` covers:

- Pure resolver behavior without WebGL.
- Deep link landing with nested `item`.
- DOM `鑑賞` gallery opening and landing with real `<img>` pages.
- Look-card open/close.
- Guided tour on a risen commentary standee.
- Runway show on a risen video standee.
- Reduced-motion narrative HUD without discovery animation classes.
