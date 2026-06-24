# SPRINT 18 — Voice Frontend Integration and Lip-Sync

> Active contract for `multi-ralph` Sprint 18. Use this file with
> `--sprint docs/plans/SPRINT18.md`; do not use the historical
> `docs/plans/SPRINT.md` contract for this sprint.

## Product Context

- Product: ATELIER アトリヱ, a Three.js 3D fashion magazine.
- Stack: Vite 8 + React 19 + Three.js 0.184 + page-flip 2.0.7.
- Current baseline: bilingual `commentary.json` per pack (schema reserves optional
  `voice` / `emotion` / `mouth`), look-card / tour / runway / narrative beats are
  wired, and there is an existing WebAudio bus in `magazineScene.js`
  (`this.audio.ctx`, `this.audio.buffers`, gain nodes, room-tone playback) that
  already degrades silently when audio files are missing.
- Sprint 18 goal: make **voice an optional enhancement layer** on top of the
  existing commentary/caption system — never a hard dependency.

## Reality Constraints (read before scoping)

- There are **zero voice assets** today: no `assets/image-packs/*/voice/` dirs,
  `commentary.json` `voice` usage = 0, and `public/audio/` does not exist.
  Sprint 17 (deferred) produces real audio. Therefore Sprint 18 ships the
  **frontend mechanism + graceful degradation**, verified with a **synthetic
  AudioBuffer**, not real voice files.
- Expression sheets currently have **no dedicated mouth-open / mouth-closed
  cells** (only a blink/closed-eyes cell, `BLINK_CELL = 2`). Lip-sync must be a
  mechanism that **degrades to no animation** when an item has no `mouth` cell
  mapping. Do not force mouth flicker on assets that lack mouth cells, and do not
  fail this sprint for "no visible mouth movement" on current art.

## Scope

In scope:

- A voice playback path: resolve an item's optional `voice` to a build-time URL,
  decode through the existing WebAudio bus, duck room tone during playback,
  and stop cleanly on interruption.
- Browser autoplay handling: never throw before the first user gesture; unlock /
  resume the AudioContext on first gesture; after that, voice plays.
- Subtitle binding: caption shows when a line starts and fades 0.6–1.2 s after it
  ends; it is cleared immediately on page turn, gallery open, look-card open,
  startShow / endShow, and standee fold.
- Lip-sync mechanism: an `AnalyserNode` RMS amplitude drives a two-frame
  mouth-closed / mouth-open toggle **only when the item provides a mouth cell
  mapping**; otherwise subtitles only, no forced animation.
- Debounce / de-dup: repeated taps on the same hotspot do not stack overlapping
  voices; a new line interrupts the previous one.
- A repeatable voice smoke that exercises the real pipeline with a synthetic
  buffer.

Out of scope:

- TTS training, voice generation, or committing any real / placeholder voice
  binary into the repo (Sprint 17).
- Generating new expression sheets with mouth cells (next asset round).
- A voice settings UI (volume sliders, per-character toggles). First version is
  only: play if audio exists / unlock on first gesture / degrade if absent.
- Changing tone mapping, Bokeh default, DOM `鑑賞`, WebGL variants, camera
  framing, or narrative beats.

## Tasks

- [x] S18-BUS-1: Voice channel on the existing WebAudio bus
  - Goal: Play an optional per-line voice through the current audio bus without
    rebuilding it, with room-tone ducking and clean teardown.
  - Acceptance:
    - Item / intro / runwayIntro optional `voice` resolves to a URL via a
      build-time glob (e.g. `import.meta.glob('../assets/image-packs/*/voice/*')`),
      mirroring how page images resolve; a missing file resolves to null, not a
      broken fetch.
    - Voice plays on its own gain node; room tone is ducked while a voice is
      active and restored after it ends.
    - Starting a new line stops the previous voice; rapid repeat taps are
      debounced and never stack.
    - `dispose()` stops any active voice, disconnects nodes, and leaves no timer
      or AudioContext leak.

- [x] S18-AUTOPLAY-1: Autoplay-safe unlock
  - Goal: Respect browser autoplay restrictions without console errors.
  - Acceptance:
    - Before the first user gesture, attempting voice never throws; it no-ops or
      queues to the gesture.
    - The AudioContext is resumed / unlocked on the first user gesture; after
      that, voice plays normally.
    - This reuses the existing audio-unlock path if one exists rather than adding
      a second competing unlock.

- [x] S18-SUBTITLE-1: Subtitle binding and cleanup
  - Goal: Tie captions to voice start/stop and never leave a stale subtitle.
  - Acceptance:
    - A line's caption appears when its voice starts (or immediately, when there
      is no voice) and fades 0.6–1.2 s after the line ends.
    - Caption and any pending fade timer are cleared immediately on: page turn,
      gallery (鑑賞) open, look-card open, startShow, endShow, standee fold, and
      tour advance.
    - With no voice, behavior matches today's subtitle/tag timing (no regression).

- [x] S18-LIPSYNC-1: Amplitude-driven mouth toggle (degrading)
  - Goal: Drive a two-frame mouth toggle from voice amplitude when mouth cells
    exist; otherwise do nothing visible.
  - Acceptance:
    - When an item supplies a mouth cell mapping (optional `mouth`), an
      `AnalyserNode` RMS above/below a threshold toggles mouth-closed /
      mouth-open on the expression card, without fighting blink/expression hints.
    - When no mouth mapping exists, the card shows the normal expression and no
      mouth flicker is forced (current-asset path).
    - reduced-motion: voice audio still plays, but mouth/expression rapid toggling
      is disabled (frozen frame).

- [x] S18-DEGRADE-1: Voice-absent degradation
  - Goal: Prove the system is unchanged when no voice files exist (today's state).
  - Acceptance:
    - With zero voice assets, subtitles, swing tags, look-card, tour, runway, and
      narrative beats all work exactly as before.
    - No console error is produced by the voice layer when assets are absent or
      when autoplay is blocked.
    - `npm run narrative:smoke` continues to pass.

- [x] S18-VERIFY-1: Voice smoke and roadmap closeout
  - Goal: Leave reproducible evidence the voice pipeline works end-to-end without
    real assets.
  - Acceptance:
    - A repeatable command (e.g. `npm run voice:smoke`, real Chrome via CDP like
      the existing smokes) feeds a **synthetic AudioBuffer** (generated in-page,
      no committed binary) through the real voice path and asserts: gesture
      unlock works, the caption shows then clears, the analyser produces non-zero
      RMS, mouth toggles iff a mouth mapping is present, and a mid-line page turn
      stops audio and clears the caption.
    - `npm run build`, `npm run commentary:validate`, `npm run asset:audit`
      (WebGL variant drift clean), and `npm run narrative:smoke` all pass.
    - `docs/FUTURE.md` marks Sprint 18 complete or explicitly defers any residue
      (e.g. visible lip-sync awaiting mouth-cell assets in a later round).
    - `docs/project_structure.md` is updated for any new script.

## Pitfalls To Respect

- `voice` is optional and absent today. Never make it required; missing voice must
  not break subtitles, tags, look-card, tour, runway, or narrative smoke.
- Do not commit any voice/audio binary (real or placeholder). Verify with a
  synthetic in-page AudioBuffer instead.
- Do not force mouth animation on assets without mouth cells, and do not fail the
  sprint for "no visible mouth movement" on current art.
- Resolve voice URLs at build time (glob), never by fetching a hand-built path
  string that may 404.
- Reuse the existing `this.audio` bus, gain structure, and any existing unlock
  path; do not stand up a second AudioContext or a competing unlock handler.
- Respect the seven-state matrix (`state` / `turn` / `show` / `tour` / `gallery` /
  `lookCard` / `peel`): a voice/caption must be torn down on every transition that
  already tears down captions today.
- reduced-motion disables mouth/expression rapid toggling but must not disable
  audio itself.
- Do not regress DOM `鑑賞` (real `<img>`), Bokeh disabled default,
  NeutralToneMapping, WebGL variant drift, or Sprint 15 narrative beats.

## Verification Commands

```powershell
npm run build
npm run voice:smoke
npm run narrative:smoke
npm run commentary:validate
npm run asset:audit
Select-String -Path 'src/magazineScene.js' -Pattern 'this.bokehPass.enabled = false'
Select-String -Path 'src/render-config.js' -Pattern 'NeutralToneMapping'
Select-String -Path 'docs/FUTURE.md' -Pattern 'Sprint 18'
git diff --check
```
