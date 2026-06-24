import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PageFlip } from "page-flip";
import { loadPreferences, savePreferences } from "./preferences.js";
import { parseDeepLink, hasDeepLinkState, buildShareUrl } from "./deeplink.js";
import {
  buildSpreadCommentaryIndex,
  spreadHasCommentary,
  buildCardViewModel,
  isItemInRange,
} from "./lookCard.js";
import {
  buildNarrativeBeatIndex,
  narrativeEventText,
} from "./narrativeBeats.js";
import { RENDER } from "./render-config.js";
import { voiceUrlFor } from "./voice.js";

const coverFrontUrl = new URL("../assets/image/cover.png", import.meta.url).href;
const backCoverUrl = new URL("../assets/image/back-cover.png", import.meta.url).href;

// S18-BUS-1: walk a commentary object and attach a build-time-resolved
// `voiceUrl` (or null) to every line that can speak — `intro`, each `item`,
// and `runwayIntro`. The optional `voice` field is a pack-relative path; with
// zero voice assets today every resolution is null, so this is a pure no-op
// decoration that keeps the rest of the pipeline (look card, narrative beats)
// untouched. Lines are shallow-cloned so the shared eager-glob JSON is never
// mutated. `mouth` is passed through unchanged for the lip-sync layer.
// Declared before the PAGE_PACKS IIFE below, which calls it at module load.
const resolveLineVoice = (line, packId) => {
  if (!line || typeof line !== "object") return line;
  return { ...line, voiceUrl: voiceUrlFor(packId, line.voice) };
};
const decorateCommentaryVoice = (commentary, packId) => {
  if (!commentary || typeof commentary !== "object") return commentary;
  const next = { ...commentary };
  if (commentary.intro) next.intro = resolveLineVoice(commentary.intro, packId);
  if (commentary.runwayIntro) {
    next.runwayIntro = resolveLineVoice(commentary.runwayIntro, packId);
  }
  if (Array.isArray(commentary.items)) {
    next.items = commentary.items.map((item) => resolveLineVoice(item, packId));
  }
  return next;
};

// Interior pages come from asset packs: every numeric folder under
// assets/image-packs is one page, in numeric order. DOM reading keeps canonical
// PNG page prints; WebGL-only standee/display art uses generated WebP variants.
const packReaderFileUrls = import.meta.glob("../assets/image-packs/*/images/main-visual.png", {
  eager: true,
  query: "?url",
  import: "default",
});
const packWebglFileUrls = import.meta.glob(
  "../assets/image-packs/*/images-webgl/{background-only,character-transparent,expression-sheet,expression-sheet-transparent,action-sheet-transparent}.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
const packVideoUrls = import.meta.glob("../assets/video/*.mp4", {
  eager: true,
  query: "?url",
  import: "default",
});
const packCommentaryData = import.meta.glob("../assets/image-packs/*/commentary.json", {
  eager: true,
  import: "default",
});

const PAGE_PACKS = (() => {
  const packs = new Map();
  for (const [path, url] of Object.entries(packReaderFileUrls)) {
    const match = path.match(/image-packs\/(\d+)\/images\/main-visual\.png$/);
    if (!match) continue;
    const id = Number(match[1]);
    if (!packs.has(id)) packs.set(id, { id });
    packs.get(id)["main-visual"] = url;
  }
  for (const [path, url] of Object.entries(packWebglFileUrls)) {
    const match = path.match(/image-packs\/(\d+)\/images-webgl\/([\w-]+)\.webp$/);
    if (!match) continue;
    const id = Number(match[1]);
    if (!packs.has(id)) packs.set(id, { id });
    packs.get(id)[match[2]] = url;
  }
  for (const [path, url] of Object.entries(packVideoUrls)) {
    const match = path.match(/video\/(\d+)\.mp4$/);
    if (!match) continue;
    const pack = packs.get(Number(match[1]));
    if (pack) pack.video = url;
  }
  for (const [path, data] of Object.entries(packCommentaryData)) {
    const match = path.match(/image-packs\/(\d+)\/commentary\.json$/);
    if (!match) continue;
    const pack = packs.get(Number(match[1]));
    // S18-BUS-1: decorate each commentary line (intro / items / runwayIntro)
    // with a build-time-resolved `voiceUrl` (null today — no voice assets). The
    // glob lookup runs once at module load, mirroring page-image resolution; the
    // original commentary JSON is never mutated (the index data is frozen/shared
    // with the look-card + narrative modules), so we shallow-clone the lines we
    // touch and leave everything else untouched.
    if (pack) pack.commentary = decorateCommentaryVoice(data, Number(match[1]));
  }
  return [...packs.values()]
    .filter((pack) => pack["main-visual"])
    .sort((a, b) => a.id - b.id);
})();

const imagePageUrls = PAGE_PACKS.map((pack) => pack["main-visual"]);

// Pop-up standees: pages whose pack carries a transparent figure plus a
// figure-less background. Expression sheets and a runway video are optional.
const STANDEE_SOURCES = PAGE_PACKS.map((pack, index) =>
  pack["character-transparent"] && pack["background-only"]
    ? {
        page: index,
        figure: pack["character-transparent"],
        background: pack["background-only"],
        expressions: pack["expression-sheet-transparent"] ?? pack["expression-sheet"] ?? null,
        expressionsCutout: !!pack["expression-sheet-transparent"],
        actions: pack["action-sheet-transparent"] ?? null,
        video: pack.video ?? null,
        commentary: pack.commentary ?? null,
      }
    : null,
).filter(Boolean);
const STANDEE_STAND_ANGLE = 1.47;
// expression sheets are a 3x2 grid; cell 2 (top right) is the closed-eyes cut
const EXPRESSION_COLS = 3;
const EXPRESSION_ROWS = 2;
const EXPRESSION_CELLS = EXPRESSION_COLS * EXPRESSION_ROWS;
const BLINK_CELL = 2;
// commentary expression hints map onto the 3x2 sheet cells: cell 0 calm/neutral,
// cell 1 soft smile, cell 2 the contemplative look-aside (verified across packs 1/5/8).
const EXPRESSION_HINTS = { neutral: 0, smile: 1, thinking: 2 };

const textJa = (field) => (field && (field.ja ?? field.zh)) || "";
const textZh = (field) => (field && (field.zh ?? field.ja)) || "";
// Pick a bilingual field by the active locale, falling back to the other side
// so a one-sided data row never renders blank.
const localeText = (field, locale) =>
  locale === "zh" ? textZh(field) : textJa(field);

const TEXTURES = {
  wood: {
    color: "/pbr/wood_0066/wood_0066_color_2k.jpg",
    roughness: "/pbr/wood_0066/wood_0066_roughness_2k.jpg",
    // Sprint 13b: runtime normal maps are 1024px variants; public filenames
    // stay `_2k` to preserve existing URLs. See docs/resource-pipeline.md.
    normal: "/pbr/wood_0066/wood_0066_normal_opengl_2k.png",
    ao: "/pbr/wood_0066/wood_0066_ao_2k.jpg",
  },
  paper: {
    color: "/pbr/paper_0026/paper_0026_color_2k.jpg",
    roughness: "/pbr/paper_0026/paper_0026_roughness_2k.jpg",
    // Sprint 13b: runtime normal maps are 1024px variants; public filenames
    // stay `_2k` to preserve existing URLs. See docs/resource-pipeline.md.
    normal: "/pbr/paper_0026/paper_0026_normal_opengl_2k.png",
    ao: "/pbr/paper_0026/paper_0026_ao_2k.jpg",
  },
};

// Blocking load: PBR maps, both covers, and the first spread. The remaining
// pages stream in the background while the intro plays.
const LOADER_ITEMS = 12;

const AUDIO_SOURCES = {
  pageTurn: ["/audio/page-turn-01", "/audio/page-turn-02", "/audio/page-turn-03"],
  coverOpen: ["/audio/cover-open"],
  coverClose: ["/audio/cover-close"],
  roomTone: ["/audio/room-tone"],
};

// S18 voice channel tuning.
const ROOM_TONE_GAIN = 0.05; // looped ambience resting level
const ROOM_TONE_DUCK = 0.35; // multiplier applied to ambience while a voice plays
const VOICE_GAIN = 0.9; // per-voice playback gain
// Caption fade-out window after a line ends (spec: 0.6–1.2 s). A subtitle that
// has no voice still uses the existing 6.5 s auto-hide; this timer governs the
// "fade N ms after the voice finished" path only.
const VOICE_CAPTION_FADE_MS = 900;
// Repeated taps on the same hotspot within this window are debounced: the line
// is already (or just) speaking, so a re-tap must not stack a second voice.
const VOICE_RETAP_DEBOUNCE_MS = 280;
// Lip-sync RMS threshold (0..1) above which the mouth reads as "open".
const MOUTH_RMS_THRESHOLD = 0.06;

const PAGE_WIDTH = 1.18;
const PAGE_HEIGHT = 2.1;
const PAGE_SURFACE_Y = 0.076;
const COVER_Y = 0.09;
const COVER_OPEN_Y = 0.062;
const TURN_BASE_Y = PAGE_SURFACE_Y + 0.0085;
const MAGAZINE_X = -0.36;

const LEAF_SEGMENTS = 28;
const LEAF_BEND = 0.46;
const LEAF_BEND_EXP = 1.55;
// The back cover is stiff board, not paper: it barely flexes when turned.
const BOARD_BEND_SCALE = 0.22;
const PEEL_AMOUNT = 0.024;
// hover invitation only near the outer edge, where a hand would grab the page
const PEEL_GRAB_ZONE = PAGE_WIDTH * 0.6;
const DRAG_COMMIT = 0.3;
const DRAG_COMMIT_VELOCITY = 0.9;

const MATERIAL_VISUALS = {
  printed: {
    fiberStrength: 0.018,
    inkContrast: 0.048,
    edgeShade: 0.045,
  },
  paper: {
    fiberStrength: 0.014,
    inkContrast: 0.0,
    edgeShade: 0.026,
  },
  standee: {
    rim: 0.09,
    alphaSoftLow: 0.20,
    alphaSoftHigh: 0.82,
  },
  turn: {
    shadow: 0.18,
    highlight: 0.12,
  },
};

const UP_AXIS = new THREE.Vector3(0, 1, 0);
const RIG_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"];

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    // VIS-GRAIN (Sprint 6 / Iter 1):
    //   uAmount  0.042 → 0.030 (Evo 0.024 + Res keep 0.042 → conservative mid)
    //   uVignette 0.48 → 0.32  (two of three reviewers — flat-lay photo norm
    //                            0.1–0.2; 0.48 read as cinematic-dark and
    //                            fought the "lift integrating brightness" goal)
    // VIS-VIGNETTE-RIM (Sprint 6 / Iter 2): 0.32 → 0.20. With VIS-SRGB-FIX bg
    // truly lighting up, 0.32 was pulling the just-lit corners back in. 0.20
    // is mid of Evo + Research (both 0.20; Experience pushed 0.12 — judged
    // too aggressive against the fresh sRGB headroom). applyShowDim's runway
    // base must move in lockstep (now 0.20 + 0.3 = 0.50, was 0.32 + 0.3).
    // applyShowDim still pulls vignette up by +0.3 for runway (now 0.20→0.50).
    //
    // TECH-1 (Sprint 6 / Iter 3): both values now read from render-config.js,
    // so this default and applyShowDim's runway base are physically locked to
    // one source of truth (no more silent desync).
    uAmount: { value: RENDER.grain.amount },
    uVignette: { value: RENDER.grain.vignette },
    uGradeWarmth: { value: RENDER.grade.warmth },
    uGradeContrast: { value: RENDER.grade.contrast },
    uGradeSaturation: { value: RENDER.grade.saturation },
    uGradeToe: { value: RENDER.grade.toe },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    uniform float uVignette;
    uniform float uGradeWarmth;
    uniform float uGradeContrast;
    uniform float uGradeSaturation;
    uniform float uGradeToe;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 43.7) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grain = hash(vUv * vec2(1287.0, 718.0)) - 0.5;
      color.rgb += grain * uAmount;
      float d = distance(vUv, vec2(0.5, 0.46));
      color.rgb *= 1.0 - smoothstep(0.40, 0.94, d) * uVignette;
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, uGradeSaturation);
      color.rgb = mix(color.rgb, (color.rgb - 0.5) * (1.0 + uGradeContrast) + 0.5, 0.65);
      color.rgb += vec3(uGradeWarmth, uGradeWarmth * 0.45, -uGradeWarmth * 0.35) * smoothstep(0.20, 0.92, luma);
      color.rgb *= 1.0 - uGradeToe * (1.0 - smoothstep(0.03, 0.38, luma));
      gl_FragColor = color;
    }
  `,
};

// Runway stage: the generated video has a pure black backdrop, so instead of
// keying it the room lights drop and the black frame melts into the dark.
const StageShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap;
    uniform float uFade;
    varying vec2 vUv;

    void main() {
      vec3 color = texture2D(uMap, vUv).rgb;
      // mask the generator watermark in the bottom-right corner
      float watermark = step(0.64, vUv.x) * step(vUv.y, 0.08);
      color *= 1.0 - watermark;
      // soften the frame edges into the dark stage
      float edge =
        smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x) *
        smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
      color *= edge;
      gl_FragColor = vec4(color * uFade, uFade);
    }
  `,
};

export class MagazineScene {
  constructor(container) {
    this.container = container;
    this.frameId = 0;
    this.lastFrameTime = 0;
    this.elapsedTime = 0;
    this.introStartTime = 0;
    this.state = "closed";
    this.introProgress = 0;
    this.introComplete = false;
    this.activeAnimation = null;
    this.turn = null;
    this.drag = null;
    this.peel = { side: null, amount: 0, target: 0, kind: "page" };
    this.spreadIndex = 0;
    this.pointerSide = "center";
    this.viewportAspect = 1;
    this.appliedWidth = 0;
    this.appliedHeight = 0;
    this.assetsReady = false;
    this.disposed = false;
    this.firstTurnDone = false;
    this.standeeHintShown = false;
    // one-shot discovery nudge once a figure has finished rising
    this.standeeGuideShown = false;
    this.guideStandee = null;
    this.loadedTextures = [];
    this.textureWarmupQueue = [];
    this.textureWarmupSet = new Set();
    this.cameraTarget = new THREE.Vector3(-0.08, 0.04, -0.05);
    this.responsiveCameraA = new THREE.Vector3();
    this.responsiveCameraB = new THREE.Vector3();
    this.responsiveCameraDesired = new THREE.Vector3();
    this.workVector = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.parallax = new THREE.Vector2();
    this.parallaxTarget = new THREE.Vector2();
    this.keys = new Set();
    this.standees = new Map();
    this.standeeLift = 0;
    this.show = null;
    this.tour = null;
    this.hudCaption = null;
    this.lightLevels = null;
    this.rig = { yaw: 0, dolly: 1, pan: 0 };
    this.rigOffset = new THREE.Vector3();
    this.rigRight = new THREE.Vector3();
    this.desiredTargetWork = new THREE.Vector3();
    this.gallery = null;
    this.lookCard = null; // CARD-1: the open look card, or null. Never persisted.
    this._spreadCommentaryIndex = null; // CARD-1: memoized spread→commentary index
    this._narrativeBeatIndex = null; // S15: memoized spread→primary narrative event
    this.primaryEventKey = null;
    this.discoverySeen = new Set();
    this.discoveryTimers = new Map();
    this.lastDiscoveryAt = 0;
    this.disposables = [];
    this.reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.audio = { ctx: null, buffers: new Map(), started: false };
    // S18 voice channel: an optional enhancement layer over the existing bus.
    //   roomToneGain — the looped ambience gain, ducked while a voice plays.
    //   voiceGain    — a dedicated gain node every voice source routes through.
    //   voiceAnalyser — taps the active voice for RMS-driven lip sync.
    //   voice        — the active voice play session (source + bookkeeping) | null.
    //   voiceUrlCache — decoded AudioBuffers keyed by URL, so a re-tap of the
    //                   same line does not re-fetch/decode.
    //   captionFadeTimer — pending caption fade-out (cleared on every teardown).
    //   lastVoiceTapAt / lastVoiceTapKey — debounce rapid repeat taps.
    this.roomToneGain = null;
    this.voiceGain = null;
    this.voiceAnalyser = null;
    this.voice = null;
    this.voiceUrlCache = new Map();
    this.voiceFreqData = null;
    this.captionFadeTimer = null;
    this.lastVoiceTapAt = 0;
    this.lastVoiceTapKey = null;
    this.activeMouthCard = null;
    this.lastVoiceRms = 0;

    // Persisted preferences (locale / skip-intro / last spread). Read once up
    // front; every later write goes through savePreferences so the on-disk blob
    // and this.prefs stay in lockstep. Falls back to defaults if storage is
    // unavailable or corrupt (see preferences.js).
    this.prefs = loadPreferences();
    this.locale = this.prefs.locale; // "ja" (default) | "zh"

    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.animate = this.animate.bind(this);
  }

  start() {
    void this.initialize();
  }

  async initialize() {
    try {
      this.createLoader();
      this.createRenderer();
      this.createScene();
      this.createCamera();
      this.createPostProcessing();
      if (import.meta.env.DEV) {
        window.__magazineScene = this;
      }
      await this.loadTextures();
      if (this.disposed) return;

      this.createLights();
      this.createTable();
      this.createMagazine();
      this.createDust();
      this.createHud();
      this.handleResize();
      this.warmTextures();
      this.assetsReady = true;
      this.bindEvents();
      this.startBackgroundPageLoads();
      void this.loadStandees();
      this.introStartTime = performance.now();
      // A shared deep link (E5) wins over the local last-spread: land on its
      // encoded spread/locale temporarily (no write-back to the visitor's own
      // prefs). Only if there is no deep link do we fall back to the returning-
      // visitor restore (C9): skip the cinematic intro and land on the last
      // spread. Both run after the magazine geometry + responsive camera exist
      // (createHud / handleResize above) and before animate(), so the first
      // rendered frame is already settled rather than the closed cover.
      if (!this.applyDeepLink()) {
        this.restoreSession();
      }
      this.finishLoader();
      void this.buildColophon();
      this.animate();
    } catch (error) {
      console.error("Failed to initialize magazine scene", error);
    }
  }

  // --- Renderer, scene, camera -------------------------------------------

  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      // No MSAA: the pages are high-detail art shown small and at a grazing
      // angle, so the softness is texture-interior undersampling, which MSAA
      // cannot fix. We supersample instead (render above native, see below),
      // which anti-aliases edges and interiors both.
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    // Supersampling (SSAA). The scene at native resolution is undersampled: the
    // 2048² pages carry more detail than there are screen pixels, so fine print
    // reads soft. Render ABOVE native (up to 2×, capped at 2.0 to keep the GPU
    // cost sane) and let trackFrameQuality fall back toward native on weak GPUs.
    // The floor is native dpr: we never render below the screen (the old blur).
    this.dpr = window.devicePixelRatio || 1;
    this.qualityFloor = this.dpr;
    this.qualityCeil = Math.min(this.dpr * 2, 2.0);
    this.pixelRatio = this.qualityCeil;
    this.renderer.setPixelRatio(this.pixelRatio);
    if (import.meta.env.DEV) {
      console.log(
        `[render] devicePixelRatio=${this.dpr} → pixelRatio ${this.pixelRatio} (native ${this.qualityFloor}, ceil ${this.qualityCeil})`,
      );
    }
    this.renderer.outputColorSpace = RENDER.renderer.outputColorSpace;
    this.renderer.toneMapping = RENDER.renderer.toneMapping;
    // VIS-LIGHT (Sprint 6 / Iter 1): exposure 0.98 → 1.02. Conservative micro-
    // lift (Res R1 wanted 1.05; we lifted env from 0.18→0.55 already so this
    // is half-step to avoid blowing out cover spec). ACES still rolls off
    // highlights so cover gloss does not clip.
    this.renderer.toneMappingExposure = RENDER.renderer.exposure;
    this.renderer.shadowMap.enabled = true;
    // VIS-SHADOWSOFT (Sprint 6 / Iter 1): PCF → PCFSoft. Old PCF had visible
    // "stepped" shadow edges on the table contact under the magazine; soft
    // PCF (4-tap PCF + bilinear) reads as paper-on-wood rather than print-
    // out-on-glass. Same map size, same cost in practice.
    //
    // BUG-SHADOWMAP-DEPRECATED (Sprint 6 / Iter 2): PCFSoftShadowMap is a
    // deprecated alias in r0.184+ (three.js #32591) that silently falls back
    // to PCFShadowMap with a console warn x2 per fresh load. The new
    // PCFShadowMap is itself the soft implementation, so withdrawing the
    // alias just silences the warn — there is no pixel-layer change (the
    // shadow edge softening Iter 1 wanted is already in effect via the new
    // PCF). Do NOT switch to VSMShadowMap: VSM needs blurSamples tuning and
    // can leak light at this shadow-map size, risk > gain. (See pitfalls.md.)
    this.renderer.shadowMap.type = RENDER.renderer.shadowType;
    // A 2048² shadow map re-rendered every frame for a near-static scene is pure
    // waste; refresh it only while a shadow caster moves (see shadowsNeedUpdate).
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.container.appendChild(this.renderer.domElement);
  }

  createScene() {
    this.scene = new THREE.Scene();
    // VIS-BG (Sprint 6 / Iter 1): bg 0x070604 → 0x18130e. The old "near black"
    // read as "screen turned off, not a warm print shop". 0x18130e is a warm
    // dark close to the cover boards so the off-page seam reads as room shadow,
    // not as void. Fog uses the same color so the horizon does not hard-cut
    // back to bg color past fog.far.
    //
    // VIS-SRGB-FIX (Sprint 6 / Iter 2): with THREE.ColorManagement.enabled=true
    // (r0.184 default), `new THREE.Color(hex)` treats the hex as sRGB input and
    // converts to linear; combined with ACES tonemap (low-end S-curve crush)
    // and the OutputPass sRGB encode, dark values like 0x18130e were measured
    // at runtime as RGB ~(2,1,1) instead of the expected ~(24,19,14). Declare
    // this hex as already-linear via `Color.setHex(hex, LinearSRGBColorSpace)`
    // so the round-trip lands on the source-intent value. This applies to
    // background / fog / material.color (the OutputPass path); light.color is
    // intentionally NOT changed (it feeds PBR shader uniforms in linear space
    // — see pitfalls.md, the "light vs material hex paths" entry).
    this.scene.background = new THREE.Color().setHex(RENDER.scene.bgHex, THREE.LinearSRGBColorSpace);
    // BUG-FOG-NEAR (Sprint 6 / Iter 1): fog.near 5.2 > cam→lookAt distance
    // ~4.73m, so the entire scene was inside fog.near (= fog inactive). With
    // cameraOpen at (MAGAZINE_X, 2.96, 3.72) → targetOpen (MAGAZINE_X, 0.07,
    // -0.03), distance ≈ 4.73; fog.near 2.8 leaves ~1.9m focused-foreground
    // headroom and 7.5m far so the far floor blends into bg over a real range.
    //
    // VIS-FOG-FAR (Sprint 6 / Iter 3): fog.far 7.5 → 9.0 to soften the band
    // jump near the far floor (Experience measured max adjacent-band lum diff
    // 17 at Iter 2; target ≤12). near=2.8 unchanged (still < cam→lookAt).
    const fogColor = new THREE.Color().setHex(RENDER.scene.fogHex, THREE.LinearSRGBColorSpace);
    this.scene.fog = new THREE.Fog(fogColor, RENDER.scene.fogNear, RENDER.scene.fogFar);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envTarget.texture;
    // VIS-LIGHT (Sprint 6 / Iter 1): environmentIntensity 0.18 → 0.55. Three-
    // way reviewer consensus: 0.18 makes the IBL functionally decorative; PBR
    // baseline (Marmoset / Filament) is env ≈ 0.6–1.0 as the main fill before
    // any directional. Bringing this up first lets us *lower* directional/
    // pool spot relative cost while still hitting the brightness target.
    this.scene.environmentIntensity = RENDER.scene.envIntensity;
    this.disposables.push(envTarget.texture, envTarget);
    pmrem.dispose();
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.cameraStart = new THREE.Vector3(0.18, 3.35, 5.6);
    // Closed-cover framing pushed in a touch (z 3.08 -> 2.86, y 2.32 -> 2.28)
    // so the cover has more presence on the first screen; the masthead still
    // clears the top edge. The intro lerps here, so it settles closer too.
    this.cameraClosed = new THREE.Vector3(-0.12, 2.28, 2.86);
    this.cameraClosedBack = new THREE.Vector3(MAGAZINE_X - 0.24, 2.28, 2.86);
    // Original distance: pushing closer exaggerates depth perspective and
    // makes the tall page ratio read even longer than it is.
    this.cameraOpen = new THREE.Vector3(MAGAZINE_X, 2.96, 3.72);
    this.targetStart = new THREE.Vector3(-0.16, 0.02, -0.02);
    this.targetClosed = new THREE.Vector3(MAGAZINE_X + 0.55, 0.1, -0.04);
    this.targetClosedBack = new THREE.Vector3(MAGAZINE_X - 0.55, 0.1, -0.04);
    this.targetOpen = new THREE.Vector3(MAGAZINE_X, 0.07, -0.03);
    this.camera.position.copy(this.cameraStart);
    this.camera.lookAt(this.targetStart);

    // Portrait framing: narrow viewports must dolly back and recenter on the
    // magazine, otherwise the cover (and especially the landscape spread) spill
    // past the screen edges. Tuned against a 375x812 phone (aspect ~0.46).
    //
    // Design note (P2-B): we deliberately frame the *whole* spread on portrait
    // rather than reframing to a single page. A single-page 3D reframe would
    // fight the "magazine lying on a table" identity and the page-turn
    // animation, and it would duplicate the 鑑賞 reading overlay, which already
    // gives device-neutral, zoomable, page-at-a-time reading (see toggleGallery
    // / galleryEntries). Whole-spread-in-frame + 鑑賞 is the reading path.
    this.baseFov = this.camera.fov; // 34
    this.portraitAspect = 0.92; // below this aspect, start adapting
    this.portraitRange = 0.58; // aspect span over which the effect ramps to full
    this.portraitFovGain = 24; // widen FOV on portrait (cheaper than distance)
    this.portraitPullY = 0.3; // extra height (look down a touch more)
    this.portraitPullZ = 1.3; // extra distance
    this.portraitRecenter = 0.7; // how far the look slides toward magazine center
  }

  createPostProcessing() {
    // Default composer target (HalfFloat, for ACES precision in OutputPass).
    // No MSAA samples here: anti-aliasing comes from supersampling (pixelRatio
    // above native), and an MSAA buffer on top of that at high pixelRatio would
    // cost far too much memory for what it adds.
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 4.1,
      aperture: 0.00012,
      maxblur: 0.0075,
    });
    // Off by default: the magazine sits on the focus plane so DoF only softens
    // the far floor (on/off looks nearly identical), yet it is the priciest
    // per-frame pass and scales with the supersampled pixel count. Kept in the
    // chain (disabled passes are skipped) so it is a one-line toggle to restore.
    this.bokehPass.enabled = false;
    this.composer.addPass(this.bokehPass);

    this.grainPass = new ShaderPass(GrainShader);
    // BUG-GRAIN-RM: when reduced-motion is on, the previous animate-loop only
    // froze uTime — but the noise hash is keyed on (vUv, uTime), so a frozen
    // uTime leaves a stuck pattern of static dots over every frame (worse than
    // moving grain, violates reduced-motion intent). Disable the pass entirely
    // here — applyShowDim's vignette lerp during runway dim is also skipped,
    // which is the accepted cost (reduced-motion users opt out of effects).
    this.grainPass.enabled = !this.reducedMotion;
    this.composer.addPass(this.grainPass);
    this.composer.addPass(new OutputPass());
  }

  // --- Asset loading -------------------------------------------------------

  async loadTextures() {
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onProgress = (url, itemsLoaded) => {
      this.setLoaderProgress(itemsLoaded / LOADER_ITEMS);
    };
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    // Print/figure art decodes off the main thread via ImageBitmap to avoid
    // open-time jank. imageOrientation:'flipY' reproduces the default texture
    // orientation so we can leave texture.flipY off (flipY is ignored for
    // ImageBitmap anyway, and setting it false silences the warning).
    this.bitmapLoader = new THREE.ImageBitmapLoader(this.loadingManager);
    this.bitmapLoader.setOptions({ imageOrientation: "flipY" });
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    ([
      this.woodColor,
      this.woodRoughness,
      this.woodNormal,
      this.woodAo,
      this.paperColor,
      this.paperRoughness,
      this.paperNormal,
      this.paperAo,
    ] = await Promise.all([
      this.loadTexture(TEXTURES.wood.color, { color: true, repeat: [3.2, 2.4] }),
      this.loadTexture(TEXTURES.wood.roughness, { repeat: [3.2, 2.4] }),
      this.loadTexture(TEXTURES.wood.normal, { repeat: [3.2, 2.4] }),
      this.loadTexture(TEXTURES.wood.ao, { repeat: [3.2, 2.4] }),
      this.loadTexture(TEXTURES.paper.color, { color: true, repeat: [1.2, 1.8] }),
      this.loadTexture(TEXTURES.paper.roughness, { repeat: [1.2, 1.8] }),
      this.loadTexture(TEXTURES.paper.normal, { repeat: [1.2, 1.8] }),
      this.loadTexture(TEXTURES.paper.ao, { repeat: [1.2, 1.8] }),
    ]));

    const [coverTexture, backCoverTexture, firstPage, secondPage] = await Promise.all(
      [coverFrontUrl, backCoverUrl, imagePageUrls[0], imagePageUrls[1]].map((url) =>
        this.loadTexture(url, { color: true }),
      ),
    );

    this.coverFrontMaterial = this.createPrintedMaterial(coverTexture, 0.42, 0.08);
    this.backCoverMaterial = this.createPrintedMaterial(backCoverTexture, 0.42, 0.08);
    this.pageMaterials = new Array(imagePageUrls.length).fill(null);
    this.pageMaterials[0] = this.createPrintedMaterial(firstPage, 0.74, 0.03);
    this.pageMaterials[1] = this.createPrintedMaterial(secondPage, 0.74, 0.03);
  }

  startBackgroundPageLoads() {
    for (let i = 2; i < imagePageUrls.length; i += 1) {
      if (this.pageMaterials[i]) continue;
      void this.loadTexture(imagePageUrls[i], { color: true })
        .then((texture) => {
          if (this.disposed) return;
          this.pageMaterials[i] = this.createPrintedMaterial(texture, 0.74, 0.03);
          this.queueTextureWarmup(texture);
          // Refresh settled spreads only; mid-turn surfaces and the back-cover
          // pose are swapped by their own completion handlers.
          if (this.state === "open" || this.state === "closed") {
            this.applySpread();
          }
        })
        .catch(() => {
          /* a failed page keeps its blank paper fallback */
        });
    }
  }

  async loadTexture(url, options = {}) {
    // Non-tiling color art (covers, pages, standees) goes through the off-thread
    // ImageBitmap path; tiling PBR maps keep the plain loader so their
    // orientation and filtering stay exactly as before.
    if (options.color && !options.repeat && !options.raw && this.bitmapLoader) {
      const bitmap = await this.bitmapLoader.loadAsync(url);
      const texture = new THREE.Texture(bitmap);
      texture.flipY = false; // orientation already handled by imageOrientation:'flipY'
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.maxAnisotropy;
      texture.needsUpdate = true;
      this.loadedTextures.push(texture);
      this.disposables.push(texture);
      return texture;
    }
    const texture = await this.textureLoader.loadAsync(url);
    texture.colorSpace = options.color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = this.maxAnisotropy;
    if (options.repeat) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(options.repeat[0], options.repeat[1]);
    }
    texture.needsUpdate = true;
    this.loadedTextures.push(texture);
    this.disposables.push(texture);
    return texture;
  }

  applyPaperShader(material, config) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uPaperFiberStrength = { value: config.fiberStrength };
      shader.uniforms.uPaperInkContrast = { value: config.inkContrast };
      shader.uniforms.uPaperEdgeShade = { value: config.edgeShade };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          /* glsl */ `
#include <common>
uniform float uPaperFiberStrength;
uniform float uPaperInkContrast;
uniform float uPaperEdgeShade;
float atelierPaperHash(vec2 p) {
  return fract(sin(dot(p, vec2(41.23, 289.17))) * 43758.5453123);
}
float atelierPaperFiber(vec2 uv) {
  float longFiber = sin((uv.y * 112.0 + sin(uv.x * 31.0) * 0.85) * 6.2831853);
  float crossFiber = sin((uv.x * 74.0 + uv.y * 9.0) * 6.2831853);
  float fleck = atelierPaperHash(floor(uv * vec2(92.0, 148.0)));
  return longFiber * 0.45 + crossFiber * 0.25 + (fleck - 0.5) * 0.55;
}
`,
        )
        .replace(
          "#include <map_fragment>",
          /* glsl */ `
#include <map_fragment>
#ifdef USE_MAP
  float paperLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float inkMask = smoothstep(0.88, 0.20, paperLuma);
  float paperFiber = atelierPaperFiber(vMapUv);
  diffuseColor.rgb += paperFiber * uPaperFiberStrength * (0.42 + inkMask * 0.58);
  diffuseColor.rgb = mix(
    diffuseColor.rgb,
    (diffuseColor.rgb - 0.5) * (1.0 + uPaperInkContrast * inkMask) + 0.5,
    0.72
  );
  float paperEdge = max(abs(vMapUv.x - 0.5) * 2.0, abs(vMapUv.y - 0.5) * 2.0);
  diffuseColor.rgb *= 1.0 - smoothstep(0.80, 1.0, paperEdge) * uPaperEdgeShade;
#endif
`,
        );
    };
    material.customProgramCacheKey = () =>
      `paper-${config.fiberStrength}-${config.inkContrast}-${config.edgeShade}`;
  }

  applyStandeeShader(material) {
    const config = MATERIAL_VISUALS.standee;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uStandeeRim = { value: config.rim };
      shader.uniforms.uStandeeAlphaLow = { value: config.alphaSoftLow };
      shader.uniforms.uStandeeAlphaHigh = { value: config.alphaSoftHigh };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          /* glsl */ `
#include <common>
uniform float uStandeeRim;
uniform float uStandeeAlphaLow;
uniform float uStandeeAlphaHigh;
`,
        )
        .replace(
          "#include <map_fragment>",
          /* glsl */ `
#include <map_fragment>
#ifdef USE_MAP
  float standeeAlpha = texture2D(map, vMapUv).a;
  diffuseColor.a = smoothstep(uStandeeAlphaLow, uStandeeAlphaHigh, diffuseColor.a);
  float cutEdge = (1.0 - smoothstep(0.70, 1.0, standeeAlpha)) * smoothstep(0.18, 0.75, standeeAlpha);
  vec3 paperRim = vec3(0.070, 0.052, 0.032) + diffuseColor.rgb * 0.18;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb + paperRim, cutEdge * uStandeeRim);
#endif
`,
        );
    };
    material.customProgramCacheKey = () => `standee-soft-cutout-${config.rim}`;
  }

  createPrintedMaterial(printMap, roughness, normalStrength) {
    const material = new THREE.MeshStandardMaterial({
      map: printMap,
      roughness,
      metalness: 0,
      normalMap: this.paperNormal,
      normalScale: new THREE.Vector2(normalStrength, normalStrength),
      roughnessMap: this.paperRoughness,
      aoMap: this.paperAo,
      // VIS-ENVMAP (Sprint 6 / Iter 1): 0.32 → 0.55. Combined with env 0.55
      // (was 0.18), effective IBL reflection 0.176→0.303 — paper edges and
      // cover glints now read; previous 0.058 looked "plastic-flat". Used by
      // cover front + back + every printed page (createPrintedMaterial is
      // a one-stop). Cover roughness 0.42 stays glossier than pages 0.74 so
      // the cover gains a slight glance highlight (a positive side effect:
      // matches Phase-2 "coated paper" aspiration).
      envMapIntensity: RENDER.envMap.printed,
    });
    this.applyPaperShader(material, MATERIAL_VISUALS.printed);
    this.disposables.push(material);
    return material;
  }

  warmTextures() {
    if (typeof this.renderer.initTexture === "function") {
      this.loadedTextures.forEach((texture) => this.renderer.initTexture(texture));
    }
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  queueTextureWarmup(texture) {
    if (!texture || this.textureWarmupSet.has(texture)) return;
    this.textureWarmupSet.add(texture);
    this.textureWarmupQueue.push(texture);
  }

  drainTextureWarmupQueue(limit = 1) {
    if (!this.textureWarmupQueue.length || typeof this.renderer.initTexture !== "function") return;
    for (let warmed = 0; warmed < limit && this.textureWarmupQueue.length; warmed += 1) {
      const texture = this.textureWarmupQueue.shift();
      this.textureWarmupSet.delete(texture);
      if (texture) this.renderer.initTexture(texture);
    }
  }

  createPaperMaterial(color, roughness, normalStrength, side = THREE.FrontSide) {
    const material = new THREE.MeshStandardMaterial({
      map: this.paperColor,
      color,
      roughness,
      metalness: 0,
      normalMap: this.paperNormal,
      normalScale: new THREE.Vector2(normalStrength, normalStrength),
      roughnessMap: this.paperRoughness,
      aoMap: this.paperAo,
      // VIS-ENVMAP (Sprint 6 / Iter 1): 0.20 → 0.40. Page-back paper now
      // catches a softer share of room reflection at glancing angles — was
      // visually disconnected from the front face under low env.
      envMapIntensity: RENDER.envMap.paper,
      side,
    });
    this.applyPaperShader(material, MATERIAL_VISUALS.paper);
    this.disposables.push(material);
    return material;
  }

  // --- Lights, table, dust -------------------------------------------------

  createLights() {
    // VIS-LIGHT joint rebalance (Sprint 6 / Iter 1) — three-reviewer convergence:
    // env 0.18→0.55 now does the IBL fill (createScene); these intensities are
    // tuned so the directional/spot reshape on top of that IBL without doubling
    // brightness. Numbers chosen from Scout D-table conservative column:
    //   hemi  0.5  → 0.8   (sky/ground bounce can carry more weight now)
    //   key   2.0  → 2.6   (between Evo 3.2 and Res 2.4 — sculpts the cover)
    //   pool  34   → 28    (env doing more, spot can pull back: -18% per Evo)
    //   fill  0.32 → 0.55  (between Evo 0.8 and Res 0.5 — standee side now lit)
    //   rim   NEW  0.45    (Marmoset 3-point: back/above warm rim, no shadow)
    // All four pre-existing lights are seeded into this.lightLevels lazily on
    // first startShow (~:2346); the new rim must be registered there too, so
    // applyShowDim can lerp it down for runway and lerp back when restoring.
    // VIS-TABLE-SYM (Sprint 6 / Iter 3): hemi 0.8 → 0.95 to lift the dark
    // front-left of the wood (Experience Iter 3: FL lum 73 vs FR 131 = 1.8:1).
    // Hemi raises the whole table uniformly, so combined with the centered
    // poolLight shift below the ratio collapses toward ≤1.4:1 without
    // introducing a new light or breaking the runway 0.96-dim wiring.
    this.hemiLight = new THREE.HemisphereLight(
      RENDER.lights.hemi.skyHex,
      RENDER.lights.hemi.groundHex,
      RENDER.lights.hemi.intensity,
    );
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(RENDER.lights.key.hex, RENDER.lights.key.intensity);
    this.keyLight.position.set(-2.4, 4.8, 3.6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 10;
    this.keyLight.shadow.camera.left = -4;
    this.keyLight.shadow.camera.right = 4;
    this.keyLight.shadow.camera.top = 4;
    this.keyLight.shadow.camera.bottom = -4;
    this.scene.add(this.keyLight);

    // SpotLight physical params (distance / angle / penumbra / decay) stay as
    // literals here — Scout C-5 boundary: those are "light physics", not
    // "render baseline config", so they don't move into render-config.js.
    //
    // VIS-TABLE-SYM (Sprint 6 / Iter 3): position.x -1.1 → -0.6 to center the
    // spot above the magazine (magazine is at MAGAZINE_X = -0.36). The Iter 2
    // baseline spot was off-axis to the LEFT, so the cone's penumbra falloff
    // hit the front-left wood harder than the front-right — the wood
    // asymmetry Experience flagged. Centering it (still slightly left of
    // magazine, so the "off-axis dramatic spot" character is preserved)
    // symmetricizes the falloff. distance / angle / penumbra / decay /
    // target unchanged so the magazine's hot pool still reads as dramatic.
    this.poolLight = new THREE.SpotLight(
      RENDER.lights.pool.hex,
      RENDER.lights.pool.intensity,
      11,
      0.47,
      0.75,
      1.6,
    );
    this.poolLight.position.set(-0.6, 4.6, 1.9);
    this.poolLight.target.position.set(MAGAZINE_X, 0, -0.05);
    this.scene.add(this.poolLight, this.poolLight.target);

    this.fillLight = new THREE.DirectionalLight(RENDER.lights.fill.hex, RENDER.lights.fill.intensity);
    this.fillLight.position.set(3.8, 3.2, -2.6);
    this.scene.add(this.fillLight);

    // VIS-RIM (Sprint 6 / Iter 1): warm back/above rim per Marmoset 3-point
    // baseline. Behind the magazine, slightly above.
    // castShadow=false — an extra 2048² shadow map for a back light costs more
    // than the light gains (per Scout VIS-RIM note).
    //
    // VIS-VIGNETTE-RIM (Sprint 6 / Iter 2): intensity 0.45 → 0.9 (Evo+Research
    // mid-low). Evo measured Iter 1 rim contributing < 3% of total irradiance
    // (env 0.55 + key 2.6 + fill 0.55 + pool 28 dominated) — the back gold
    // edge on standees was effectively invisible. 2x lift keeps the rim
    // honest without overpowering ACES highlight rolloff on the cover spec.
    // Position (0.8, 3.4, -3.2) stays: 84.6° to keyLight is a textbook
    // back-light angle — Experience reviewer's "angle too small" was a misread
    // (see Scout D.2 / negotiation.md). applyShowDim and lightLevels were
    // already wired in Iter 1 (lazy capture picks the new 0.9 automatically).
    //
    // VIS-RIM-BOOST (Sprint 6 / Iter 3): 0.9 → 1.5 via render-config (Iter 3
    // cheapest path a — boost intensity, KEEP position). Experience Iter 3
    // measured rim contribution still invisible at 0.9 (no lum peak around
    // standee top, just a gradient). Position (0.8, 3.4, -3.2) preserved
    // (Iter 2 red-line: dihedral with keyLight is already a textbook back-
    // light). lightLevels lazy-captures rim.intensity on first startShow so
    // the new 1.5 will be the runway restore target automatically.
    this.rimLight = new THREE.DirectionalLight(RENDER.lights.rim.hex, RENDER.lights.rim.intensity);
    this.rimLight.position.set(0.8, 3.4, -3.2);
    this.scene.add(this.rimLight);
  }

  createTable() {
    const geometry = new THREE.PlaneGeometry(12, 8);

    const material = new THREE.MeshStandardMaterial({
      map: this.woodColor,
      roughnessMap: this.woodRoughness,
      normalMap: this.woodNormal,
      aoMap: this.woodAo,
      roughness: 0.78,
      metalness: 0,
      // VIS-WOODSEAM (Sprint 6 / Iter 1): 0.18 → 0.28. Tile seams were visible
      // on portrait because normal strength too low to break up the wood
      // repeat; lifting normal lets micro-grain (across the tile) dominate
      // over the tile period.
      normalScale: new THREE.Vector2(0.28, 0.28),
      // VIS-ENVMAP wood (Sprint 6 / Iter 1): 0.26 → 0.40. Aligned with paper-
      // back so the table picks up the warmer IBL too — was reading too matte
      // before, more "tile floor" than "wood table" under low env.
      envMapIntensity: RENDER.envMap.table,
    });
    this.disposables.push(geometry, material);

    const table = new THREE.Mesh(geometry, material);
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.015;
    table.receiveShadow = true;
    this.scene.add(table);
  }

  createDust() {
    const count = 130;
    this.dustBase = new Float32Array(count * 3);
    this.dustPhase = new Float32Array(count);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      this.dustBase[i * 3] = MAGAZINE_X + (Math.random() - 0.4) * 2.6;
      this.dustBase[i * 3 + 1] = 0.12 + Math.random() * 1.7;
      this.dustBase[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
      this.dustPhase[i] = Math.random() * Math.PI * 2;
      positions[i * 3] = this.dustBase[i * 3];
      positions[i * 3 + 1] = this.dustBase[i * 3 + 1];
      positions[i * 3 + 2] = this.dustBase[i * 3 + 2];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const sprite = document.createElement("canvas");
    sprite.width = 64;
    sprite.height = 64;
    const ctx = sprite.getContext("2d");
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 236, 200, 1)");
    gradient.addColorStop(0.4, "rgba(255, 236, 200, 0.35)");
    gradient.addColorStop(1, "rgba(255, 236, 200, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const spriteTexture = new THREE.CanvasTexture(sprite);

    const material = new THREE.PointsMaterial({
      map: spriteTexture,
      color: 0xffe9c8,
      size: 0.018,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(geometry, material, spriteTexture);

    this.dust = new THREE.Points(geometry, material);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  updateDust(elapsed) {
    if (!this.dust || this.reducedMotion) return;
    const positions = this.dust.geometry.attributes.position;
    const count = positions.count;
    for (let i = 0; i < count; i += 1) {
      const phase = this.dustPhase[i];
      positions.setX(i, this.dustBase[i * 3] + Math.sin(elapsed * 0.11 + phase) * 0.08);
      positions.setY(i, this.dustBase[i * 3 + 1] + Math.sin(elapsed * 0.07 + phase * 1.7) * 0.05);
      positions.setZ(i, this.dustBase[i * 3 + 2] + Math.cos(elapsed * 0.09 + phase) * 0.07);
    }
    positions.needsUpdate = true;
  }

  // --- Magazine construction ------------------------------------------------

  createMagazine() {
    this.pageGeometry = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT);
    // Faces that start face-down and come over the spine end up rotated 180
    // degrees in view space; pre-rotated UVs cancel that so prints land upright.
    this.pageBackGeometry = this.pageGeometry.clone();
    const backUv = this.pageBackGeometry.attributes.uv;
    for (let i = 0; i < backUv.count; i += 1) {
      backUv.setXY(i, 1 - backUv.getX(i), 1 - backUv.getY(i));
    }
    this.disposables.push(this.pageGeometry, this.pageBackGeometry);

    this.blankPageMaterial = this.createPaperMaterial(0xf6f0e4, 0.82, 0.1);
    this.colophonMaterial = null;

    this.magazine = new THREE.Group();
    this.magazine.position.set(MAGAZINE_X, 0.018, -0.03);
    this.magazine.rotation.y = -0.025;
    this.scene.add(this.magazine);

    this.createPageBlocks();
    this.createStaticPages();
    this.createCover();
    this.createTurningLeaf();
  }

  createPageBlocks() {
    const edgeMaterial = new THREE.MeshStandardMaterial({
      map: this.paperColor,
      roughnessMap: this.paperRoughness,
      normalMap: this.paperNormal,
      roughness: 0.86,
      metalness: 0,
      color: 0xf4eee3,
      normalScale: new THREE.Vector2(0.12, 0.12),
    });
    const spineMaterial = new THREE.MeshStandardMaterial({
      // VIS-EDGE-COLOR (Sprint 6 / Iter 1): 0x171311 → 0x2a2018. Near-black
      // 0x171311 read as "painted-black bootleg book edge"; 0x2a2018 is a warm
      // chocolate that still grounds the spine against the cover but no longer
      // reads as void. (Audit report named edgeMaterial; the actual offender
      // is spineMaterial — edgeMaterial 0xf4eee3 is the right paper cream.)
      //
      // VIS-SRGB-FIX (Sprint 6 / Iter 2): set via LinearSRGBColorSpace so the
      // intended chocolate hex isn't crushed back near-black by the sRGB→linear
      // → ACES → sRGB round-trip. See the createScene/background note for the
      // full chain and reasoning.
      color: new THREE.Color().setHex(0x2a2018, THREE.LinearSRGBColorSpace),
      roughness: 0.62,
      metalness: 0,
      // Lift envMap on spine to match cover's new reflectivity — keep it
      // subdued so the spine still reads darker than the cover face.
      envMapIntensity: RENDER.envMap.spine,
    });
    this.disposables.push(edgeMaterial, spineMaterial);

    const rightBlockGeometry = new THREE.BoxGeometry(PAGE_WIDTH, 0.052, PAGE_HEIGHT);
    const leftBlockGeometry = new THREE.BoxGeometry(PAGE_WIDTH, 0.026, PAGE_HEIGHT);
    const spineGeometry = new THREE.BoxGeometry(0.045, 0.082, PAGE_HEIGHT * 1.01);
    this.disposables.push(rightBlockGeometry, leftBlockGeometry, spineGeometry);

    this.rightBlock = new THREE.Mesh(rightBlockGeometry, edgeMaterial);
    this.rightBlock.position.set(PAGE_WIDTH / 2, 0.026, 0);
    this.rightBlock.castShadow = true;
    this.rightBlock.receiveShadow = true;
    this.magazine.add(this.rightBlock);

    this.leftBlock = new THREE.Mesh(leftBlockGeometry, edgeMaterial);
    this.leftBlock.position.set(-PAGE_WIDTH / 2, 0.016, 0);
    this.leftBlock.visible = false;
    this.leftBlock.castShadow = true;
    this.leftBlock.receiveShadow = true;
    this.magazine.add(this.leftBlock);

    const spine = new THREE.Mesh(spineGeometry, spineMaterial);
    spine.position.set(0, 0.044, 0);
    spine.castShadow = true;
    spine.receiveShadow = true;
    this.magazine.add(spine);
  }

  createStaticPages() {
    this.leftPage = this.createFlatPage(
      this.materialForPage(this.spreadLeftPage(0)),
      -PAGE_WIDTH / 2,
      PAGE_SURFACE_Y + 0.006,
    );
    this.rightPage = this.createFlatPage(
      this.materialForPage(this.spreadRightPage(0)),
      PAGE_WIDTH / 2,
      PAGE_SURFACE_Y + 0.006,
    );
    this.leftPage.visible = false;
    this.rightPage.visible = false;
    this.magazine.add(this.leftPage, this.rightPage);
  }

  createFlatPage(material, x, y) {
    const mesh = new THREE.Mesh(this.pageGeometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  createCover() {
    this.coverHinge = new THREE.Group();
    this.coverHinge.position.set(0, COVER_Y, 0);

    // Both faces are single-sided: backface culling decides which one shows
    // at every hinge angle, so no visibility toggling is needed mid-animation.
    this.coverFront = new THREE.Mesh(this.pageGeometry, this.coverFrontMaterial);
    this.coverFront.rotation.x = -Math.PI / 2;
    this.coverFront.position.set(PAGE_WIDTH / 2, 0.012, 0);
    this.coverFront.castShadow = true;
    this.coverFront.receiveShadow = true;

    this.coverInside = new THREE.Mesh(this.pageBackGeometry, this.pageMaterials[0]);
    this.coverInside.rotation.x = Math.PI / 2;
    this.coverInside.position.set(PAGE_WIDTH / 2, -0.012, 0);
    this.coverInside.castShadow = true;
    this.coverInside.receiveShadow = true;

    const longEdgeGeometry = new THREE.BoxGeometry(PAGE_WIDTH, 0.018, 0.02);
    const shortEdgeGeometry = new THREE.BoxGeometry(0.02, 0.018, PAGE_HEIGHT);
    // VIS-COVER-EDGE (Sprint 6 / Iter 2): 0x110f0e → 0x2a2018 + envMap 0.32 →
    // 0.4. Iter 1 lifted spineMaterial (createPageBlocks) to 0x2a2018 but
    // missed this cover edgeMaterial — same variable name, different scope
    // (the 4-edge frame around the closed cover: edgeTop/Bottom/Outer/Spine).
    // Once spineMaterial moved, this material became the only dead-black on
    // the magazine, reading as a painted bevel. Match the spine's warm
    // chocolate + envMap so the cover frame is visually continuous.
    // VIS-SRGB-FIX (Sprint 6 / Iter 2): set via LinearSRGBColorSpace, same
    // reason as bg/spine — non-map hex on a material.color path.
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHex(0x2a2018, THREE.LinearSRGBColorSpace),
      roughness: 0.54,
      metalness: 0,
      envMapIntensity: RENDER.envMap.coverEdge,
    });
    this.disposables.push(longEdgeGeometry, shortEdgeGeometry, edgeMaterial);

    const edgeTop = new THREE.Mesh(longEdgeGeometry, edgeMaterial);
    edgeTop.position.set(PAGE_WIDTH / 2, 0, -PAGE_HEIGHT / 2);
    const edgeBottom = new THREE.Mesh(longEdgeGeometry, edgeMaterial);
    edgeBottom.position.set(PAGE_WIDTH / 2, 0, PAGE_HEIGHT / 2);
    const edgeOuter = new THREE.Mesh(shortEdgeGeometry, edgeMaterial);
    edgeOuter.position.set(PAGE_WIDTH, 0, 0);
    const edgeSpine = new THREE.Mesh(shortEdgeGeometry, edgeMaterial);
    edgeSpine.position.set(0, 0, 0);

    for (const edge of [edgeTop, edgeBottom, edgeOuter, edgeSpine]) {
      edge.castShadow = true;
      edge.receiveShadow = true;
    }

    this.coverHinge.add(edgeTop, edgeBottom, edgeOuter, edgeSpine, this.coverFront, this.coverInside);
    this.magazine.add(this.coverHinge);
  }

  // --- Bending leaf ----------------------------------------------------------

  createTurnCueMaterial() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uCue: { value: 0 },
        uDirection: { value: 1 },
        uProgress: { value: 0 },
        uShadow: { value: MATERIAL_VISUALS.turn.shadow },
        uHighlight: { value: MATERIAL_VISUALS.turn.highlight },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uCue;
        uniform float uDirection;
        uniform float uProgress;
        uniform float uShadow;
        uniform float uHighlight;
        varying vec2 vUv;

        void main() {
          float spanUv = uDirection > 0.0 ? vUv.x : 1.0 - vUv.x;
          float rootShade = exp(-pow((spanUv - 0.18) / 0.16, 2.0));
          float freeGlance = exp(-pow((spanUv - mix(0.58, 0.82, uProgress)) / 0.18, 2.0));
          float verticalFalloff = smoothstep(0.02, 0.18, vUv.y) * smoothstep(0.98, 0.78, vUv.y);
          float shadow = rootShade * uShadow;
          float highlight = freeGlance * uHighlight;
          float alpha = clamp((shadow + highlight) * uCue * verticalFalloff, 0.0, 0.12);
          vec3 tone = mix(vec3(0.10, 0.075, 0.045), vec3(1.0, 0.82, 0.58), highlight / max(shadow + highlight, 0.001));
          gl_FragColor = vec4(tone, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.disposables.push(material);
    return material;
  }

  createTurningLeaf() {
    this.turningPage = new THREE.Group();
    this.turningPage.position.set(0, TURN_BASE_Y, 0);
    this.turningPage.visible = false;

    this.leafFrontGeometry = this.createLeafGeometry(false);
    this.leafBackGeometry = this.createLeafGeometry(true);
    this.disposables.push(this.leafFrontGeometry, this.leafBackGeometry);

    this.turnFront = new THREE.Mesh(this.leafFrontGeometry, this.pageMaterials[0]);
    this.turnBack = new THREE.Mesh(this.leafBackGeometry, this.pageMaterials[0]);
    for (const mesh of [this.turnFront, this.turnBack]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }

    this.turnCueMaterial = this.createTurnCueMaterial();
    this.turnShadeFront = new THREE.Mesh(this.leafFrontGeometry, this.turnCueMaterial);
    this.turnShadeBack = new THREE.Mesh(this.leafBackGeometry, this.turnCueMaterial);
    for (const mesh of [this.turnShadeFront, this.turnShadeBack]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
    }

    this.turningPage.add(this.turnFront, this.turnBack, this.turnShadeFront, this.turnShadeBack);
    this.magazine.add(this.turningPage);
    this.updateLeafShape(0, 1, false);
  }

  createLeafGeometry(back) {
    const cols = LEAF_SEGMENTS + 1;
    const positions = new Float32Array(cols * 2 * 3);
    const normals = new Float32Array(cols * 2 * 3);
    const uvs = new Float32Array(cols * 2 * 2);
    const indices = [];

    for (let i = 0; i < cols; i += 1) {
      const u = i / LEAF_SEGMENTS;
      // The back face is the same surface seen from the other side, so only
      // the horizontal axis mirrors; v stays tied to the z coordinate.
      const uTex = back ? 1 - u : u;
      // row 0: far edge (z = -H/2, image top), row 1: near edge (z = +H/2)
      uvs[(i * 2) * 2] = uTex;
      uvs[(i * 2) * 2 + 1] = 1;
      uvs[(i * 2 + 1) * 2] = uTex;
      uvs[(i * 2 + 1) * 2 + 1] = 0;
    }

    for (let i = 0; i < LEAF_SEGMENTS; i += 1) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (back) {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }

  // The leaf is a developable strip: angle from the table plane varies along
  // its width, the outer edge leading the root like paper pulled by its edge.
  updateLeafShape(progress, direction, stiff = false) {
    const t = direction > 0 ? progress : 1 - progress;
    const theta = Math.PI * t;
    // The free edge leads the root toward the destination side.
    const bendScale = stiff ? BOARD_BEND_SCALE : 1;
    const bend =
      LEAF_BEND *
      bendScale *
      Math.sin(Math.PI * t) *
      direction *
      (this.turn?.mode === "drag" ? 1.2 : 1);
    const ds = PAGE_WIDTH / LEAF_SEGMENTS;
    const halfH = PAGE_HEIGHT / 2;
    const skin = 0.0009;

    const front = this.leafFrontGeometry.attributes;
    const backA = this.leafBackGeometry.attributes;

    let px = 0;
    let py = 0;
    for (let i = 0; i <= LEAF_SEGMENTS; i += 1) {
      const u = i / LEAF_SEGMENTS;
      if (i > 0) {
        const uMid = (i - 0.5) / LEAF_SEGMENTS;
        const phiMid = theta + bend * Math.pow(uMid, LEAF_BEND_EXP);
        px += Math.cos(phiMid) * ds;
        py += Math.sin(phiMid) * ds;
      }
      const phi = theta + bend * Math.pow(u, LEAF_BEND_EXP);
      const nx = -Math.sin(phi);
      const ny = Math.cos(phi);

      for (let row = 0; row < 2; row += 1) {
        const v = i * 2 + row;
        const z = row === 0 ? -halfH : halfH;
        front.position.setXYZ(v, px + nx * skin, py + ny * skin, z);
        front.normal.setXYZ(v, nx, ny, 0);
        backA.position.setXYZ(v, px - nx * skin, py - ny * skin, z);
        backA.normal.setXYZ(v, -nx, -ny, 0);
      }
    }

    front.position.needsUpdate = true;
    front.normal.needsUpdate = true;
    backA.position.needsUpdate = true;
    backA.normal.needsUpdate = true;
    this.leafFrontGeometry.computeBoundingSphere();
    this.leafBackGeometry.computeBoundingSphere();
    this.updateTurnCue(progress, direction, stiff, t);
  }

  updateTurnCue(progress, direction, stiff, t) {
    if (!this.turnCueMaterial) return;
    const peelCue = !this.turn && this.peel?.side
      ? THREE.MathUtils.clamp(progress / PEEL_AMOUNT, 0, 1) * 0.55
      : 0;
    const flexCue = Math.max(Math.sin(Math.PI * t), peelCue) * (stiff ? 0.35 : 1);
    this.turnCueMaterial.uniforms.uCue.value = flexCue;
    this.turnCueMaterial.uniforms.uDirection.value = direction > 0 ? 1 : -1;
    this.turnCueMaterial.uniforms.uProgress.value = THREE.MathUtils.clamp(progress, 0, 1);
    const visible = flexCue > 0.015;
    if (this.turnShadeFront) this.turnShadeFront.visible = visible;
    if (this.turnShadeBack) this.turnShadeBack.visible = visible;
  }

  // --- Spread model -----------------------------------------------------------
  // Page 0 is glued to the inside of the front cover. The following pages are
  // bound as leaves of two; with an even remainder the colophon is printed on
  // the inside of the back cover, with an odd remainder the last image is.
  // After the final spread, the back cover board itself can be turned, which
  // lays the whole magazine face-down with the back cover up.

  leafCount() {
    return Math.floor((this.pageMaterials.length - 1) / 2);
  }

  leafFrontPage(leaf) {
    return 1 + leaf * 2;
  }

  leafBackPage(leaf) {
    return 2 + leaf * 2;
  }

  backInsidePage() {
    const count = this.pageMaterials.length;
    return (count - 1) % 2 === 1 ? count - 1 : null;
  }

  spreadLeftPage(spread) {
    return spread === 0 ? 0 : this.leafBackPage(spread - 1);
  }

  spreadRightPage(spread) {
    if (spread < this.leafCount()) return this.leafFrontPage(spread);
    if (spread === this.leafCount()) return this.backInsidePage();
    return null;
  }

  // The single source of truth for the page→spread/side reverse lookup (the
  // inverse of spreadLeftPage/spreadRightPage). buildStandee anchors figures by
  // it and the 鑑賞 (gallery) write-back lands the 3D magazine on the spread a
  // page belongs to — both go through here so the forward and reverse maps can
  // never drift apart. Returns { spread, side } or null for a page that is not
  // on any settled spread (so callers never silently land on spread 0).
  pageToSpread(pageIndex) {
    if (typeof pageIndex !== "number" || !Number.isFinite(pageIndex)) return null;
    for (let s = 0; s <= this.leafCount(); s += 1) {
      if (this.spreadLeftPage(s) === pageIndex) return { spread: s, side: "left" };
      if (this.spreadRightPage(s) === pageIndex) return { spread: s, side: "right" };
    }
    return null;
  }

  // The spread → commentary index (CARD-1 / R-CARD-DATASOURCE). Built once,
  // lazily, from the module-level STANDEE_SOURCES (page + eager-loaded
  // commentary) reverse-mapped by pageToSpread — NOT from this.standees. So the
  // card entry guard and the card itself both read commentary that is ready at
  // module load, immune to the loadStandees build race (a cold deep-link card
  // always has data). One index, two readers, no drift. The page-count is fixed
  // for the magazine's lifetime, so a one-time build is safe to memoize.
  spreadCommentaryIndex() {
    if (!this._spreadCommentaryIndex) {
      this._spreadCommentaryIndex = buildSpreadCommentaryIndex(
        STANDEE_SOURCES,
        (pageIndex) => this.pageToSpread(pageIndex),
      );
    }
    return this._spreadCommentaryIndex;
  }

  // S15-BEAT: spread → primary narrative event. Like the look-card index, this
  // reads module-level STANDEE_SOURCES/commentary rather than this.standees, so
  // deep links and cold starts resolve a beat before runtime standees finish.
  narrativeBeatIndex() {
    if (!this._narrativeBeatIndex) {
      this._narrativeBeatIndex = buildNarrativeBeatIndex({
        spreadCount: this.leafCount() + 1,
        sources: STANDEE_SOURCES,
        pageToSpread: (pageIndex) => this.pageToSpread(pageIndex),
      });
    }
    return this._narrativeBeatIndex;
  }

  resolvedPrimaryEvent(spread = this.spreadIndex) {
    const clamped = Math.min(Math.max(0, Math.trunc(spread) || 0), this.leafCount());
    return this.narrativeBeatIndex().get(clamped);
  }

  materialForPage(pageIndex) {
    if (pageIndex === null) {
      return this.colophonMaterial ?? this.blankPageMaterial;
    }
    return this.pageMaterials[pageIndex] ?? this.blankPageMaterial;
  }

  canTurnForward() {
    return this.spreadIndex < this.leafCount();
  }

  canTurnBackward() {
    return this.spreadIndex > 0;
  }

  canCloseBack() {
    return this.spreadIndex === this.leafCount();
  }

  applySpread() {
    this.leftPage.material = this.materialForPage(this.spreadLeftPage(this.spreadIndex));
    this.rightPage.material = this.materialForPage(this.spreadRightPage(this.spreadIndex));
    // The left paper stack only exists once at least one leaf has been turned.
    this.leftBlock.visible = this.spreadIndex > 0;
  }

  // Settled-open invariants for the page stacks, restored after back-cover
  // turns or peels that hide parts of the right side.
  restoreStacks() {
    this.rightPage.visible = true;
    this.rightBlock.visible = true;
    this.rightBlock.position.x = PAGE_WIDTH / 2;
    this.leftPage.visible = true;
  }

  // --- Picking -----------------------------------------------------------------

  isShown(object) {
    for (let node = object; node; node = node.parent) {
      if (node.visible === false) return false;
    }
    return true;
  }

  pickMagazine(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = this.raycaster
      .intersectObject(this.magazine, true)
      .find((candidate) => this.isShown(candidate.object));
    if (!hit) return null;
    const local = this.magazine.worldToLocal(hit.point.clone());
    return {
      side: local.x < 0 ? "left" : "right",
      localX: local.x,
      localY: local.y,
      localZ: local.z,
      object: hit.object,
    };
  }

  pickMagazineSide(event) {
    return this.pickMagazine(event)?.side ?? null;
  }

  flippableSide(side) {
    if (side === "right") return this.canTurnForward() || this.canCloseBack();
    if (side === "left") return this.canTurnBackward();
    return false;
  }

  rightTurnKind() {
    return this.canTurnForward() ? "page" : "back";
  }

  projectToScreenX(localX) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.workVector.set(localX, PAGE_SURFACE_Y, 0);
    this.magazine.localToWorld(this.workVector);
    this.workVector.project(this.camera);
    return rect.left + ((this.workVector.x + 1) / 2) * rect.width;
  }

  dragProgressFromPointer(clientX) {
    const xRight = this.projectToScreenX(PAGE_WIDTH);
    const xLeft = this.projectToScreenX(-PAGE_WIDTH);
    const span = xRight - xLeft;
    if (Math.abs(span) < 1) return 0;
    const raw = (xRight - clientX) / span;
    const p = this.turn && this.turn.direction < 0 ? 1 - raw : raw;
    return THREE.MathUtils.clamp(p, 0, 1);
  }

  // --- Pointer handling -----------------------------------------------------------

  startDrag(event, direction, kind, startProgress) {
    this.beginTurn(direction, "drag", startProgress, kind);
    if (!this.turn) return;
    this.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startedAt: performance.now(),
      lastX: event.clientX,
      lastAt: performance.now(),
      velocity: 0,
      moved: false,
    };
    try {
      this.inputTarget.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
  }

  handlePointerDown(event) {
    if (!this.assetsReady) return;
    this.startAudio();
    this.container.classList.add("is-pressing");
    this.moveCursor(event);

    if (this.show) {
      this.endShow();
      return;
    }

    if (this.state === "closed") {
      if (this.pickMagazine(event)) {
        this.openMagazine();
      }
      return;
    }

    if (this.state === "closedBack") {
      if (this.pickMagazine(event)) {
        this.startDrag(event, -1, "back", 0);
      }
      return;
    }

    if (this.state !== "open") return;

    const pick = this.pickMagazine(event);
    if (!pick) return;

    if (this.tour) {
      this.endTour();
      return;
    }

    const standeeHit = this.standeeFromPick(pick);
    if (standeeHit) {
      const { standee, part, itemIndex } = standeeHit;
      if (part === "hotspot") {
        if (standee.cui.activeIndex === itemIndex) {
          this.hideCommentary(standee);
          this.hideCaption();
        } else {
          this.showCommentaryItem(standee, itemIndex, false);
        }
        return;
      }
      if (standee.flip) {
        // a click mid-flip settles her back to the base pose
        this.cancelStandeeAction(standee);
        standee.idleAt = performance.now() + 4500 + Math.random() * 2500;
        return;
      }
      if (part === "card" && standee.state === "risen") {
        this.cycleExpression(standee);
      } else if (part === "feet") {
        this.toggleStandee(standee);
      } else if (part === "mesh" && standee.state === "risen" && standee.videoUrl) {
        this.startShow(standee);
      } else if (part === "mesh" && standee.state === "risen" && standee.poses) {
        this.flipPose(standee);
      } else {
        this.toggleStandee(standee);
      }
      return;
    }

    if (this.flippableSide(pick.side)) {
      const kind = pick.side === "right" ? this.rightTurnKind() : "page";
      const direction = pick.side === "right" ? 1 : -1;
      const startProgress = this.peel.side === pick.side ? this.peel.amount : 0;
      this.clearPeel(true);
      this.startDrag(event, direction, kind, startProgress);
    } else if (pick.side === "left") {
      this.closeMagazine();
    }
  }

  handlePointerMove(event) {
    if (!this.assetsReady) return;
    this.moveCursor(event);
    this.updateParallax(event);

    if (this.show) {
      this.container.dataset.cursor = "none";
      return;
    }

    if (this.drag && this.turn && this.turn.mode === "drag") {
      if (event.pointerId !== this.drag.pointerId) return;
      const now = performance.now();
      const dt = Math.max((now - this.drag.lastAt) / 1000, 1e-3);
      const target = this.dragProgressFromPointer(event.clientX);
      this.turn.dragTarget = target;
      this.drag.velocity = (target - (this.turn.lastTarget ?? target)) / dt;
      this.turn.lastTarget = target;
      this.drag.lastAt = now;
      if (Math.abs(event.clientX - this.drag.startX) > 8) this.drag.moved = true;
      return;
    }

    const interactive = this.state === "open" || this.state === "closed" || this.state === "closedBack";
    const pick = interactive ? this.pickMagazine(event) : null;
    const side = pick?.side ?? null;
    this.pointerSide = side ?? "center";

    if (this.state === "closed") {
      this.container.dataset.cursor = side ? "open" : "none";
      return;
    }

    if (this.state === "closedBack") {
      this.container.dataset.cursor = side ? "left" : "none";
      return;
    }

    if (this.state !== "open") {
      this.container.dataset.cursor = "none";
      this.clearPeel();
      return;
    }

    const hoverStandee = this.standeeFromPick(pick);
    if (hoverStandee) {
      this.container.dataset.cursor = "figure";
      this.clearPeel();
      return;
    }

    if (side && this.flippableSide(side)) {
      this.container.dataset.cursor = side;
      if (Math.abs(pick.localX) > PEEL_GRAB_ZONE) {
        this.setPeel(side);
      } else {
        this.clearPeel();
      }
    } else if (side === "left") {
      this.container.dataset.cursor = "left";
      this.clearPeel();
    } else {
      this.container.dataset.cursor = "none";
      this.clearPeel();
    }
  }

  handlePointerUp(event) {
    this.container.classList.remove("is-pressing");
    if (!this.drag || !this.turn || this.turn.mode !== "drag") return;
    if (event.pointerId !== this.drag.pointerId) return;

    try {
      this.inputTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }

    const elapsed = performance.now() - this.drag.startedAt;
    const isClick = elapsed < 280 && !this.drag.moved;
    const progress = this.turn.progress;
    const velocity = this.drag.velocity;
    this.drag = null;

    const flickedBack = velocity < -DRAG_COMMIT_VELOCITY;
    const commit =
      isClick ||
      velocity > DRAG_COMMIT_VELOCITY ||
      (progress > DRAG_COMMIT && !flickedBack);
    this.settleTurn(commit ? 1 : 0);
  }

  handlePointerLeave() {
    this.container.classList.remove("has-pointer");
    this.container.dataset.cursor = "none";
    if (!this.drag) this.clearPeel();
  }

  moveCursor(event) {
    if (!this.cursorDot) return;
    this.container.classList.add("has-pointer");
    const rect = this.container.getBoundingClientRect();
    this.cursorDot.style.transform = `translate3d(${event.clientX - rect.left}px, ${
      event.clientY - rect.top
    }px, 0)`;
  }

  updateParallax(event) {
    if (this.reducedMotion) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.parallaxTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  // --- Peel invitation ------------------------------------------------------------

  setPeel(side) {
    if (this.state !== "open" || this.turn) return;
    if (this.peel.side === side) {
      this.peel.target = PEEL_AMOUNT;
      return;
    }
    if (this.peel.side) this.restorePeelSurfaces();

    this.peel.side = side;
    this.peel.amount = 0;
    this.peel.target = PEEL_AMOUNT;
    this.peel.kind = side === "right" ? this.rightTurnKind() : "page";
    this.prepareLeaf(side === "right" ? 1 : -1, this.peel.kind);
  }

  clearPeel(skipRestore = false) {
    if (!this.peel.side) return;
    this.peel.target = 0;
    if (skipRestore) {
      // a drag is taking over the already-prepared leaf
      this.peel.side = null;
      this.peel.amount = 0;
      return;
    }
    if (this.peel.amount < 0.003) {
      this.restorePeelSurfaces();
    }
  }

  restorePeelSurfaces() {
    this.peel.side = null;
    this.peel.amount = 0;
    this.peel.target = 0;
    if (!this.turn) {
      this.turningPage.visible = false;
      if (this.state === "open") {
        this.restoreStacks();
        this.applySpread();
      }
    }
  }

  updatePeel(delta) {
    if (!this.peel.side || this.turn) return;
    const speed = this.reducedMotion ? 30 : 10;
    this.peel.amount += (this.peel.target - this.peel.amount) * Math.min(1, delta * speed);

    if (this.peel.target === 0 && this.peel.amount < 0.003) {
      this.restorePeelSurfaces();
      return;
    }

    const direction = this.peel.side === "right" ? 1 : -1;
    this.turningPage.visible = this.peel.amount > 0.004;
    this.updateLeafShape(this.peel.amount, direction, this.peel.kind === "back");
  }

  // --- Pop-up standees --------------------------------------------------------

  async loadStandees() {
    for (const source of STANDEE_SOURCES) {
      try {
        const [figureTexture, backgroundTexture, expressionTexture, actionTexture] =
          await Promise.all([
            // raw (non-bitmap) keeps these unflipped: buildStandee pixel-analyzes
            // the figure/expression/action images, and the ImageBitmap path
            // decodes pre-flipped which would corrupt the cutout/cell math.
            this.loadTexture(source.figure, { color: true, raw: true }),
            this.loadTexture(source.background, { color: true, raw: true }),
            source.expressions
              ? this.loadTexture(source.expressions, { color: true, raw: true })
              : Promise.resolve(null),
            source.actions
              ? this.loadTexture(source.actions, { color: true, raw: true })
              : Promise.resolve(null),
          ]);
        if (this.disposed) return;
        this.buildStandee(source, figureTexture, backgroundTexture, expressionTexture, actionTexture);
        // C9b: the masthead's first sync runs in restoreSession/applyDeepLink
        // before any standee has finished building (loadStandees is fire-and-
        // forget, build is spread across frames), so it cached a "no character"
        // key for a spread that actually has one. Force a re-render after each
        // build so the character name appears the moment its standee is ready —
        // on a live page the per-frame animate() loop self-heals this, but a
        // paused/headless tab would otherwise stay stuck on the issue line.
        this.syncMasthead(true);
        // buildStandee runs synchronous cutout/NCC analysis; yield between
        // standees so the 15 of them spread across frames instead of blocking
        // the main thread in one long burst during the open.
        await new Promise((resolve) => setTimeout(resolve, 0));
      } catch {
        /* the standee is optional decoration; the page works without it */
      }
    }
  }

  // Silhouette and luminance samples of the figure cutout at scan width.
  rasterAlphaMask(image, w = 84, stride = 2) {
    const h = Math.round((w * image.height) / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const xs = [];
    const ys = [];
    const ls = [];
    let x0 = w;
    let x1 = -1;
    let y0 = h;
    let y1 = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (data[i + 3] > 26) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          if (x % stride === 0 && y % stride === 0) {
            xs.push(x);
            ys.push(y);
            ls.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          }
        }
      }
    }
    if (x1 < 0 || xs.length < 24) return null;
    return {
      xs,
      ys,
      ls,
      w,
      h,
      boxPx: { x0, x1, y0, y1 },
      box: { u0: x0 / w, u1: (x1 + 1) / w, y0: y0 / h, y1: (y1 + 1) / h },
    };
  }

  rasterPageLuma(image, w = 84) {
    const h = Math.round((w * image.height) / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    // Pages decode through ImageBitmap (pre-flipped via imageOrientation:'flipY');
    // undo that here so the figure-vs-print correlation runs in the same
    // orientation as the unflipped figure cutout and standee anchoring stays put.
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
      ctx.translate(0, h);
      ctx.scale(1, -1);
    }
    ctx.drawImage(image, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const luma = new Float32Array(w * h);
    for (let p = 0; p < luma.length; p += 1) {
      luma[p] = 0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2];
    }
    return { luma, w, h };
  }

  // Appearance matching: normalized cross-correlation of the cutout's
  // luminance pattern against the page itself, over scale and position.
  // Matching against the page-minus-background diff fails here because the
  // regenerated backgrounds differ everywhere (sidebars, swatches, floors),
  // so the figure is no privileged signal in that diff. The printed figure
  // IS in the page; correlating with it directly is also invariant to the
  // mild lighting drift between the two renders. Statistics are computed on
  // the in-bounds subset per offset, otherwise partial overlaps break the
  // correlation bound.
  fitCutoutNcc(cut, page, sMin, sMax, sStep, oxWin = null, oyWin = null) {
    const n = cut.xs.length;
    let best = null;
    for (let s = sMin; s <= sMax + 1e-6; s += sStep) {
      const px = new Int16Array(n);
      const py = new Int16Array(n);
      for (let i = 0; i < n; i += 1) {
        px[i] = Math.round(cut.xs[i] * s);
        py[i] = Math.round(cut.ys[i] * s);
      }
      // the figure must stay essentially inside the page
      const oxLo = oxWin ? oxWin[0] : Math.round(-0.02 * page.w - cut.boxPx.x0 * s);
      const oxHi = oxWin ? oxWin[1] : Math.round(1.02 * page.w - cut.boxPx.x1 * s);
      const oyLo = oyWin ? oyWin[0] : Math.round(-0.02 * page.h - cut.boxPx.y0 * s);
      const oyHi = oyWin ? oyWin[1] : Math.round(1.02 * page.h - cut.boxPx.y1 * s);

      for (let oy = oyLo; oy <= oyHi; oy += 1) {
        for (let ox = oxLo; ox <= oxHi; ox += 1) {
          let sp = 0;
          let spp = 0;
          let sl = 0;
          let sll = 0;
          let slp = 0;
          let m = 0;
          for (let i = 0; i < n; i += 1) {
            const x = px[i] + ox;
            const y = py[i] + oy;
            if (x < 0 || x >= page.w || y < 0 || y >= page.h) continue;
            const pv = page.luma[y * page.w + x];
            const lv = cut.ls[i];
            sp += pv;
            spp += pv * pv;
            sl += lv;
            sll += lv * lv;
            slp += lv * pv;
            m += 1;
          }
          if (m < n * 0.92) continue;
          const pMean = sp / m;
          const lMean = sl / m;
          const pStd = Math.sqrt(Math.max(spp / m - pMean * pMean, 1e-6));
          const lStd = Math.sqrt(Math.max(sll / m - lMean * lMean, 1e-6));
          if (pStd < 5 || lStd < 5) continue;
          const score = (slp / m - lMean * pMean) / (lStd * pStd);
          if (!best || score > best.score) best = { score, s, ox, oy };
        }
      }
    }
    return best;
  }

  matchFigureToPrint(alpha, pageImage) {
    const page = this.rasterPageLuma(pageImage, alpha.w);
    const coarse = this.fitCutoutNcc(alpha, page, 0.6, 1.1, 0.025);
    if (!coarse || coarse.score < 0.45) return null;
    const refined =
      this.fitCutoutNcc(
        alpha,
        page,
        Math.max(0.6, coarse.s - 0.02),
        Math.min(1.1, coarse.s + 0.02),
        0.01,
        [coarse.ox - 3, coarse.ox + 3],
        [coarse.oy - 3, coarse.oy + 3],
      ) ?? coarse;
    const fit = refined.score >= coarse.score ? refined : coarse;

    const box = {
      u0: (alpha.boxPx.x0 * fit.s + fit.ox) / page.w,
      u1: ((alpha.boxPx.x1 + 1) * fit.s + fit.ox) / page.w,
      y0: (alpha.boxPx.y0 * fit.s + fit.oy) / page.h,
      y1: ((alpha.boxPx.y1 + 1) * fit.s + fit.oy) / page.h,
    };
    return {
      scale: fit.s,
      feetY: Math.min(box.y1, 0.985),
      centerU: (box.u0 + box.u1) / 2,
      box,
      score: fit.score,
    };
  }

  buildStandee(source, figureTexture, backgroundTexture, expressionTexture = null, actionTexture = null) {
    const pageIndex = source.page;
    const alpha = this.rasterAlphaMask(figureTexture.image);
    if (!alpha) return;
    const figureBox = alpha.box;

    const pageImage = this.pageMaterials[pageIndex]?.map?.image;
    const anchor = pageImage ? this.matchFigureToPrint(alpha, pageImage) : null;
    // With a confident silhouette fit the standee is scaled and anchored onto
    // the printed figure, so it rises exactly out of the print.
    const anchorBox = anchor ? anchor.box : figureBox;
    const standScale = anchor ? THREE.MathUtils.clamp(anchor.scale, 0.5, 1.5) : 1;
    if (source.video || anchor) {
      // keep the fitted numbers inspectable for tuning
      this.standeeFits ??= {};
      this.standeeFits[pageIndex] = anchor
        ? { scale: +anchor.scale.toFixed(3), feetY: +anchor.feetY.toFixed(3), score: +anchor.score.toFixed(3) }
        : { fallback: true };
    }

    // the settled spread and side where this page is displayed (single source
    // of truth in pageToSpread, shared with the 鑑賞 write-back)
    const located = this.pageToSpread(pageIndex);
    if (!located) return;
    const { spread, side } = located;

    const u0 = Math.max(0, figureBox.u0 - 0.015);
    const u1 = Math.min(1, figureBox.u1 + 0.015);
    const yTop = Math.max(0, figureBox.y0 - 0.02);
    const yFeet = Math.min(1, figureBox.y1 + 0.001);
    // world size is baked into the geometry so pose surfaces of different
    // proportions can be hot-swapped without touching the mesh scale
    const worldW = (u1 - u0) * PAGE_WIDTH * standScale;
    const worldH = (yFeet - yTop) * PAGE_HEIGHT * standScale;

    const material = new THREE.MeshStandardMaterial({
      map: figureTexture,
      transparent: true,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
      roughness: 0.74,
      metalness: 0,
      normalMap: this.paperNormal,
      normalScale: new THREE.Vector2(0.03, 0.03),
      roughnessMap: this.paperRoughness,
      envMapIntensity: RENDER.envMap.standee,
    });
    this.applyStandeeShader(material);
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.disposables.push(geometry, material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    const anchorCenterU = (anchorBox.u0 + anchorBox.u1) / 2;
    mesh.position.set((anchorCenterU - 0.5) * PAGE_WIDTH, 0.0015, -worldH / 2);
    mesh.castShadow = true;

    // hinge at the printed figure's feet line so it rises out of the print
    const pivot = new THREE.Group();
    const pageCenterX = side === "left" ? -PAGE_WIDTH / 2 : PAGE_WIDTH / 2;
    pivot.position.set(pageCenterX, PAGE_SURFACE_Y + 0.0075, (anchorBox.y1 - 0.5) * PAGE_HEIGHT);
    pivot.add(mesh);
    pivot.visible = false;
    this.magazine.add(pivot);

    const standee = {
      pageIndex,
      spread,
      side,
      pivot,
      mesh,
      backgroundMaterial: this.createPrintedMaterial(backgroundTexture, 0.74, 0.03),
      printedBox: anchorBox,
      standHeight: worldH,
      baseSurface: { map: figureTexture, u0, u1, vTop: 1 - yTop, vBottom: 1 - yFeet, worldW, worldH },
      surface: null,
      actionTexture: null,
      poses: null,
      poseIndex: -1,
      flip: null,
      anchorX: pageCenterX,
      anchorY: PAGE_SURFACE_Y + 0.0075,
      idleAt: Infinity,
      commentary: null,
      cui: null,
      videoUrl: source.video ?? null,
      video: null,
      videoTexture: null,
      stage: null,
      stageMaterial: null,
      card: null,
      state: "folded",
      angle: 0,
      target: 0,
      swayPhase: Math.random() * Math.PI * 2,
    };
    this.applyStandeeSurface(standee, standee.baseSurface);

    if (actionTexture) {
      const poses = this.segmentActionSheet(actionTexture.image);
      if (poses) {
        standee.actionTexture = actionTexture;
        standee.poses = poses;
      }
    }

    if (expressionTexture) {
      standee.card = this.buildExpressionCard(
        expressionTexture,
        side,
        mesh.position.x,
        worldW,
        worldH,
        source.expressionsCutout,
      );
      pivot.add(standee.card.group);
    }

    if (source.commentary?.items?.length) {
      standee.commentary = source.commentary;
      this.buildCommentaryUI(standee);
    }

    this.standees.set(pageIndex, standee);
  }

  // --- Outfit commentary: hotspots, swing tags, and the guided tour ------------

  buildCommentaryUI(standee) {
    const items = standee.commentary.items;

    const dotGeometry = new THREE.CircleGeometry(0.016, 20);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff2dc,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.disposables.push(dotGeometry, dotMaterial);

    const hotspots = items.map((item, index) => {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.rotation.x = -Math.PI / 2;
      const flat = this.anchorToFlat(standee, item.anchor, item.part);
      dot.position.set(flat.x, 0.03, flat.z);
      dot.visible = false;
      dot.userData.itemIndex = index;
      standee.pivot.add(dot);
      return dot;
    });

    // one shared swing tag, redrawn per item
    const tagCanvas = document.createElement("canvas");
    tagCanvas.width = 512;
    tagCanvas.height = 180;
    const tagTexture = new THREE.CanvasTexture(tagCanvas);
    tagTexture.colorSpace = THREE.SRGBColorSpace;
    tagTexture.anisotropy = this.maxAnisotropy;
    const tagMaterial = new THREE.MeshStandardMaterial({
      map: tagTexture,
      roughness: 0.85,
      metalness: 0,
      envMapIntensity: RENDER.envMap.swingTag,
    });
    const tagGeometry = new THREE.PlaneGeometry(0.36, 0.1266);
    this.disposables.push(tagTexture, tagMaterial, tagGeometry);
    const tagMesh = new THREE.Mesh(tagGeometry, tagMaterial);
    tagMesh.castShadow = true;
    const tagGroup = new THREE.Group();
    tagGroup.add(tagMesh);
    tagGroup.rotation.x = -Math.PI / 2;
    tagGroup.rotation.z = 0.05;
    tagGroup.visible = false;
    standee.pivot.add(tagGroup);

    // a thin thread from the hotspot to the tag's punch hole
    const threadGeometry = new THREE.BufferGeometry();
    threadGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const threadMaterial = new THREE.LineBasicMaterial({
      color: 0xf2e6d2,
      transparent: true,
      opacity: 0.55,
    });
    this.disposables.push(threadGeometry, threadMaterial);
    const thread = new THREE.Line(threadGeometry, threadMaterial);
    thread.visible = false;
    standee.pivot.add(thread);

    standee.cui = {
      hotspots,
      tagGroup,
      tagCanvas,
      tagTexture,
      thread,
      threadGeometry,
      activeIndex: -1,
      showUntil: 0,
      bloomUntil: 0,
    };
  }

  // Maps a commentary anchor (y-down, cutout-canvas normalized) into the
  // standee's flat pivot space; falls back to coarse body-part heights.
  anchorToFlat(standee, anchor, part) {
    const surface = standee.baseSurface;
    let xFrac;
    let heightFrac;
    if (Array.isArray(anchor) && anchor.length === 2) {
      const texV = 1 - anchor[1];
      xFrac = (anchor[0] - (surface.u0 + surface.u1) / 2) / (surface.u1 - surface.u0);
      heightFrac = (texV - surface.vBottom) / (surface.vTop - surface.vBottom);
    } else {
      const heights = {
        jacket: 0.72,
        top: 0.58,
        bottom: 0.35,
        bag: 0.45,
        shoes: 0.05,
        accessory: 0.8,
      };
      xFrac = 0;
      heightFrac = heights[part] ?? 0.5;
    }
    xFrac = THREE.MathUtils.clamp(xFrac, -0.5, 0.5);
    heightFrac = THREE.MathUtils.clamp(heightFrac, 0.02, 0.98);
    return {
      x: standee.mesh.position.x + xFrac * surface.worldW,
      z: -heightFrac * surface.worldH,
    };
  }

  drawTag(standee, item) {
    const canvas = standee.cui.tagCanvas;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#f6efe0";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(40, 32, 24, 0.25)";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.beginPath();
    ctx.arc(34, h / 2, 10, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(40, 32, 24, 0.45)";
    ctx.lineWidth = 4;
    ctx.stroke();

    const name = localeText(item.name, this.locale);
    let size = 40;
    ctx.font = `${size}px 'Shippori Mincho', serif`;
    while (size > 22 && ctx.measureText(name).width > w - 110) {
      size -= 2;
      ctx.font = `${size}px 'Shippori Mincho', serif`;
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(30, 24, 18, 0.85)";
    ctx.fillText(name, 64, h * 0.46);

    const tags =
      (item.tags && (this.locale === "zh" ? item.tags.zh ?? item.tags.ja : item.tags.ja ?? item.tags.zh)) ||
      [];
    ctx.font = "22px 'Shippori Mincho', serif";
    ctx.fillStyle = "rgba(30, 24, 18, 0.5)";
    ctx.fillText(tags.join("・"), 64, h * 0.78);
    standee.cui.tagTexture.needsUpdate = true;
  }

  showCommentaryItem(standee, index, sticky = false) {
    const cui = standee.cui;
    const item = standee.commentary?.items?.[index];
    if (!cui || !item) return;
    cui.bloomUntil = 0; // the user found the hotspots; stop nudging
    // the discovery hint has done its job; let the caption own the bottom-center
    // band rather than stacking the guidance text behind the live commentary.
    this.fadeHint();
    cui.activeIndex = index;
    cui.showUntil = sticky ? Infinity : performance.now() + 6500;

    this.drawTag(standee, item);
    const flat = this.anchorToFlat(standee, item.anchor, item.part);
    const outward = standee.side === "left" ? -1 : 1;
    const tagX = flat.x + outward * 0.3;
    const tagZ = Math.min(-0.12, flat.z - 0.05);
    cui.tagGroup.position.set(tagX, 0.04, tagZ);
    cui.tagGroup.visible = true;
    const thread = cui.threadGeometry.attributes.position;
    thread.setXYZ(0, flat.x, 0.032, flat.z);
    thread.setXYZ(1, tagX - outward * 0.17, 0.04, tagZ);
    thread.needsUpdate = true;
    cui.threadGeometry.computeBoundingSphere();
    cui.thread.visible = true;

    this.setExpressionHint(standee, item.expression);
    this.playSound("pageTurn", { gain: 0.12, rate: 1.7 });
    // S18: caption + optional voice + optional lip sync. With no voiceUrl this
    // is just setCaption(item.text) — identical to the previous behavior. The
    // dedup key is the standee+item so a rapid re-tap of the same hotspot is
    // debounced instead of stacking a second voice.
    this.playVoice(item, item.text, standee.card, {
      dedupKey: `${standee.spread}:${standee.side}:${index}`,
    });
  }

  hideCommentary(standee) {
    const cui = standee.cui;
    if (!cui) return;
    cui.activeIndex = -1;
    cui.tagGroup.visible = false;
    cui.thread.visible = false;
    if (!this.tour) {
      this.stopVoice(); // S18: a hidden commentary line stops its voice too
      this.hideCaption();
    }
  }

  setExpressionHint(standee, hint) {
    const card = standee.card;
    if (!card || !hint) return;
    const cell = EXPRESSION_HINTS[hint];
    if (cell === undefined || cell === card.cell) return;
    card.cell = cell;
    this.writeExpressionUv(card, cell);
  }

  startTour(standee) {
    if (this.tour || !standee.commentary || standee.state !== "risen") return;
    if (this.gallery || this.lookCard || this.show || this.turn) return;
    this.cancelStandeeAction(standee);
    // the tour now drives the bottom-center caption; retire the discovery hint
    // so the two no longer overlap (it re-shows on the next rise / runway nudge).
    this.fadeHint();
    this.tour = { standee, stage: -1, stageUntil: performance.now() + 3400 };
    if (standee.cui) {
      standee.cui.activeIndex = -1;
      standee.cui.bloomUntil = 0;
      standee.cui.tagGroup.visible = false;
      standee.cui.thread.visible = false;
    }
    const intro = standee.commentary.intro;
    this.setExpressionHint(standee, intro?.expression);
    this.syncNarrativeBeat(true);
    this.playSound("pageTurn", { gain: 0.2, rate: 1.4 });
    // S18: the tour intro caption + optional voice. The tour owns the caption
    // cadence, so scheduleCaptionFade no-ops while a tour is running.
    this.playVoice(intro, intro, standee.card, {
      dedupKey: `tour-intro:${standee.spread}`,
    });
  }

  endTour() {
    const tour = this.tour;
    if (!tour) return;
    this.tour = null;
    this.stopVoice(); // S18: stop any in-flight tour voice + clear lip sync
    this.clearCaptionFade();
    this.hideCommentary(tour.standee);
    this.hideCaption();
    tour.standee.idleAt = performance.now() + 4500 + Math.random() * 2500;
    this.syncNarrativeBeat(true);
  }

  // The first risen, commentary-bearing standee on the open spread, or null.
  // Shared by the C key, the HUD tour pill, and that pill's visibility check.
  currentSpreadTourStandee() {
    if (this.state !== "open" || this.show) return null;
    for (const standee of this.standees.values()) {
      if (
        standee.state === "risen" &&
        standee.spread === this.spreadIndex &&
        standee.commentary
      ) {
        return standee;
      }
    }
    return null;
  }

  // Toggle the guided tour for the current spread (keyboard + HUD button share this).
  toggleTourOnCurrentSpread() {
    if (this.tour) {
      this.endTour();
      return;
    }
    const standee = this.currentSpreadTourStandee();
    if (standee) this.startTour(standee);
  }

  updateTour() {
    const tour = this.tour;
    if (!tour) return;
    const standee = tour.standee;
    if (standee.state !== "risen" || this.state !== "open") {
      this.endTour();
      return;
    }
    if (performance.now() < tour.stageUntil) return;
    const items = standee.commentary.items;
    tour.stage += 1;
    if (tour.stage >= items.length) {
      this.endTour();
      return;
    }
    tour.stageUntil = performance.now() + 3800;
    this.showCommentaryItem(standee, tour.stage, true);
  }

  // Rewrites the standee plane to show a different region of a (possibly
  // different) texture at a given world size, feet kept on the hinge line.
  applyStandeeSurface(standee, surface) {
    const mesh = standee.mesh;
    if (mesh.material.map !== surface.map) {
      mesh.material.map = surface.map;
    }
    const position = mesh.geometry.attributes.position;
    const w = surface.worldW;
    const h = surface.worldH;
    position.setXYZ(0, -w / 2, h / 2, 0);
    position.setXYZ(1, w / 2, h / 2, 0);
    position.setXYZ(2, -w / 2, -h / 2, 0);
    position.setXYZ(3, w / 2, -h / 2, 0);
    position.needsUpdate = true;
    const uv = mesh.geometry.attributes.uv;
    uv.setXY(0, surface.u0, surface.vTop);
    uv.setXY(1, surface.u1, surface.vTop);
    uv.setXY(2, surface.u0, surface.vBottom);
    uv.setXY(3, surface.u1, surface.vBottom);
    uv.needsUpdate = true;
    mesh.position.z = -h / 2;
    mesh.geometry.computeBoundingSphere();
    standee.surface = surface;
  }

  surfaceForPose(standee, pose) {
    const worldH = standee.standHeight;
    return {
      map: standee.actionTexture,
      u0: pose.u0,
      u1: pose.u1,
      vTop: pose.v1,
      vBottom: pose.v0,
      worldW: worldH * pose.aspect,
      worldH,
    };
  }

  // Splits a transparent pose sheet on fully-transparent column gaps; each
  // run of filled columns becomes one pose with its own bounds and aspect.
  segmentActionSheet(image) {
    const w = 256;
    const h = Math.round((w * image.height) / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const colCount = new Int32Array(w);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] > 26) colCount[x] += 1;
      }
    }

    const poses = [];
    let runStart = -1;
    for (let x = 0; x <= w; x += 1) {
      const filled = x < w && colCount[x] > 0;
      if (filled && runStart < 0) runStart = x;
      if (!filled && runStart >= 0) {
        if (x - runStart >= 10) {
          let y0 = h;
          let y1 = -1;
          for (let y = 0; y < h; y += 1) {
            for (let xx = runStart; xx < x; xx += 1) {
              if (data[(y * w + xx) * 4 + 3] > 26) {
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
                break;
              }
            }
          }
          if (y1 > y0) {
            poses.push({
              u0: runStart / w,
              u1: x / w,
              v0: 1 - (y1 + 1) / h,
              v1: 1 - y0 / h,
              aspect: (x - runStart) / (y1 - y0 + 1),
            });
          }
        }
        runStart = -1;
      }
    }
    return poses.length >= 2 ? poses : null;
  }

  // The closed-eyes cut is the cell with the least dark-iris area in the
  // central eye band; hair contributes equally to every cell and cancels out.
  detectBlinkCell(image) {
    const w = 192;
    const h = 128;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const cellW = w / EXPRESSION_COLS;
    const cellH = h / EXPRESSION_ROWS;

    let bestCell = BLINK_CELL;
    let bestCount = Infinity;
    for (let cell = 0; cell < EXPRESSION_CELLS; cell += 1) {
      const cx = (cell % EXPRESSION_COLS) * cellW;
      const cy = Math.floor(cell / EXPRESSION_COLS) * cellH;
      let count = 0;
      const yStart = Math.round(cy + cellH * 0.32);
      const yEnd = Math.round(cy + cellH * 0.55);
      const xStart = Math.round(cx + cellW * 0.34);
      const xEnd = Math.round(cx + cellW * 0.66);
      for (let y = yStart; y < yEnd; y += 1) {
        for (let x = xStart; x < xEnd; x += 1) {
          const i = (y * w + x) * 4;
          if (data[i + 3] > 26) {
            const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (luma < 95) count += 1;
          }
        }
      }
      if (count < bestCount) {
        bestCount = count;
        bestCell = cell;
      }
    }
    return bestCell;
  }

  // --- Standee behaviors: in-place pose transitions -----------------------------

  flipPose(standee) {
    if (!standee.poses || standee.flip || standee.state !== "risen") return;
    if (standee.cui && standee.cui.activeIndex >= 0) {
      this.hideCommentary(standee);
      this.hideCaption();
    }
    const next = standee.poseIndex + 1 >= standee.poses.length ? -1 : standee.poseIndex + 1;
    standee.poseIndex = next;
    const surface =
      next < 0 ? standee.baseSurface : this.surfaceForPose(standee, standee.poses[next]);
    standee.flip = { t: 0, surface, swapped: false };
    standee.idleAt = performance.now() + 4500 + Math.random() * 2500;
    this.playSound("pageTurn", { gain: 0.18, rate: 1.8 });
  }

  // F key: flip every risen standee on the current spread
  flipRisenPoses() {
    if (this.state !== "open" || this.show) return;
    for (const standee of this.standees.values()) {
      if (standee.state === "risen" && standee.spread === this.spreadIndex) {
        this.flipPose(standee);
      }
    }
  }

  cancelStandeeAction(standee) {
    if (!standee.flip && standee.poseIndex < 0) return;
    standee.flip = null;
    standee.poseIndex = -1;
    standee.mesh.scale.x = 1;
    standee.pivot.position.x = standee.anchorX;
    standee.pivot.position.y = standee.anchorY;
    this.applyStandeeSurface(standee, standee.baseSurface);
    standee.idleAt = Infinity;
  }

  // A polaroid-style inset beside the risen figure, cycling expression cuts.
  buildExpressionCard(texture, side, figureX, standWidth, standHeight, cutout = false) {
    const frameGeometry = new THREE.PlaneGeometry(0.36, 0.42);
    const photoGeometry = new THREE.PlaneGeometry(0.3, 0.3);
    const frameMaterial = this.createPaperMaterial(0xfbf7ee, 0.85, 0.08);
    // cutout sheets float the bust directly on the polaroid paper
    const photoMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: cutout,
      alphaTest: cutout ? 0.3 : 0,
      roughness: 0.78,
      metalness: 0,
      envMapIntensity: RENDER.envMap.expression,
    });
    this.disposables.push(frameGeometry, photoGeometry, photoMaterial);

    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.castShadow = true;
    const photo = new THREE.Mesh(photoGeometry, photoMaterial);
    photo.position.set(0, 0.025, 0.002);

    const group = new THREE.Group();
    group.add(frame, photo);
    // flat in pivot space, so the card rises and sways with the figure
    const outwardDir = side === "left" ? -1 : 1;
    group.rotation.x = -Math.PI / 2;
    group.rotation.z = outwardDir * -0.08;
    group.position.set(
      figureX + outwardDir * (standWidth / 2 + 0.26),
      0.02,
      -standHeight * 0.62,
    );
    group.visible = false;
    group.scale.setScalar(0.001);

    const card = {
      group,
      frame,
      photo,
      photoGeometry,
      baseUv: Array.from(photoGeometry.attributes.uv.array),
      cell: 0,
      scale: 0,
      blinkAt: 0,
      blinkCell: this.detectBlinkCell(texture.image),
    };
    this.writeExpressionUv(card, 0);
    return card;
  }

  writeExpressionUv(card, cellIndex) {
    const cx = cellIndex % EXPRESSION_COLS;
    const cy = Math.floor(cellIndex / EXPRESSION_COLS);
    const u0 = cx / EXPRESSION_COLS;
    const du = 1 / EXPRESSION_COLS;
    const v1 = 1 - cy / EXPRESSION_ROWS;
    const dv = 1 / EXPRESSION_ROWS;
    const uv = card.photoGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(
        i,
        u0 + card.baseUv[i * 2] * du,
        v1 - dv + card.baseUv[i * 2 + 1] * dv,
      );
    }
    uv.needsUpdate = true;
  }

  cycleExpression(standee) {
    if (!standee.card || standee.state !== "risen") return;
    standee.card.cell = (standee.card.cell + 1) % EXPRESSION_CELLS;
    this.writeExpressionUv(standee.card, standee.card.cell);
    standee.card.scale = 0.82;
    this.playSound("pageTurn", { gain: 0.15, rate: 1.6 });
  }

  standeeFromPick(pick) {
    if (!pick) return null;
    for (const standee of this.standees.values()) {
      if (standee.cui) {
        const itemIndex = standee.cui.hotspots.indexOf(pick.object);
        if (itemIndex >= 0) return { standee, part: "hotspot", itemIndex };
      }
      if (standee.card && (pick.object === standee.card.frame || pick.object === standee.card.photo)) {
        return { standee, part: "card" };
      }
      if (pick.object === standee.mesh) {
        // the bottom strip is her base: grabbing it lays the card back down
        const heightFrac =
          (pick.localY - standee.anchorY) / Math.max(standee.standHeight, 1e-3);
        return { standee, part: heightFrac < 0.18 ? "feet" : "mesh" };
      }
      if (this.state !== "open" || this.spreadIndex !== standee.spread) continue;
      if (pick.side !== standee.side) continue;
      const u =
        standee.side === "left"
          ? (pick.localX + PAGE_WIDTH) / PAGE_WIDTH
          : pick.localX / PAGE_WIDTH;
      const y = pick.localZ / PAGE_HEIGHT + 0.5;
      const pad = 0.04;
      const box = standee.printedBox;
      if (u > box.u0 - pad && u < box.u1 + pad && y > box.y0 - pad && y < box.y1 + pad) {
        return { standee, part: "region" };
      }
    }
    return null;
  }

  toggleStandee(standee) {
    if (this.turn) return;
    if (standee.state === "folded") {
      if (this.state !== "open" || this.spreadIndex !== standee.spread) return;
      this.clearPeel();
      const page = standee.side === "left" ? this.leftPage : this.rightPage;
      page.material = standee.backgroundMaterial;
      standee.pivot.visible = true;
      standee.state = "rising";
      standee.target = STANDEE_STAND_ANGLE;
      this.playSound("pageTurn", { gain: 0.35, rate: 1.25 });
      if (standee.videoUrl) this.showRunwayHint();
    } else {
      if (this.tour?.standee === standee) this.endTour();
      this.cancelStandeeAction(standee);
      this.hideCommentary(standee);
      standee.state = "folding";
      standee.target = 0;
      this.playSound("pageTurn", { gain: 0.3, rate: 1.1 });
      this.fadeHint();
    }
  }

  // One-time nudge toward the signature interaction: the first time the book
  // opens onto a spread with a foldable figure, invite a tap. The page-turn
  // affordance is already implied by the cursor chevrons, so the standee (the
  // hidden, signature feature) is the more valuable thing to surface here.
  maybeShowStandeeHint() {
    if (this.standeeHintShown || this.firstTurnDone || !this.hudHint) return;
    let hasStandee = false;
    for (const standee of this.standees.values()) {
      if (standee.spread === this.spreadIndex && standee.state === "folded") {
        hasStandee = true;
        break;
      }
    }
    if (!hasStandee) return;
    if (this.tryDiscoveryCue("standee", { text: "人物にふれると立ち上がる" })) {
      this.standeeHintShown = true;
    }
  }

  // Once a commentary figure first finishes rising, surface the (otherwise
  // near-invisible) outfit-commentary depth: nudge the hint toward tapping her
  // clothes and bloom the hotspot dots so they read as live affordances. Fires
  // once per session. The static guidance text (information) is shown for every
  // user; only the bloom pulse (visual emphasis) is gated by reduced-motion, so
  // accessibility users still learn the clothes are tappable.
  maybeShowStandeeGuide(standee) {
    if (this.standeeGuideShown) return;
    if (!standee.cui || !standee.commentary) return;
    this.standeeGuideShown = true;
    this.guideStandee = standee;
    if (!this.reducedMotion) standee.cui.bloomUntil = performance.now() + 3600;
    this.tryDiscoveryCue("commentary", {
      text: "服にふれると、コーデ解説",
      control: this.hudTour,
      replace: true,
    });
  }

  showRunwayHint() {
    this.tryDiscoveryCue("runway", { text: "人物にふれるとランウェイ", replace: true });
  }

  // --- Runway show (the lights drop, the video performs) -----------------------

  startShow(standee) {
    if (this.show || !standee.videoUrl || standee.state !== "risen") return;
    if (this.gallery || this.lookCard || this.turn) return;
    if (this.tour) this.endTour();
    this.clearPeel();
    this.cancelStandeeAction(standee);
    this.hideCommentary(standee);
    this.stopVoice(); // S18: interrupt any in-flight commentary voice
    this.fadeHint();
    const runwayIntro = standee.commentary?.runwayIntro;
    if (runwayIntro) {
      // S18: caption + optional runway voice. With no voiceUrl this is the same
      // setCaption as before; the 4.2 s auto-hide remains the legacy fallback.
      this.playVoice(runwayIntro, runwayIntro, standee.card, {
        dedupKey: `runway:${standee.spread}`,
      });
      window.setTimeout(() => {
        if (!this.disposed && !this.tour && !this.voice) this.hideCaption();
      }, 4200);
    }
    this.lightLevels ??= {
      hemi: this.hemiLight.intensity,
      key: this.keyLight.intensity,
      pool: this.poolLight.intensity,
      fill: this.fillLight.intensity,
      // VIS-RIM (Sprint 6 / Iter 1): register the new rim so applyShowDim can
      // lerp it down during runway dim and back up on restore (Scout C pitfall:
      // "新增光源必须同步注册 lightLevels + applyShowDim").
      rim: this.rimLight?.intensity ?? 0,
      env: this.scene.environmentIntensity,
    };
    this.show = { standee, phase: "dimming", dim: 0, fade: 0 };
    this.container.classList.add("in-show");
    this.syncNarrativeBeat(true);
    if (standee.card) standee.card.group.visible = false;
    void this.prepareShowStage(standee);
    this.playSound("coverOpen", { gain: 0.3, rate: 0.7 });
  }

  async prepareShowStage(standee) {
    if (standee.stage) {
      standee.video.currentTime = 0;
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = standee.videoUrl;
    standee.video = video;
    await new Promise((resolve) => {
      video.onloadedmetadata = resolve;
      video.onerror = resolve;
      window.setTimeout(resolve, 6000);
    });
    if (this.disposed) return;
    if (!video.videoWidth) {
      if (this.show?.standee === standee) this.endShow(true);
      return;
    }

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    standee.videoTexture = texture;

    // sized so the video figure roughly matches the printed figure's height
    const stageHeight = standee.standHeight / 0.72;
    const stageWidth = stageHeight * (video.videoWidth / video.videoHeight);
    const geometry = new THREE.PlaneGeometry(stageWidth, stageHeight);
    const material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture }, uFade: { value: 0 } },
      vertexShader: StageShader.vertexShader,
      fragmentShader: StageShader.fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.disposables.push(texture, geometry, material);

    const stage = new THREE.Mesh(geometry, material);
    stage.rotation.x = -Math.PI / 2;
    stage.position.set(standee.mesh.position.x, 0.03, -stageHeight / 2 + 0.05);
    stage.visible = false;
    stage.frustumCulled = false;
    standee.stage = stage;
    standee.stageMaterial = material;
    standee.pivot.add(stage);
  }

  endShow(immediate = false) {
    const show = this.show;
    if (!show) return;
    show.standee.video?.pause();
    if (immediate) {
      this.finishShow();
    } else if (show.phase !== "relight") {
      show.phase = "restoring";
    }
  }

  finishShow() {
    const show = this.show;
    if (!show) return;
    this.show = null;
    this.stopVoice(); // S18: end-of-show tears down the runway caption + voice
    this.hideCaption();
    const standee = show.standee;
    if (standee.stage) standee.stage.visible = false;
    if (standee.video) {
      standee.video.pause();
      standee.video.onended = null;
    }
    standee.mesh.material.opacity = 1;
    standee.mesh.castShadow = true;
    this.applyShowDim(0);
    this.container.classList.remove("in-show");
    this.syncNarrativeBeat(true);
  }

  applyShowDim(dim) {
    if (!this.lightLevels) return;
    const eased = easeInOutCubic(dim);
    const L = this.lightLevels;
    this.hemiLight.intensity = L.hemi * (1 - 0.96 * eased);
    this.keyLight.intensity = L.key * (1 - 0.95 * eased);
    this.poolLight.intensity = L.pool * (1 - 0.78 * eased);
    this.fillLight.intensity = L.fill * (1 - eased);
    // VIS-RIM (Sprint 6 / Iter 1): rim follows the same ~95% dim curve as key
    // (rim is the back-half of the same dramatic light shape — runway should
    // suppress it nearly fully so the video stage reads as the only light).
    if (this.rimLight) this.rimLight.intensity = L.rim * (1 - 0.95 * eased);
    this.scene.environmentIntensity = L.env * (1 - 0.97 * eased);
    // VIS-GRAIN (Sprint 6 / Iter 1): base vignette dropped 0.48→0.32 (Evo+Res
    // two votes, "0.48 too cinematic dark, flat-lay photo norm 0.1-0.2"). Keep
    // the runway lerp delta (+0.3) so the show still pulls inward.
    // VIS-VIGNETTE-RIM (Sprint 6 / Iter 2): 0.32 → 0.20 — kept in lockstep
    // with GrainShader default (must be identical; otherwise show entry jumps
    // the base by one step). Runway delta +0.3 unchanged.
    // TECH-1 (Sprint 6 / Iter 3): both base and delta now from render-config,
    // so this site and the GrainShader default read the same constant —
    // silent desync is physically impossible.
    if (this.grainPass)
      this.grainPass.uniforms.uVignette.value =
        RENDER.grain.vignette + RENDER.grain.runwayDelta * eased;
  }

  updateShow(delta) {
    const show = this.show;
    if (!show) return;
    const standee = show.standee;
    const dimSpeed = this.reducedMotion ? 4 : 1.1;

    if (show.phase === "dimming") {
      show.dim = Math.min(1, show.dim + delta * dimSpeed);
      if (show.dim >= 1 && standee.stage) {
        show.phase = "performing";
        standee.stage.visible = true;
        standee.video.onended = () => {
          if (this.show === show) show.phase = "restoring";
        };
        void standee.video.play().catch(() => this.endShow());
      }
    } else if (show.phase === "performing") {
      show.fade = Math.min(1, show.fade + delta / 0.45);
      // poll the end as well: the 'ended' event is unreliable on throttled tabs
      if (standee.video.ended) show.phase = "restoring";
      // resume if the browser paused the video (tab switch, power saving)
      show.retryAccum = (show.retryAccum ?? 0) + delta;
      if (show.retryAccum > 1) {
        show.retryAccum = 0;
        if (standee.video.paused && !standee.video.ended) {
          void standee.video.play().catch(() => {});
        }
      }
    } else if (show.phase === "restoring") {
      show.fade = Math.max(0, show.fade - delta / 0.5);
      if (show.fade <= 0) show.phase = "relight";
    } else if (show.phase === "relight") {
      show.dim = Math.max(0, show.dim - delta * dimSpeed);
      if (show.dim <= 0) {
        this.finishShow();
        return;
      }
    }

    if (standee.stageMaterial) standee.stageMaterial.uniforms.uFade.value = show.fade;
    standee.mesh.material.opacity = 1 - show.fade;
    standee.mesh.castShadow = show.fade < 0.5;
    this.applyShowDim(show.dim);
  }

  foldStandees(immediate = false) {
    if (this.show) this.endShow(true);
    if (this.tour) this.endTour();
    this.stopVoice(); // S18: a fold tears down captions today → tear down voice too
    for (const standee of this.standees.values()) {
      if (standee.state === "folded") continue;
      this.cancelStandeeAction(standee);
      this.hideCommentary(standee);
      if (immediate) {
        standee.angle = 0;
        standee.target = 0;
        standee.state = "folded";
        standee.pivot.visible = false;
        standee.pivot.rotation.x = 0;
        standee.pivot.rotation.z = 0;
        const page = standee.side === "left" ? this.leftPage : this.rightPage;
        if (page.material === standee.backgroundMaterial) {
          const shownPage =
            standee.side === "left"
              ? this.spreadLeftPage(this.spreadIndex)
              : this.spreadRightPage(this.spreadIndex);
          page.material = this.materialForPage(shownPage);
        }
      } else {
        standee.state = "folding";
        standee.target = 0;
      }
    }
  }

  updateStandees(delta, elapsed) {
    let lift = 0;
    for (const standee of this.standees.values()) {
      if (standee.state === "rising" || standee.state === "folding") {
        const k = Math.min(1, delta * (standee.state === "rising" ? 5.5 : 7.5));
        standee.angle += (standee.target - standee.angle) * k;
        if (Math.abs(standee.target - standee.angle) < 0.012) {
          standee.angle = standee.target;
          if (standee.state === "folding") {
            standee.state = "folded";
            standee.pivot.visible = false;
            if (this.state === "open" || this.state === "closed") this.applySpread();
          } else {
            standee.state = "risen";
            standee.idleAt = performance.now() + 4500 + Math.random() * 2500;
            this.maybeShowStandeeGuide(standee);
          }
        }
      }

      // pose flip: the card squashes to its edge, swaps face, and unfolds
      if (standee.flip) {
        const flip = standee.flip;
        flip.t += delta / 0.3;
        if (flip.t >= 0.5 && !flip.swapped) {
          flip.swapped = true;
          this.applyStandeeSurface(standee, flip.surface);
        }
        if (flip.t >= 1) {
          standee.flip = null;
          standee.mesh.scale.x = 1;
        } else {
          standee.mesh.scale.x = Math.max(0.03, Math.abs(Math.cos(Math.PI * flip.t)));
        }
      }

      // after a while of idling she shifts to another pose by herself
      if (
        standee.state === "risen" &&
        standee.poses &&
        !standee.flip &&
        !this.show &&
        !this.tour &&
        (!standee.cui || standee.cui.activeIndex < 0) &&
        !this.reducedMotion &&
        performance.now() > standee.idleAt
      ) {
        this.flipPose(standee);
      }

      // commentary hotspots live on the base pose only
      if (standee.cui) {
        const cui = standee.cui;
        const showDots =
          standee.state === "risen" &&
          standee.poseIndex < 0 &&
          !standee.flip &&
          (!this.show || this.show.standee !== standee);
        // discovery bloom: just after she rises, the dots swell once and ease
        // back, so the tap-for-commentary affordance can't be missed (DISC-1).
        const bloomLeft = cui.bloomUntil - performance.now();
        const bloom = bloomLeft > 0 ? bloomLeft / 3600 : 0;
        for (let i = 0; i < cui.hotspots.length; i += 1) {
          const dot = cui.hotspots[i];
          dot.visible = showDots;
          if (!showDots) continue;
          const pulse = this.reducedMotion ? 1 : 1 + Math.sin(elapsed * 2.6 + i * 1.3) * 0.12;
          // staggered ramp so the dots open like a fan rather than all at once
          const stagger = Math.max(0, bloom - i * 0.08);
          const bloomScale = 1 + stagger * 1.3 * (0.7 + 0.3 * Math.sin(elapsed * 7 + i));
          dot.scale.setScalar(cui.activeIndex === i ? 1.6 : pulse * bloomScale);
        }
        if (!showDots && cui.activeIndex >= 0) {
          this.hideCommentary(standee);
        } else if (cui.activeIndex >= 0 && !this.tour && performance.now() > cui.showUntil) {
          this.hideCommentary(standee);
          this.hideCaption();
        }
      }

      const sway =
        standee.state === "risen" && !this.reducedMotion
          ? Math.sin(elapsed * 1.6 + standee.swayPhase) * 0.008
          : 0;
      standee.pivot.rotation.x = standee.angle;
      standee.pivot.rotation.z = sway;
      lift = Math.max(lift, standee.angle / STANDEE_STAND_ANGLE);

      if (standee.card) {
        const card = standee.card;
        const wantCard =
          standee.state === "risen" &&
          (!this.show || this.show.standee !== standee) &&
          !standee.flip;
        card.scale += ((wantCard ? 1 : 0) - card.scale) * Math.min(1, delta * (wantCard ? 6 : 11));
        card.group.scale.setScalar(Math.max(0.001, card.scale));
        card.group.visible = card.scale > 0.02;

        // auto blink with the closed-eyes cut. S18: while this card is driving
        // a mouth from voice amplitude, the lip-sync owns its UVs — skip blink
        // so the two never fight (no-op on current assets: no card has a mouth
        // mapping, so activeMouthCard stays null).
        const blinkCell = card.blinkCell ?? BLINK_CELL;
        if (wantCard && card.cell !== blinkCell && this.activeMouthCard !== card) {
          const nowMs = performance.now();
          if (!card.blinkAt) card.blinkAt = nowMs + 2400 + Math.random() * 3200;
          if (nowMs > card.blinkAt + 140) {
            this.writeExpressionUv(card, card.cell);
            card.blinkAt = nowMs + 2400 + Math.random() * 3200;
          } else if (nowMs > card.blinkAt) {
            this.writeExpressionUv(card, blinkCell);
          }
        }
      }
    }
    this.standeeLift = lift;
  }

  // Configure leaf materials and the surfaces revealed underneath it.
  // The front face is the one visible while the leaf lies on the right
  // (theta near 0); the back face shows once it lies on the left.
  prepareLeaf(direction, kind = "page") {
    if (kind === "back") {
      if (direction > 0) {
        // closing the back cover: the board is the whole right stack
        this.turnFront.material = this.materialForPage(this.spreadRightPage(this.spreadIndex));
        this.turnBack.material = this.backCoverMaterial;
        this.rightPage.visible = false;
        this.rightBlock.visible = false;
      } else {
        // reopening from the back: the board lifts off the left stack
        this.turnBack.material = this.backCoverMaterial;
        this.turnFront.material = this.materialForPage(this.spreadRightPage(this.spreadIndex));
        this.leftPage.material = this.materialForPage(this.spreadLeftPage(this.spreadIndex));
        this.leftPage.visible = true;
        this.leftBlock.visible = false;
      }
      return;
    }

    if (direction > 0) {
      const nextSpread = this.spreadIndex + 1;
      this.turnFront.material = this.materialForPage(this.spreadRightPage(this.spreadIndex));
      this.turnBack.material = this.materialForPage(this.spreadLeftPage(nextSpread));
      this.rightPage.material = this.materialForPage(this.spreadRightPage(nextSpread));
    } else {
      const targetSpread = this.spreadIndex - 1;
      this.turnBack.material = this.materialForPage(this.spreadLeftPage(this.spreadIndex));
      this.turnFront.material = this.materialForPage(this.spreadRightPage(targetSpread));
      this.leftPage.material = this.materialForPage(this.spreadLeftPage(targetSpread));
    }
  }

  // --- Turn lifecycle ------------------------------------------------------------

  beginTurn(direction, mode, startProgress = 0, kind = "page") {
    if (kind === "page") {
      if (direction > 0 && !this.canTurnForward()) return;
      if (direction < 0 && !this.canTurnBackward()) return;
    } else {
      if (direction > 0 && !this.canCloseBack()) return;
      if (direction < 0 && this.state !== "closedBack") return;
    }

    this.foldStandees(true);
    this.prepareLeaf(direction, kind);
    this.turn = {
      direction,
      mode,
      kind,
      progress: startProgress,
      dragTarget: startProgress,
      lastTarget: startProgress,
      settle: null,
      targetSpread: kind === "page" ? this.spreadIndex + direction : this.spreadIndex,
    };
    // Turning the only left-hand leaf back lifts the whole left stack with it.
    if (kind === "page" && direction < 0) {
      this.leftBlock.visible = this.turn.targetSpread > 0;
    }
    this.updateLeafShape(startProgress, direction, kind === "back");
    this.turningPage.visible = true;
    this.state = "turning";
    if (kind === "back") {
      this.playSound("pageTurn", { gain: 0.6, rate: 0.8 });
    } else {
      this.playSound("pageTurn", { gain: 0.5, rate: 0.94 + Math.random() * 0.12 });
    }

    if (mode === "auto") {
      this.settleTurn(1);
    }
  }

  settleTurn(to) {
    if (!this.turn) return;
    const from = this.turn.progress;
    const distance = Math.abs(to - from);
    const heft = this.turn.kind === "back" ? 1.3 : 1;
    this.turn.mode = "settle";
    this.turn.settle = {
      from,
      to,
      startedAt: performance.now(),
      duration: Math.max(0.16, (0.2 + distance * (to === 1 ? 0.72 : 0.5)) * heft),
    };
  }

  enterClosedBack() {
    this.leftPage.material = this.backCoverMaterial;
    this.leftPage.visible = true;
    this.leftBlock.visible = false;
    this.rightBlock.visible = true;
    this.rightBlock.position.x = -PAGE_WIDTH / 2;
    this.rightPage.visible = false;
    this.state = "closedBack";
    this.firstTurnDone = true;
    this.fadeHint();
    this.syncHud();
  }

  // The settled-closed (front cover laid flat) invariants, mirroring the close
  // animation's completion end pose (updateAnimation close branch). Lands the
  // 鑑賞 write-back when the reader exits on the cover entry. The right-stack x
  // is reset too, in case the magazine was last in closedBack (which displaces
  // it to -PAGE_WIDTH/2) — without this the closed cover would inherit a stray
  // right-stack offset.
  enterClosedCover() {
    this.spreadIndex = 0;
    this.applySpread();
    this.coverHinge.rotation.z = 0;
    this.coverHinge.position.y = COVER_Y;
    this.rightBlock.visible = true;
    this.rightBlock.position.x = PAGE_WIDTH / 2;
    this.rightPage.visible = false;
    this.leftPage.visible = true;
    this.leftBlock.visible = false;
    this.state = "closed";
    this.firstTurnDone = false;
    this.syncHud();
  }

  finishTurn() {
    const { to } = this.turn.settle;
    const { kind, direction, targetSpread } = this.turn;
    this.turn = null;
    this.turningPage.visible = false;
    this.turningPage.rotation.z = 0;
    this.turningPage.position.y = TURN_BASE_Y;

    if (kind === "back") {
      const landsClosed = direction > 0 ? to === 1 : to === 0;
      if (landsClosed) {
        this.enterClosedBack();
      } else {
        this.restoreStacks();
        this.applySpread();
        this.state = "open";
        this.syncHud();
        this.recordSpread();
      }
      return;
    }

    if (to === 1) {
      this.spreadIndex = targetSpread;
      this.firstTurnDone = true;
      this.fadeHint();
    }
    this.applySpread();
    this.state = "open";
    this.syncHud();
    this.recordSpread();
  }

  updateTurn(now, delta) {
    if (!this.turn) return;
    const stiff = this.turn.kind === "back";

    if (this.turn.mode === "drag") {
      const target = this.turn.dragTarget ?? this.turn.progress;
      const k = Math.min(1, delta * 16);
      this.turn.progress += (target - this.turn.progress) * k;
      this.updateLeafShape(this.turn.progress, this.turn.direction, stiff);
      return;
    }

    if (this.turn.mode === "settle" && this.turn.settle) {
      const { from, to, startedAt, duration } = this.turn.settle;
      const raw = Math.min((now - startedAt) / (duration * 1000), 1);
      const eased = easeOutQuint(raw);
      this.turn.progress = from + (to - from) * eased;
      this.updateLeafShape(this.turn.progress, this.turn.direction, stiff);
      if (raw >= 1) this.finishTurn();
    }
  }

  // --- Open, close ------------------------------------------------------------

  openMagazine() {
    this.state = "opening";
    this.container.dataset.cursor = "none";
    // The closed cover fully occludes the right page, so it can be shown from
    // the first frame; otherwise the bare paper block flashes under the cover.
    this.rightPage.visible = true;
    this.activeAnimation = {
      type: "open",
      startedAt: performance.now(),
      duration: 1.55,
    };
    this.playSound("coverOpen", { gain: 0.55 });
  }

  closeMagazine() {
    // clean the spread while the state still reads "open" so the peel and
    // standee restores are allowed to touch the page materials
    this.foldStandees(true);
    this.clearPeel();
    this.restorePeelSurfaces();
    this.state = "closing";
    this.container.dataset.cursor = "none";
    // The inside-cover print lifts away with the cover itself; hiding the
    // flat copy at once avoids a duplicated page under the moving cover.
    this.leftPage.visible = false;
    this.activeAnimation = {
      type: "close",
      startedAt: performance.now(),
      duration: 1.25,
    };
    this.playSound("coverClose", { gain: 0.55 });
  }

  updateAnimation(now) {
    if (!this.activeAnimation) return;

    const rawProgress = Math.min(
      (now - this.activeAnimation.startedAt) / (this.activeAnimation.duration * 1000),
      1,
    );
    const progress = easeInOutCubic(rawProgress);

    if (this.activeAnimation.type === "open") {
      this.coverHinge.rotation.z = Math.PI * progress;
      this.coverHinge.position.y = THREE.MathUtils.lerp(COVER_Y, COVER_OPEN_Y, progress);

      if (rawProgress >= 1) {
        this.coverHinge.rotation.z = Math.PI;
        this.coverHinge.position.y = COVER_OPEN_Y;
        this.leftPage.visible = true;
        this.rightPage.visible = true;
        this.leftBlock.visible = this.spreadIndex > 0;
        this.activeAnimation = null;
        this.state = "open";
        this.syncHud();
        this.maybeShowStandeeHint();
        // the cinematic intro has now played in full → future visits skip it
        this.markGuided();
        this.recordSpread();
      }
      return;
    }

    if (this.activeAnimation.type === "close") {
      this.coverHinge.rotation.z = Math.PI * (1 - progress);
      this.coverHinge.position.y = THREE.MathUtils.lerp(COVER_OPEN_Y, COVER_Y, progress);

      if (rawProgress >= 1) {
        this.spreadIndex = 0;
        this.applySpread();
        this.coverHinge.rotation.z = 0;
        this.coverHinge.position.y = COVER_Y;
        this.rightPage.visible = false;
        this.leftBlock.visible = false;
        this.activeAnimation = null;
        this.state = "closed";
        this.syncHud();
      }
    }
  }

  // --- Camera, motion ------------------------------------------------------------

  updateCamera(delta, now) {
    if (!this.introComplete) {
      this.introProgress = Math.min((now - this.introStartTime) / 4200, 1);
      const intro = easeOutCubic(this.introProgress);
      const start = this.applyResponsiveCamera(this.cameraStart, this.responsiveCameraA);
      const closed = this.applyResponsiveCamera(this.cameraClosed, this.responsiveCameraB);
      this.camera.position.copy(start).lerp(closed, intro);
      this.cameraTarget.copy(this.targetStart).lerp(this.targetClosed, intro);
      this.applyResponsiveTarget(this.cameraTarget);
      this.camera.lookAt(this.cameraTarget);

      if (this.introProgress >= 1) this.introComplete = true;
      return;
    }

    const basePosition =
      this.state === "closed"
        ? this.cameraClosed
        : this.state === "closedBack"
          ? this.cameraClosedBack
          : this.cameraOpen;
    const desiredPosition = this.applyResponsiveCamera(basePosition, this.responsiveCameraDesired);
    const desiredTarget = this.applyResponsiveTarget(
      this.desiredTargetWork.copy(
        this.state === "closed"
          ? this.targetClosed
          : this.state === "closedBack"
            ? this.targetClosedBack
            : this.targetOpen,
      ),
    );

    this.parallax.lerp(this.parallaxTarget, Math.min(1, delta * 4));
    desiredPosition.x += this.parallax.x * 0.085;
    desiredPosition.y += this.parallax.y * 0.05;

    // keyboard orbit rig: yaw, dolly, and lateral pan on top of the framing
    this.updateRigInput(delta);
    const rig = this.rig;
    if (rig.yaw !== 0 || rig.dolly !== 1 || rig.pan !== 0) {
      this.rigOffset.copy(desiredPosition).sub(desiredTarget);
      if (rig.yaw !== 0) this.rigOffset.applyAxisAngle(UP_AXIS, rig.yaw);
      this.rigOffset.multiplyScalar(rig.dolly);
      desiredPosition.copy(desiredTarget).add(this.rigOffset);
      if (rig.pan !== 0) {
        this.rigRight.crossVectors(UP_AXIS, this.rigOffset).normalize().multiplyScalar(rig.pan);
        desiredPosition.add(this.rigRight);
        desiredTarget.add(this.rigRight);
      }
    }

    if (this.state === "turning") {
      desiredPosition.lerp(desiredTarget, 0.045);
    }

    // a risen standee draws the eye and the focus plane up with it
    if (this.standeeLift > 0) {
      desiredTarget.y += this.standeeLift * 0.16;
    }

    // during the runway show the camera leans in toward the performer
    if (this.show) {
      const draw = easeInOutCubic(this.show.dim);
      desiredTarget.y += draw * 0.42;
      desiredPosition.lerp(desiredTarget, draw * 0.1);
    }

    const smoothing = 1 - Math.exp(-delta * 2.4);
    this.camera.position.lerp(desiredPosition, smoothing);
    this.cameraTarget.lerp(desiredTarget, smoothing);
    this.camera.lookAt(this.cameraTarget);

    if (this.bokehPass) {
      this.bokehPass.uniforms.focus.value = this.camera.position.distanceTo(
        this.workVector
          .copy(this.magazine.position)
          .setY(0.08 + this.standeeLift * 0.55),
      );
    }
  }

  portraitAmount() {
    if (this.viewportAspect >= this.portraitAspect) return 0;
    return THREE.MathUtils.clamp(
      (this.portraitAspect - this.viewportAspect) / this.portraitRange,
      0,
      1,
    );
  }

  applyResponsiveCamera(base, target) {
    target.copy(base);
    const amount = this.portraitAmount();
    if (amount > 0) {
      target.y += amount * this.portraitPullY;
      target.z += amount * this.portraitPullZ;
    }
    return target;
  }

  // Slide the look-at toward the magazine's centerline on portrait so the cover
  // is framed symmetrically instead of biased off one edge.
  applyResponsiveTarget(target) {
    const amount = this.portraitAmount();
    if (amount > 0) {
      target.x = THREE.MathUtils.lerp(target.x, MAGAZINE_X, amount * this.portraitRecenter);
    }
    return target;
  }

  updateMicroMotion(elapsed) {
    if (!this.magazine) return;

    const drift = this.reducedMotion ? 0 : Math.sin(elapsed * 0.38) * 0.004;
    const tilt = this.reducedMotion ? 0 : Math.sin(elapsed * 0.25) * 0.0016;
    const hoverDrift = this.pointerSide === "left" ? -0.006 : this.pointerSide === "right" ? 0.006 : 0;
    this.magazine.rotation.y = -0.025 + drift + hoverDrift;
    this.magazine.rotation.x = tilt;
  }

  // --- HUD --------------------------------------------------------------------

  createLoader() {
    this.loader = document.createElement("div");
    this.loader.className = "loader";
    this.loader.innerHTML = `
      <div class="loader-mast">ATELIER</div>
      <div class="loader-sub">アトリヱ MAY 2026</div>
      <div class="loader-rule"><div class="loader-rule-fill"></div></div>
      <div class="loader-pct">00</div>
    `;
    this.container.appendChild(this.loader);
    this.loaderFill = this.loader.querySelector(".loader-rule-fill");
    this.loaderPct = this.loader.querySelector(".loader-pct");
  }

  setLoaderProgress(fraction) {
    if (!this.loaderFill) return;
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    this.loaderFill.style.transform = `scaleX(${clamped})`;
    this.loaderPct.textContent = String(Math.round(clamped * 100)).padStart(2, "0");
  }

  finishLoader() {
    this.setLoaderProgress(1);
    this.loader?.classList.add("is-done");

    const fonts = document.fonts?.ready ?? Promise.resolve();
    const minDelay = new Promise((resolve) => setTimeout(resolve, 450));
    Promise.all([fonts, minDelay]).then(() => {
      if (!this.disposed) this.hud?.classList.add("is-on");
    });
  }

  createHud() {
    this.hud = document.createElement("div");
    this.hud.className = "hud";
    this.hud.innerHTML = `
      <div class="hud-masthead hud-item">
        <div class="hud-masthead-title">ATELIER</div>
        <div class="hud-masthead-sub">MAY 2026 ・ VOL.08</div>
        <div class="hud-character" hidden>
          <span class="hud-character-name"></span>
          <span class="hud-character-intro"></span>
        </div>
        <div class="hud-masthead-actions">
          <button class="hud-locale" type="button" aria-label="表示言語を切り替える"><span class="loc-ja">日本語</span><span class="loc-sep"> / </span><span class="loc-zh">中文</span></button>
          <button class="hud-card" type="button" aria-label="このコーデの解説カードをひらく" hidden>コーデを読む</button>
          <button class="hud-share" type="button" aria-label="このページのリンクをコピー">リンクを共有</button>
        </div>
        <div class="hud-beat" hidden>
          <span class="hud-beat-kind"></span>
          <span class="hud-beat-prompt"></span>
        </div>
      </div>
      <div class="hud-feature hud-item">特集・白と海軍紺の構造美</div>
      <div class="hud-status hud-item">
        <div class="hud-page"><span class="jp">表紙</span></div>
        <div class="hud-rule"></div>
        <div class="hud-hint">クリックして表紙をひらく</div>
        <button class="hud-read" type="button" aria-label="誌面を拡大して読む">鑑賞モード</button>
        <button class="hud-tour" type="button" aria-label="コーデ解説をめぐる" hidden>コーデ解説をめぐる</button>
      </div>
      <div class="hud-keys hud-item">WASD・視点　QE・回転　R・リセット　F・ポーズ　C・解説　SPACE・鑑賞</div>
      <div class="hud-touch hud-item">ドラッグ・めくる　タップ・立たせる</div>
      <div class="hud-caption">
        <div class="cap-ja"></div>
        <div class="cap-zh"></div>
      </div>
    `;
    this.container.appendChild(this.hud);
    this.hudPage = this.hud.querySelector(".hud-page");
    this.hudHint = this.hud.querySelector(".hud-hint");
    this.hudCaption = this.hud.querySelector(".hud-caption");
    // C8 masthead-follow references (updated per-frame in syncMasthead)
    this.hudMastheadSub = this.hud.querySelector(".hud-masthead-sub");
    this.hudCharacter = this.hud.querySelector(".hud-character");
    this.hudCharacterName = this.hud.querySelector(".hud-character-name");
    this.hudCharacterIntro = this.hud.querySelector(".hud-character-intro");
    this.hudBeat = this.hud.querySelector(".hud-beat");
    this.hudBeatKind = this.hud.querySelector(".hud-beat-kind");
    this.hudBeatPrompt = this.hud.querySelector(".hud-beat-prompt");
    this.mastheadCharacterKey = null; // diff guard: "spread:locale" of last render

    // Tappable entry into the reading (鑑賞) overlay so touch devices, which
    // have no Space key, can still zoom a page. stopPropagation keeps the tap
    // from also reaching the canvas raycast (which would open/turn the page).
    this.hudRead = this.hud.querySelector(".hud-read");
    if (this.hudRead) {
      this.hudRead.addEventListener("pointerdown", (event) => event.stopPropagation());
      this.hudRead.addEventListener("click", (event) => {
        event.stopPropagation();
        this.toggleGallery();
      });
    }

    // Touch path into the guided commentary tour (C key was the only entry).
    // Shown only when the open spread has a risen, commentary-bearing figure;
    // stopPropagation keeps the tap off the canvas raycast, as with hud-read.
    this.hudTour = this.hud.querySelector(".hud-tour");
    if (this.hudTour) {
      this.hudTour.addEventListener("pointerdown", (event) => event.stopPropagation());
      this.hudTour.addEventListener("click", (event) => {
        event.stopPropagation();
        this.toggleTourOnCurrentSpread();
      });
    }

    // Locale toggle: flips the primary display language (ja ⇄ zh) and persists
    // it. stopPropagation keeps the tap off the canvas raycast, as with the
    // other HUD buttons. Lives in the masthead corner, clear of the bottom HUD.
    this.hudLocale = this.hud.querySelector(".hud-locale");
    if (this.hudLocale) {
      this.hudLocale.addEventListener("pointerdown", (event) => event.stopPropagation());
      this.hudLocale.addEventListener("click", (event) => {
        event.stopPropagation();
        this.setLocale(this.locale === "ja" ? "zh" : "ja");
      });
      this.syncLocaleButton();
    }

    // Share entry (E5): copies a deep link to the current spread + locale to the
    // clipboard. Lives in the masthead corner beside the locale toggle, clear of
    // the already-crowded bottom HUD. stopPropagation keeps the tap off the
    // canvas raycast, as with the other HUD buttons.
    this.hudShare = this.hud.querySelector(".hud-share");
    if (this.hudShare) {
      this.hudShare.addEventListener("pointerdown", (event) => event.stopPropagation());
      this.hudShare.addEventListener("click", (event) => {
        event.stopPropagation();
        this.copyShareLink();
      });
    }

    // CARD-1: the look-card entry. Shown only on spreads that carry a commentary
    // character (guard reads the same module-level spread→commentary index the
    // card reads — one source, two readers, never this.standees), so cover /
    // colophon / back / figure-less interiors never offer an empty card. Same
    // quiet pill + stopPropagation pattern as the share/locale buttons.
    this.hudCard = this.hud.querySelector(".hud-card");
    if (this.hudCard) {
      this.hudCard.addEventListener("pointerdown", (event) => event.stopPropagation());
      this.hudCard.addEventListener("click", (event) => {
        event.stopPropagation();
        // RACE-B-#2 (Sprint 6 / Iter 4): end any active tour first, same
        // pattern as toggleGallery (`if (this.tour) this.endTour()` at the
        // gallery entry point). Without this, the tour script keeps
        // advancing in the background while the card overlay is up — its
        // subtitle ticks and reveal beats would clobber the card without
        // the user seeing the tour ever ran.
        if (this.tour) this.endTour();
        this.openLookCard();
      });
    }

    this.cursorDot = document.createElement("div");
    this.cursorDot.className = "cursor-dot";
    this.cursorDot.innerHTML = `
      <span class="cursor-chevron left">‹</span>
      <span class="cursor-chevron right">›</span>
    `;
    this.container.appendChild(this.cursorDot);
    this.container.dataset.cursor = "none";
  }

  pageLabel() {
    if (this.state === "closedBack") {
      return `<span class="jp">裏表紙</span>`;
    }
    if (this.state === "closed" || this.state === "closing") {
      return `<span class="jp">表紙</span>`;
    }
    const left = this.spreadLeftPage(this.spreadIndex);
    const right = this.spreadRightPage(this.spreadIndex);
    const num = (pageIndex) => String(pageIndex + 2).padStart(2, "0");
    if (right === null) {
      return `P.${num(left)} ・ <span class="jp">奥付</span>`;
    }
    return `P.${num(left)} ・ ${num(right)}`;
  }

  syncHud() {
    if (!this.hudPage) return;
    const label = this.pageLabel();
    if (this.hudPage.dataset.label === label) return;
    this.hudPage.dataset.label = label;
    this.hudPage.classList.add("is-swapping");
    window.setTimeout(() => {
      if (this.disposed) return;
      this.hudPage.innerHTML = label;
      this.hudPage.classList.remove("is-swapping");
    }, 230);

    if (this.hudHint && !this.firstTurnDone) {
      const hint =
        this.state === "closed" || this.state === "closing"
          ? "クリックして表紙をひらく"
          : "ページの端をドラッグしてめくる";
      if (this.hudHint.textContent !== hint) this.hudHint.textContent = hint;
    }
    this.syncNarrativeBeat(true);
  }

  // HUD has no reactive framework, so the tour pill is shown/hidden by hand each
  // frame: visible only when the open spread has a risen, commentary-bearing
  // figure and we are neither touring, showing the runway, nor in 鑑賞.
  syncTourButton() {
    if (!this.hudTour) return;
    const available = !this.tour && !this.gallery && !!this.currentSpreadTourStandee();
    if (this.hudTour.hidden === !available) return;
    this.hudTour.hidden = !available;
    this.syncNarrativeBeat(true);
  }

  // Mark which language the locale toggle currently shows (used for styling the
  // active side) and keep its aria state honest.
  syncLocaleButton() {
    if (!this.hudLocale) return;
    this.hudLocale.dataset.locale = this.locale;
    this.hudLocale.setAttribute(
      "aria-label",
      this.locale === "ja" ? "中国語に切り替える" : "切换为日文",
    );
  }

  // The commentary character shown on the current open spread, or null. Unlike
  // currentSpreadTourStandee this does not require the figure to be risen — the
  // masthead reflects "whose spread this is" regardless of interaction state.
  currentSpreadCharacter() {
    if (this.state !== "open" || this.show) return null;
    for (const standee of this.standees.values()) {
      if (standee.spread === this.spreadIndex && standee.commentary?.character) {
        return standee.commentary.character;
      }
    }
    return null;
  }

  // C8: the masthead subtitle follows the current spread's character (in the
  // active locale), exposing the otherwise-hidden bilingual person metadata.
  // Spreads without a commentary figure fall back to the fixed issue line, and
  // nothing of the previous character is left behind. Diff-guarded by a
  // "spread:locale:has-character" key so it only writes the DOM on real change.
  syncMasthead(force = false) {
    if (!this.hudMastheadSub || !this.hudCharacter) return;
    const character = this.currentSpreadCharacter();
    const key = `${this.spreadIndex}:${this.locale}:${character ? "1" : "0"}:${this.state}`;
    if (!force && this.mastheadCharacterKey === key) return;
    this.mastheadCharacterKey = key;

    if (character) {
      this.hudMastheadSub.hidden = true;
      this.hudCharacter.hidden = false;
      if (this.hudCharacterName) {
        this.hudCharacterName.textContent = localeText(character.name, this.locale);
      }
      if (this.hudCharacterIntro) {
        this.hudCharacterIntro.textContent = localeText(character.intro, this.locale);
      }
    } else {
      this.hudCharacter.hidden = true;
      this.hudMastheadSub.hidden = false;
    }
    this.syncCardEntry();
  }

  // CARD-1 entry guard: show the "コーデを読む" pill only when the open spread
  // carries a commentary character. The predicate reads the module-level
  // spread→commentary index (NOT this.standees / currentSpreadCharacter — same
  // R-CARD-DATASOURCE red line as the card data), so cover / colophon / back /
  // figure-less interiors never offer an empty card, and the guard never lags a
  // standee build. Rides syncMasthead's per-frame diff-guard rhythm (only the DOM
  // write here is cheap and idempotent).
  syncCardEntry() {
    if (!this.hudCard) return;
    const onSpread =
      this.state === "open" &&
      !this.show &&
      spreadHasCommentary(this.spreadCommentaryIndex(), this.spreadIndex);
    if (this.hudCard.hidden === !onSpread) return;
    this.hudCard.hidden = !onSpread;
    this.syncNarrativeBeat(true);
  }

  currentNarrativeEvent() {
    if (this.state === "closed" || this.state === "closing") {
      return {
        id: "cover-closed",
        type: "cover",
        label: { ja: "表紙の儀式", zh: "封面仪式" },
        prompt: { ja: "表紙をひらく", zh: "打开封面" },
        emphasis: "cover",
        availability: { reader: true, standee: false, commentary: false, lookCard: false, runway: false },
      };
    }
    if (this.state === "closedBack") {
      return {
        id: "back-closed",
        type: "back",
        label: { ja: "裏表紙", zh: "封底" },
        prompt: { ja: "最後の余韻", zh: "最后的余韵" },
        emphasis: "closing",
        availability: { reader: true, standee: false, commentary: false, lookCard: false, runway: false },
      };
    }
    return this.resolvedPrimaryEvent();
  }

  primaryControlFor(type) {
    if (type === "read" || type === "cover" || type === "back") return this.hudRead;
    if (type === "lookCard") return this.hudCard;
    if (type === "commentary") return this.hudTour;
    return null;
  }

  setPrimaryControl(control, primaryControl) {
    if (!control) return;
    control.classList.toggle("is-primary", control === primaryControl);
    control.classList.toggle("is-secondary", !!primaryControl && control !== primaryControl);
  }

  clearDiscoveryClass(control) {
    if (!control) return;
    control.classList.remove("is-discovery");
    const timer = this.discoveryTimers.get(control);
    if (timer) window.clearTimeout(timer);
    this.discoveryTimers.delete(control);
  }

  markDiscoveryControl(control) {
    if (!control || this.reducedMotion || control.hidden) return;
    this.clearDiscoveryClass(control);
    control.classList.add("is-discovery");
    const timer = window.setTimeout(() => {
      this.clearDiscoveryClass(control);
    }, 3200);
    this.discoveryTimers.set(control, timer);
  }

  tryDiscoveryCue(key, { text = "", control = null, replace = false } = {}) {
    if (!key || this.discoverySeen.has(key)) return false;
    if (this.gallery || this.lookCard || this.show || this.tour) return false;
    const now = performance.now();
    if (text && !replace && now - this.lastDiscoveryAt < 2400) return false;
    this.discoverySeen.add(key);
    if (text && this.hudHint) {
      this.hudHint.textContent = text;
      this.hudHint.classList.remove("is-faded");
      this.lastDiscoveryAt = now;
    }
    this.markDiscoveryControl(control);
    return true;
  }

  syncNarrativeBeat(force = false) {
    if (!this.hudBeat) return;
    const event = this.currentNarrativeEvent();
    const hidden = this.gallery || this.lookCard || this.show || !event;
    const key = hidden
      ? "hidden"
      : `${this.state}:${this.spreadIndex}:${this.locale}:${event.id}:${event.type}:${this.hudCard?.hidden}:${this.hudTour?.hidden}`;
    if (!force && this.primaryEventKey === key) return;
    this.primaryEventKey = key;

    this.hudBeat.hidden = hidden;
    const primaryControl = hidden ? null : this.primaryControlFor(event.type);
    this.setPrimaryControl(this.hudRead, primaryControl);
    this.setPrimaryControl(this.hudTour, primaryControl);
    this.setPrimaryControl(this.hudCard, primaryControl);

    if (hidden) {
      this.container.dataset.primaryEvent = "";
      return;
    }

    this.container.dataset.primaryEvent = event.type;
    this.hudBeat.dataset.event = event.type;
    if (this.hudBeatKind) this.hudBeatKind.textContent = narrativeEventText(event, this.locale, "label");
    if (this.hudBeatPrompt) this.hudBeatPrompt.textContent = narrativeEventText(event, this.locale, "prompt");

    if (this.state === "open") {
      if (!this.firstTurnDone && this.tryDiscoveryCue("page-turn", { text: "ページ端をなぞると次の紙面へ" })) return;
      this.tryDiscoveryCue("reader", { control: this.hudRead });
      if ((event.type === "lookCard" || event.type === "commentary") && this.hudCard && !this.hudCard.hidden) {
        this.tryDiscoveryCue("look-card", { control: this.hudCard });
      }
    }
  }

  // Show a bilingual {ja,zh} field as a single-locale caption (default ja).
  // The source field is remembered so a locale switch re-renders the live
  // caption rather than leaving it in the old language (half-switch). The
  // secondary line is cleared: we now show one language, not both stacked.
  setCaption(field) {
    if (!this.hudCaption) return;
    // S18: a fresh caption cancels any pending fade from the previous line, so
    // a stale fade timer can't yank this new subtitle off a beat after it shows.
    this.clearCaptionFade();
    this.captionField = field;
    this.hudCaption.querySelector(".cap-ja").textContent = localeText(field, this.locale);
    this.hudCaption.querySelector(".cap-zh").textContent = "";
    this.hudCaption.classList.add("is-on");
  }

  hideCaption() {
    // S18: clearing the caption also drops any pending fade timer.
    this.clearCaptionFade();
    this.captionField = null;
    this.hudCaption?.classList.remove("is-on");
  }

  // Switch the display language and re-render every locale-bound surface at once
  // so there is no half-switch state (caption in zh while the swing tag is still
  // ja). Covers: the live caption, every visible swing tag (drawn into a canvas
  // texture), the masthead, and the locale toggle label. Persisted via C6.
  setLocale(locale, { persist = true } = {}) {
    if (locale !== "ja" && locale !== "zh") return;
    if (locale === this.locale) return;
    this.locale = locale;
    // persist:false is for deep-link recovery — applying a shared link's
    // language must not overwrite the visitor's own stored preference (E5 red
    // line). The user's own toggle persists; opening someone else's link does not.
    if (persist) this.prefs = savePreferences({ locale });

    // live caption: re-render from the remembered source field
    if (this.captionField && this.hudCaption?.classList.contains("is-on")) {
      this.hudCaption.querySelector(".cap-ja").textContent = localeText(
        this.captionField,
        this.locale,
      );
    }

    // swing tags: any standee currently showing an item has a baked-in canvas
    // tag in the old language; redraw it so the figure's tag matches the caption
    for (const standee of this.standees.values()) {
      const cui = standee.cui;
      if (cui && cui.activeIndex >= 0 && cui.tagGroup?.visible) {
        const item = standee.commentary?.items?.[cui.activeIndex];
        if (item) this.drawTag(standee, item);
      }
    }

    this.syncLocaleButton();
    this.syncMasthead(true); // force re-render the masthead in the new language
    this.syncNarrativeBeat(true);

    // CARD-1 per-locale red line: a card open while the language flips must
    // re-render its fields immediately (title/intro/items/tags), so the card is
    // the first detail surface that switches language live — no half-switch.
    if (this.lookCard) this.renderLookCard();
  }

  fadeHint() {
    this.hudHint?.classList.add("is-faded");
  }

  // --- Session continuity (C9 skip-intro) -------------------------------------

  // Remember the spread the reader settled on, so a later visit can land back
  // here. Cheap and diff-guarded; called from the settle points (open / turn).
  recordSpread() {
    if (this.prefs.lastSpread === this.spreadIndex) return;
    this.prefs = savePreferences({ lastSpread: this.spreadIndex });
  }

  // The cinematic intro has now played through at least once: mark the visitor
  // as guided so the next visit skips straight to their last spread.
  markGuided() {
    if (this.prefs.guidedOnce && this.prefs.skipIntro) return;
    this.prefs = savePreferences({ guidedOnce: true, skipIntro: true });
  }

  // Shared "land on a settled-open spread" kernel. The geometry/material/
  // visibility invariants live here once, so returning-visit restore (C9), the
  // 鑑賞 write-back (D2) and deep-link recovery (E5) all settle through the same
  // path instead of three drifting copies. Built from the canonical settled-open
  // helpers (restoreStacks + applySpread) plus the cover-hinge end pose that
  // updateAnimation's open completion sets, so it matches a normal intro finish.
  //
  // Options:
  // - persist (default true): write the landed spread back to lastSpread (C6).
  //   Returning-visit restore and the user's own 鑑賞 browsing persist; opening
  //   someone else's deep link lands but does NOT (persist:false) so it never
  //   clobbers the visitor's own progress.
  // - snapCamera (default false): hard-cut the camera to the open framing,
  //   skipping the cinematic intro pan (used by the cold-start restore path).
  landOnSpread(spreadIndex, { persist = true, snapCamera = false } = {}) {
    // clamp into the valid range so a stale/out-of-range index can never throw
    const maxSpread = this.leafCount();
    this.spreadIndex = Math.min(Math.max(0, Math.trunc(spreadIndex) || 0), maxSpread);

    // cover laid fully open (mirrors updateAnimation open-completion end pose)
    this.coverHinge.rotation.z = Math.PI;
    this.coverHinge.position.y = COVER_OPEN_Y;

    // canonical settled-open invariants: page visibility/stacks + materials
    this.restoreStacks();
    this.applySpread();
    this.state = "open";

    if (snapCamera) {
      // skip the 4.2s camera intro and snap to the open framing so we don't pan in
      this.introComplete = true;
      this.introProgress = 1;
      const open = this.applyResponsiveCamera(this.cameraOpen, this.responsiveCameraDesired);
      this.camera.position.copy(open);
      this.cameraTarget.copy(this.applyResponsiveTarget(this.desiredTargetWork.copy(this.targetOpen)));
      this.camera.lookAt(this.cameraTarget);
    }

    this.firstTurnDone = this.spreadIndex > 0; // past the first turn already
    this.syncHud();
    this.syncMasthead(true);
    this.syncNarrativeBeat(true);
    if (persist) this.recordSpread();
    return this.spreadIndex;
  }

  // On a returning visit (intro already seen), skip the cinematic open and land
  // directly in the settled-open state at the last-read spread. Delegates the
  // geometry to the shared landOnSpread kernel (persist+snapCamera) so the
  // settled-open invariants match a normal intro finish exactly — no hand-rolled
  // state that could drift (errant standees, wrong materials).
  restoreSession() {
    if (!this.prefs.guidedOnce || !this.prefs.skipIntro) return false;
    // persist:true is a no-op here (the value already equals lastSpread), but
    // keeps the path honest as "the visitor's own settled position".
    this.landOnSpread(this.prefs.lastSpread, { persist: true, snapCamera: true });
    return true;
  }

  // --- Deep links (E5) --------------------------------------------------------

  // Open a shared link in the encoded state: land on its spread and apply its
  // language, WITHOUT touching the visitor's own persisted progress or locale
  // (persist:false everywhere). Returns true if it consumed a spread (so the
  // caller can skip restoreSession — the link wins over the local last-spread).
  // A link carrying only a language still applies it temporarily but lets the
  // normal spread restore run. Out-of-range/garbage params resolve to null in
  // the codec and are simply ignored (landOnSpread also clamps defensively).
  applyDeepLink() {
    const search = typeof window !== "undefined" ? window.location?.search ?? "" : "";
    const state = parseDeepLink(search);
    if (!hasDeepLinkState(state)) return false;

    // temporary language: applied to the live surfaces but not persisted
    if (state.locale && state.locale !== this.locale) {
      this.setLocale(state.locale, { persist: false });
    }

    if (state.spread !== null) {
      // temporary spread: lands but never writes lastSpread
      const landed = this.landOnSpread(state.spread, { persist: false, snapCamera: true });
      // CODEC-1 + CARD-1: a nested item opens the look card directly on the landed
      // spread. Data comes from the module-level index (NOT this.standees), so the
      // card has content even though loadStandees has not built any figure yet
      // (the cold-start race this red line exists to defeat). An out-of-range item
      // is ignored — isItemInRange returns false → land the whole spread, open NO
      // empty card. Card/item state is temporary and never persisted.
      if (
        state.item !== null &&
        isItemInRange(this.spreadCommentaryIndex(), landed, state.item)
      ) {
        this.openLookCard(landed, state.item);
      }
      return true;
    }
    return false;
  }

  // The current reading state as a shareable absolute URL (spread + locale),
  // built off a clean origin+path (no inherited query/hash). closed/closedBack
  // encode as spread 0 / final spread so the recipient lands somewhere valid.
  currentShareUrl() {
    const base =
      typeof window !== "undefined" && window.location
        ? `${window.location.origin}${window.location.pathname}`
        : "";
    let spread = this.spreadIndex;
    if (this.state === "closed" || this.state === "closing") spread = 0;
    else if (this.state === "closedBack") spread = this.leafCount();
    // CODEC-1: when a look card is open on this very spread, the share link
    // carries its item so "share this look" lands the recipient on the same card.
    // The card only opens on the current open spread, so the item rides this
    // spread (nested contract); buildShareUrl drops the item if spread is null.
    let item = null;
    if (this.lookCard && this.lookCard.spread === spread) {
      item = Number.isInteger(this.lookCard.item) ? this.lookCard.item : null;
    }
    return buildShareUrl(base, { spread, locale: this.locale, item });
  }

  // Copy the current share URL to the clipboard and flash a short confirmation
  // on the button. Falls back to a legacy execCommand copy where the async
  // Clipboard API is unavailable (insecure context / older browser); if even
  // that fails the link is still surfaced so nothing is silently lost.
  copyShareLink() {
    const url = this.currentShareUrl();
    const flash = (ok) => {
      if (!this.hudShare) return;
      this.hudShare.classList.add(ok ? "is-copied" : "is-failed");
      this.hudShare.textContent = ok ? "コピーしました" : "コピー失敗";
      window.clearTimeout(this.shareFlashTimer);
      this.shareFlashTimer = window.setTimeout(() => {
        if (this.disposed || !this.hudShare) return;
        this.hudShare.classList.remove("is-copied", "is-failed");
        this.hudShare.textContent = "リンクを共有";
      }, 1600);
    };

    const legacyCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash(true),
        () => flash(legacyCopy()),
      );
    } else {
      flash(legacyCopy());
    }
  }

  // --- Look card (CARD-1) -----------------------------------------------------

  // Open the look card for a spread (defaults to the current open spread). The
  // card is a paper "magazine feature page" that parasitizes the 鑑賞 overlay
  // shell (its own absolute layer, z-index above the canvas) — it never draws
  // over the 3D scene as a second canvas-covering layer, and it is mutually
  // exclusive with the flipbook (closing one before opening the other). Data
  // comes from the module-level spread→commentary index (R-CARD-DATASOURCE), so
  // a deep-link cold open (`?spread=N&item=M`, standees not yet built) still has
  // data. `item` highlights one look (clamped/ignored when out of range — no
  // empty card). Card/item state is screen-only and NEVER persisted to C6.
  openLookCard(spread = this.spreadIndex, item = null) {
    if (typeof spread !== "number" || !Number.isFinite(spread)) return false;
    // RACE-B-#1/#4 (Sprint 6 / Iter 4): refuse to open while a runway show
    // is playing or a page turn is in flight. A deep-link `?spread=N&item=M`
    // arriving mid-show used to layer the card overlay on top of a dimmed
    // scene; mid-turn it would land the card on a stale spreadIndex and the
    // `finishTurn` continuation would clobber it. Cheap state guard, no
    // user-visible regression (these windows are sub-second).
    if (this.show) return false;
    if (this.turn) return false;
    if (this.tour) this.endTour();
    this.clearPeel();
    // S18: opening the look card tears down captions today → tear down voice +
    // caption (a one-shot commentary line could be speaking when the card opens).
    this.stopVoice();
    this.hideCaption();
    // a card and the flipbook are mutually exclusive — never both on screen.
    if (this.gallery) this.closeGallery();
    // guard: no commentary on this spread → no card (defense in depth; the entry
    // pill is already hidden, but a deep link could ask for an empty spread).
    if (!spreadHasCommentary(this.spreadCommentaryIndex(), spread)) return false;

    const activeItem =
      isItemInRange(this.spreadCommentaryIndex(), spread, item) ? item : null;

    if (this.lookCard) {
      // already open — just retarget (e.g. a deep link or a re-open).
      this.lookCard.spread = spread;
      this.lookCard.item = activeItem;
      this.renderLookCard();
      return true;
    }

    const el = document.createElement("div");
    el.className = "look-card";
    el.innerHTML = `
      <div class="look-card-sheet" role="dialog" aria-modal="true" aria-label="コーデ解説カード">
        <button class="look-card-close" type="button" aria-label="カードを閉じる">✕</button>
        <div class="look-card-scroll">
          <header class="look-card-head">
            <div class="look-card-kicker">ATELIER ・ コーデ特集</div>
            <h2 class="look-card-title"></h2>
            <div class="look-card-person">
              <div class="look-card-name"></div>
              <p class="look-card-intro"></p>
            </div>
          </header>
          <div class="look-card-runway"></div>
          <ol class="look-card-items" role="list"></ol>
          <div class="look-card-actions">
            <button class="look-card-backlink" type="button">誌面でこのページを見る</button>
            <button class="look-card-share" type="button" aria-label="このコーデのリンクをコピー">リンクを共有</button>
          </div>
        </div>
      </div>
    `;
    this.container.appendChild(el);

    // stopPropagation on the sheet keeps taps off the canvas raycast (turning the
    // page) while the card is up; the dark scrim closes the card on a tap.
    const sheet = el.querySelector(".look-card-sheet");
    sheet.addEventListener("pointerdown", (event) => event.stopPropagation());
    el.addEventListener("pointerdown", (event) => event.stopPropagation());
    el.addEventListener("click", (event) => {
      // a click on the scrim (not the sheet) closes the card.
      if (event.target === el) this.closeLookCard();
    });
    el.querySelector(".look-card-close").addEventListener("click", (event) => {
      event.stopPropagation();
      this.closeLookCard();
    });
    // BACKLINK (R-CARD-BACKLINK): "see this page in the magazine" — close the
    // card and land the 3D magazine on this spread via the shared landOnSpread
    // kernel (persist:false — a card visit must never write the deep-link/temp
    // state into the visitor's own progress), so the card is never a dead end.
    el.querySelector(".look-card-backlink").addEventListener("click", (event) => {
      event.stopPropagation();
      const target = this.lookCard ? this.lookCard.spread : spread;
      this.closeLookCard();
      this.landOnSpread(target, { persist: false });
    });
    el.querySelector(".look-card-share").addEventListener("click", (event) => {
      event.stopPropagation();
      this.copyLookCardLink(event.currentTarget);
    });

    this.lookCard = { el, sheet, spread, item: activeItem };
    this.renderLookCard();
    this.syncNarrativeBeat(true);

    // reduced-motion: appear at once (mirror the G1 / gallery guard); otherwise
    // the .is-on class drives the CSS fade. setTimeout (not rAF) so the fade-in
    // still runs if the tab is backgrounded.
    if (this.reducedMotion) {
      el.classList.add("is-on");
    } else {
      window.setTimeout(() => {
        if (this.lookCard && this.lookCard.el === el) el.classList.add("is-on");
      }, 20);
    }
    return true;
  }

  // Render (or re-render) the open card's fields in the active locale. Called on
  // open, on retarget, and from setLocale — so the card is the first detail
  // surface that truly switches language live, with no half-switch state.
  renderLookCard() {
    const card = this.lookCard;
    if (!card) return;
    const vm = buildCardViewModel(
      this.spreadCommentaryIndex(),
      card.spread,
      this.locale,
      card.item,
    );
    if (!vm) {
      // a spread lost its commentary (should not happen) — close rather than
      // leave a blank card up.
      this.closeLookCard();
      return;
    }
    const { el } = card;
    const q = (sel) => el.querySelector(sel);
    q(".look-card-title").textContent = vm.title;
    q(".look-card-name").textContent = vm.character.name;
    q(".look-card-intro").textContent = vm.character.intro;
    const runway = q(".look-card-runway");
    if (vm.runwayIntro) {
      runway.textContent = vm.runwayIntro;
      runway.hidden = false;
    } else {
      runway.hidden = true;
    }

    const list = q(".look-card-items");
    list.innerHTML = "";
    vm.items.forEach((item, i) => {
      const li = document.createElement("li");
      li.className = "look-card-item";
      li.setAttribute("role", "listitem");
      if (i === vm.activeItem) li.classList.add("is-active");
      const tags = item.tags.length
        ? `<div class="look-card-tags">${item.tags
            .map((t) => `<span>${this.escapeHtml(t)}</span>`)
            .join("")}</div>`
        : "";
      li.innerHTML = `
        <div class="look-card-item-head">
          <span class="look-card-item-no">${String(i + 1).padStart(2, "0")}</span>
          <span class="look-card-item-name">${this.escapeHtml(item.name)}</span>
          <span class="look-card-item-part">${this.escapeHtml(item.part)}</span>
        </div>
        ${tags}
        <p class="look-card-item-text">${this.escapeHtml(item.text)}</p>
      `;
      list.appendChild(li);
    });

    // keep the active item in view when a deep link targets one.
    if (this.reducedMotion === false && Number.isInteger(vm.activeItem)) {
      const activeEl = list.querySelector(".look-card-item.is-active");
      activeEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  // Minimal HTML-escape for the commentary strings injected into the card markup
  // (commentary is bundled authored content, but escaping keeps the markup robust
  // and avoids any stray `<`/`&` breaking the layout).
  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  closeLookCard() {
    const card = this.lookCard;
    if (!card) return;
    this.lookCard = null;
    this.syncNarrativeBeat(true);
    card.el.classList.remove("is-on");
    if (this.reducedMotion) {
      card.el.remove();
    } else {
      window.setTimeout(() => card.el.remove(), 320);
    }
  }

  // Copy the share link for the open card (spread + item + locale) and flash a
  // brief confirmation on the card's own share button, mirroring copyShareLink.
  copyLookCardLink(button) {
    const url = this.currentShareUrl();
    const flash = (ok) => {
      if (!button) return;
      button.classList.add(ok ? "is-copied" : "is-failed");
      button.textContent = ok ? "コピーしました" : "コピー失敗";
      window.clearTimeout(this.cardShareFlashTimer);
      this.cardShareFlashTimer = window.setTimeout(() => {
        if (this.disposed || !button.isConnected) return;
        button.classList.remove("is-copied", "is-failed");
        button.textContent = "リンクを共有";
      }, 1600);
    };
    const legacyCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash(true),
        () => flash(legacyCopy()),
      );
    } else {
      flash(legacyCopy());
    }
  }

  // --- Colophon (inside of the back cover) ------------------------------------

  async buildColophon() {
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      if (this.disposed) return;

      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = Math.round((1024 * PAGE_HEIGHT) / PAGE_WIDTH);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#f3ecdd";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      ctx.textAlign = "center";

      ctx.fillStyle = "rgba(28, 22, 16, 0.30)";
      ctx.fillRect(cx - 70, canvas.height * 0.56, 140, 2);

      ctx.fillStyle = "rgba(28, 22, 16, 0.80)";
      ctx.font = "44px 'Shippori Mincho', serif";
      ctx.fillText("ア ト リ ヱ", cx, canvas.height * 0.62);

      ctx.font = "30px Italiana, serif";
      ctx.fillStyle = "rgba(28, 22, 16, 0.62)";
      ctx.fillText("A T E L I E R", cx, canvas.height * 0.655);

      ctx.font = "22px 'Shippori Mincho', serif";
      ctx.fillStyle = "rgba(28, 22, 16, 0.55)";
      ctx.fillText("MAY 2026 ・ VOL.08", cx, canvas.height * 0.70);
      ctx.fillText("発行・atelier press", cx, canvas.height * 0.735);
      ctx.fillText("表紙・雪ノ下 雪乃", cx, canvas.height * 0.77);

      ctx.font = "18px Italiana, serif";
      ctx.fillStyle = "rgba(28, 22, 16, 0.40)";
      ctx.fillText("P R I N T E D  I N  W E B G L", cx, canvas.height * 0.82);

      ctx.font = "20px 'Shippori Mincho', serif";
      ctx.fillStyle = "rgba(28, 22, 16, 0.45)";
      ctx.fillText("奥付", cx, canvas.height * 0.92);

      this.colophonCanvas = canvas;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.maxAnisotropy;
      this.disposables.push(texture);

      this.colophonMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.82,
        metalness: 0,
        normalMap: this.paperNormal,
        normalScale: new THREE.Vector2(0.1, 0.1),
        roughnessMap: this.paperRoughness,
        aoMap: this.paperAo,
        envMapIntensity: RENDER.envMap.colophon,
      });
      this.disposables.push(this.colophonMaterial);
      if (this.assetsReady && (this.state === "open" || this.state === "closed")) {
        this.applySpread();
      }
    } catch {
      /* colophon is decorative; the blank paper material remains the fallback */
    }
  }

  // --- Audio ------------------------------------------------------------------

  startAudio() {
    // S18-AUTOPLAY-1: this is the single audio-unlock path, called from the
    // first pointerdown (a user gesture). On a re-entry — including a voice tap
    // that arrives after audio is already up — resume the context if the browser
    // suspended it, so voice plays without standing up a competing unlock.
    if (this.audio.started) {
      if (this.audio.ctx && this.audio.ctx.state === "suspended") {
        this.audio.ctx.resume().catch(() => {});
      }
      return;
    }
    this.audio.started = true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.audio.ctx = new Ctx();
    // Resume immediately: some browsers create the context suspended even on a
    // gesture. Never throws (the promise rejection is swallowed).
    if (this.audio.ctx.state === "suspended") {
      this.audio.ctx.resume().catch(() => {});
    }

    // S18-BUS-1: a dedicated voice gain node fed into the bus destination, plus
    // an analyser tap for amplitude-driven lip sync. Built once, reused for
    // every line, torn down in dispose.
    this.voiceGain = this.audio.ctx.createGain();
    this.voiceGain.gain.value = 1;
    this.voiceAnalyser = this.audio.ctx.createAnalyser();
    this.voiceAnalyser.fftSize = 256;
    this.voiceFreqData = new Uint8Array(this.voiceAnalyser.fftSize);
    // voice → analyser → gain → destination
    this.voiceGain.connect(this.voiceAnalyser);
    this.voiceAnalyser.connect(this.audio.ctx.destination);

    const loadVariants = async (key, paths) => {
      const buffers = [];
      for (const base of paths) {
        for (const ext of [".ogg", ".mp3"]) {
          try {
            const response = await fetch(base + ext);
            if (!response.ok) continue;
            const data = await response.arrayBuffer();
            const buffer = await this.audio.ctx.decodeAudioData(data);
            buffers.push(buffer);
            break;
          } catch {
            /* missing or undecodable audio stays silent */
          }
        }
      }
      if (buffers.length) this.audio.buffers.set(key, buffers);
      return buffers.length > 0;
    };

    void Promise.all(
      Object.entries(AUDIO_SOURCES).map(([key, paths]) => loadVariants(key, paths)),
    ).then(() => {
      if (this.disposed || !this.audio.buffers.has("roomTone")) return;
      const source = this.audio.ctx.createBufferSource();
      source.buffer = this.audio.buffers.get("roomTone")[0];
      source.loop = true;
      const gain = this.audio.ctx.createGain();
      gain.gain.value = ROOM_TONE_GAIN;
      source.connect(gain).connect(this.audio.ctx.destination);
      source.start();
      // S18-BUS-1: keep the room-tone gain so playVoice can duck it while a
      // voice is active and restore it cleanly afterwards.
      this.roomToneGain = gain;
      // If a voice is already speaking (a line tapped before room tone loaded),
      // duck immediately so we don't pop up to full ambience underneath it.
      if (this.voice) this.duckRoomTone(true);
    });
  }

  // Smoothly duck (or restore) the looped room tone around active voice. No-op
  // when room tone never loaded (today's state — the file is absent).
  duckRoomTone(active) {
    const gain = this.roomToneGain;
    const ctx = this.audio.ctx;
    if (!gain || !ctx) return;
    const target = active ? ROOM_TONE_GAIN * ROOM_TONE_DUCK : ROOM_TONE_GAIN;
    const now = ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(target, now + 0.18);
    } catch {
      gain.gain.value = target;
    }
  }

  playSound(key, { gain = 0.5, rate = 1 } = {}) {
    const buffers = this.audio.buffers.get(key);
    if (!buffers || !this.audio.ctx) return;
    const source = this.audio.ctx.createBufferSource();
    source.buffer = buffers[Math.floor(Math.random() * buffers.length)];
    source.playbackRate.value = rate;
    const gainNode = this.audio.ctx.createGain();
    gainNode.gain.value = gain;
    source.connect(gainNode).connect(this.audio.ctx.destination);
    source.start();
  }

  // --- Voice (S18) ------------------------------------------------------------

  // Decode (and cache) an AudioBuffer for a voice URL. Returns null when the
  // context is unavailable or the fetch/decode fails (missing file → silent
  // degrade, never throws). The smoke harness can pre-seed `voiceUrlCache` with
  // a synthetic buffer so the real path runs without committing any binary.
  async decodeVoiceBuffer(url) {
    if (!url || !this.audio.ctx) return null;
    if (this.voiceUrlCache.has(url)) return this.voiceUrlCache.get(url);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.voiceUrlCache.set(url, null);
        return null;
      }
      const data = await response.arrayBuffer();
      const buffer = await this.audio.ctx.decodeAudioData(data);
      this.voiceUrlCache.set(url, buffer);
      return buffer;
    } catch {
      // missing or undecodable voice stays silent (S18 degrade contract)
      this.voiceUrlCache.set(url, null);
      return null;
    }
  }

  // Play an optional voice line for a caption. `line` is a commentary line
  // (intro / item / runwayIntro) carrying an optional resolved `voiceUrl` and an
  // optional `mouth` mapping. `caption` is the bilingual field to show. `card`
  // is the expression card to drive lip sync on (or null).
  //
  // Contract (S18-BUS-1 / SUBTITLE-1 / LIPSYNC-1):
  //   - Subtitle shows immediately (it must never wait on async audio).
  //   - A new line stops the previous voice; rapid repeat taps are debounced.
  //   - Voice routes through the dedicated voice gain; room tone ducks while
  //     active and restores when it ends or is interrupted.
  //   - With no voiceUrl (today's state) the caption behaves exactly as before:
  //     it is set and left to the existing auto-hide / teardown paths.
  //   - Lip sync only engages when the line supplies a `mouth` cell mapping AND
  //     reduced-motion is off; otherwise the card shows its normal expression.
  playVoice(line, caption, card = null, { dedupKey = null } = {}) {
    // Always show the caption right away; it owns the bottom band whether or not
    // a voice ever plays. Callers that want the legacy timing pass through here.
    if (caption) this.setCaption(caption);

    const url = line && typeof line === "object" ? line.voiceUrl : null;

    // Debounce: a re-tap of the same line while it is (or just was) speaking
    // must not stack a second voice. New, distinct lines always interrupt.
    const key = dedupKey ?? url ?? (caption ? JSON.stringify(caption) : null);
    const now = performance.now();
    if (
      key &&
      key === this.lastVoiceTapKey &&
      now - this.lastVoiceTapAt < VOICE_RETAP_DEBOUNCE_MS
    ) {
      this.lastVoiceTapAt = now;
      return;
    }
    this.lastVoiceTapKey = key;
    this.lastVoiceTapAt = now;

    // Any pending caption fade from a previous line is now stale.
    this.clearCaptionFade();

    if (!url || !this.audio.ctx) {
      // No voice asset (or audio not unlocked yet): subtitle-only path. Stop any
      // prior voice so a lingering line can't keep ducking the room tone.
      this.stopVoice();
      return;
    }

    // A new line interrupts the previous voice cleanly before starting.
    this.stopVoice();

    const mouth = this.resolveMouthCells(line, card);
    const session = { url, card, mouth, stopped: false, source: null };
    this.voice = session;

    void this.decodeVoiceBuffer(url).then((buffer) => {
      // Guard: disposed, interrupted by a newer line, or decode failed.
      if (this.disposed || this.voice !== session || session.stopped) return;
      if (!buffer || !this.audio.ctx || !this.voiceGain) {
        // decode failed — fall back to subtitle-only, drop the dead session.
        if (this.voice === session) this.voice = null;
        return;
      }
      const source = this.audio.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.audio.ctx.createGain();
      gain.gain.value = VOICE_GAIN;
      source.connect(gain).connect(this.voiceGain);
      session.source = source;
      session.gain = gain;
      source.onended = () => {
        if (this.voice === session && !session.stopped) this.onVoiceEnded(session);
      };
      this.duckRoomTone(true);
      if (mouth) this.activeMouthCard = card;
      try {
        source.start();
      } catch {
        // a context that refuses to start (rare) falls back to subtitle-only.
        if (this.voice === session) this.voice = null;
        this.duckRoomTone(false);
      }
    });
  }

  // Resolve an optional two-cell mouth mapping for lip sync. Supports either a
  // shorthand string (reserved for future authoring) or an object
  // `{ closed, open }` of expression-sheet cell indices. Returns null when the
  // line has no mouth mapping (today's assets), so the card just shows its
  // normal expression and no mouth flicker is forced.
  resolveMouthCells(line, card) {
    if (!card || !line || typeof line !== "object") return null;
    const mouth = line.mouth;
    if (!mouth) return null;
    let closed;
    let open;
    if (typeof mouth === "object") {
      closed = mouth.closed;
      open = mouth.open;
    }
    if (!Number.isInteger(closed) || !Number.isInteger(open)) return null;
    if (closed < 0 || closed >= EXPRESSION_CELLS) return null;
    if (open < 0 || open >= EXPRESSION_CELLS) return null;
    return { closed, open, lastOpen: null };
  }

  // The active voice finished on its own. Hold the caption briefly, then fade it
  // (spec: 0.6–1.2 s after the line ends) and restore the room tone.
  onVoiceEnded(session) {
    this.voice = null;
    this.duckRoomTone(false);
    this.releaseMouth(session?.card);
    this.scheduleCaptionFade();
  }

  // Stop the active voice immediately (interruption: new line, page turn, any
  // state teardown). Restores room tone, releases lip sync, leaves no source or
  // timer dangling. Idempotent and safe before audio ever started.
  stopVoice() {
    const session = this.voice;
    if (!session) {
      // even with no active session, make sure ambience is at rest.
      this.releaseMouth(this.activeMouthCard);
      return;
    }
    session.stopped = true;
    this.voice = null;
    if (session.source) {
      session.source.onended = null;
      try {
        session.source.stop();
      } catch {
        /* already stopped */
      }
      try {
        session.source.disconnect();
        session.gain?.disconnect();
      } catch {
        /* nodes already torn down */
      }
    }
    this.duckRoomTone(false);
    this.releaseMouth(session.card);
  }

  // Reset a card's mouth back to its expression cell after lip sync ends.
  releaseMouth(card) {
    this.activeMouthCard = null;
    if (!card) return;
    // re-write the card's current expression cell so the mouth is "closed"
    // (i.e. the normal expression frame), undoing any open-mouth UV.
    if (typeof card.cell === "number") this.writeExpressionUv(card, card.cell);
  }

  // --- Caption fade (S18-SUBTITLE-1) ------------------------------------------

  clearCaptionFade() {
    if (this.captionFadeTimer) {
      window.clearTimeout(this.captionFadeTimer);
      this.captionFadeTimer = null;
    }
  }

  // Fade the caption out a beat after the voice line ends. A tour line never
  // self-fades (the tour drives its own caption cadence); a one-shot commentary
  // line does.
  scheduleCaptionFade() {
    this.clearCaptionFade();
    if (this.tour) return; // tour owns the caption; let updateTour advance it
    this.captionFadeTimer = window.setTimeout(() => {
      this.captionFadeTimer = null;
      if (this.disposed) return;
      this.hideCaption();
    }, VOICE_CAPTION_FADE_MS);
  }

  // --- Lip sync (S18-LIPSYNC-1) -----------------------------------------------

  // Read the live voice amplitude and toggle a two-frame mouth on the active
  // card. Engages ONLY when:
  //   - a voice is actually playing through the analyser, AND
  //   - the line supplied a valid `mouth` cell mapping (resolved on play), AND
  //   - reduced-motion is off (RM freezes rapid mouth/expression flicker but
  //     still lets the audio play).
  // Current expression sheets have no dedicated mouth cells, so production lines
  // carry no `mouth` mapping → `session.mouth` is null → this is a pure no-op
  // (the card keeps its normal expression, no forced flicker). Returns the RMS
  // it sampled (0 when idle) so the smoke harness can assert a non-zero reading.
  updateLipSync() {
    const session = this.voice;
    if (
      !session ||
      !session.source ||
      !this.voiceAnalyser ||
      !this.voiceFreqData
    ) {
      return 0;
    }
    // RMS over the time-domain window: a cheap, stable amplitude proxy.
    this.voiceAnalyser.getByteTimeDomainData(this.voiceFreqData);
    const data = this.voiceFreqData;
    let sumSq = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = (data[i] - 128) / 128; // center & normalize to [-1, 1]
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / data.length);
    this.lastVoiceRms = rms;

    const mouth = session.mouth;
    const card = session.card;
    // No mouth mapping (today's assets) or reduced-motion → never flicker the
    // mouth; the card shows its normal expression frame.
    if (!mouth || !card || this.reducedMotion) return rms;

    const open = rms >= MOUTH_RMS_THRESHOLD;
    if (mouth.lastOpen === open) return rms; // no change → no UV churn
    mouth.lastOpen = open;
    this.writeExpressionUv(card, open ? mouth.open : mouth.closed);
    return rms;
  }

  // --- Events, sizing -----------------------------------------------------------

  bindEvents() {
    this.inputTarget = this.renderer.domElement;
    window.addEventListener("resize", this.handleResize);
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
    this.inputTarget.addEventListener("pointerdown", this.handlePointerDown);
    this.inputTarget.addEventListener("pointermove", this.handlePointerMove);
    this.inputTarget.addEventListener("pointerup", this.handlePointerUp);
    this.inputTarget.addEventListener("pointercancel", this.handlePointerUp);
    this.inputTarget.addEventListener("pointerleave", this.handlePointerLeave);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);
    // BUG-QUALITY-STUCK (b): tab-restore must reset adaptive quality state.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  // --- Keyboard -------------------------------------------------------------

  handleKeyDown(event) {
    if (!this.assetsReady) return;

    // CARD-1: while the look card is up it owns the keyboard — Esc / Space close
    // it (returning to the 3D view in its current settle, nothing 3D changes) and
    // every other key is swallowed so it can't flip the page underneath the card.
    if (this.lookCard) {
      if (event.code === "Escape" || event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) this.closeLookCard();
      }
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      // Inside 鑑賞 with the table of contents open, Space closes the grid back to
      // the book (a layer-at-a-time dismiss) instead of leaving 鑑賞 outright.
      if (this.gallery?.tocOpen) {
        if (!event.repeat) this.gallery.setToc?.(false);
        return;
      }
      if (!event.repeat) this.toggleGallery();
      return;
    }
    if (event.code === "Escape") {
      if (this.gallery?.tocOpen) this.gallery.setToc?.(false);
      else if (this.gallery) this.closeGallery();
      return;
    }
    if (this.gallery) {
      // The table of contents owns the keyboard while it is open: don't let arrow
      // keys flip the book underneath the grid.
      if (this.gallery.tocOpen) return;
      if (event.code === "ArrowRight" || event.code === "ArrowDown") this.galleryFlip(1);
      else if (event.code === "ArrowLeft" || event.code === "ArrowUp") this.galleryFlip(-1);
      return;
    }

    if (RIG_KEYS.includes(event.code)) {
      this.keys.add(event.code);
    } else if (event.code === "KeyR") {
      // the camera smoothing eases the jump back to the framed view
      this.rig.yaw = 0;
      this.rig.dolly = 1;
      this.rig.pan = 0;
    } else if (event.code === "KeyF" && !event.repeat) {
      this.flipRisenPoses();
    } else if (event.code === "KeyC" && !event.repeat) {
      this.toggleTourOnCurrentSpread();
    }
  }

  handleKeyUp(event) {
    this.keys.delete(event.code);
  }

  handleWindowBlur() {
    this.keys.clear();
  }

  updateRigInput(delta) {
    if (this.gallery || this.keys.size === 0) return;
    const rig = this.rig;
    const clamp = THREE.MathUtils.clamp;
    if (this.keys.has("KeyQ")) rig.yaw = clamp(rig.yaw + delta * 1.1, -1.15, 1.15);
    if (this.keys.has("KeyE")) rig.yaw = clamp(rig.yaw - delta * 1.1, -1.15, 1.15);
    if (this.keys.has("KeyW")) rig.dolly = clamp(rig.dolly - delta * 0.7, 0.55, 1.8);
    if (this.keys.has("KeyS")) rig.dolly = clamp(rig.dolly + delta * 0.7, 0.55, 1.8);
    if (this.keys.has("KeyA")) rig.pan = clamp(rig.pan - delta * 0.55, -0.85, 0.85);
    if (this.keys.has("KeyD")) rig.pan = clamp(rig.pan + delta * 0.55, -0.85, 0.85);
  }

  // --- Gallery (鑑賞モード) ---------------------------------------------------

  // The whole issue in reading order, so the overlay can page through it
  // linearly: cover, every interior page, the colophon, then the back cover.
  // Page URLs are eager, so all pages are addressable even before their 3D
  // textures have streamed in.
  galleryEntries() {
    const jp = (text) => `<span class="jp">${text}</span>`;
    const entries = [{ key: "cover", src: coverFrontUrl, label: jp("表紙") }];
    imagePageUrls.forEach((url, page) => {
      if (!url) return;
      entries.push({ key: `p${page}`, page, src: url, label: `P.${String(page + 2).padStart(2, "0")}` });
    });
    if (this.colophonCanvas) {
      entries.push({ key: "colophon", src: this.colophonCanvas.toDataURL("image/png"), label: jp("奥付") });
    }
    entries.push({ key: "back", src: backCoverUrl, label: jp("裏表紙") });
    return entries;
  }

  // Where to open the overlay: the page you are currently looking at.
  galleryStartIndex(entries) {
    if (this.state === "closedBack") return entries.length - 1;
    if (this.state !== "open") return 0; // closed -> cover
    const side = this.pointerSide === "left" ? "left" : "right";
    let page =
      side === "left"
        ? this.spreadLeftPage(this.spreadIndex)
        : this.spreadRightPage(this.spreadIndex);
    if (page === null) page = this.spreadLeftPage(this.spreadIndex);
    const found = entries.findIndex((e) => e.page === page);
    return found >= 0 ? found : 0;
  }

  toggleGallery() {
    if (this.gallery) {
      this.closeGallery();
      return;
    }
    if (this.show) return;
    // RACE-B-#3 (Sprint 6 / Iter 4): mirror openLookCard's `if (this.gallery)
    // this.closeGallery()` — the card and the flipbook are mutually exclusive
    // overlays (styles.css z-index 8 vs gallery 7) and the card's
    // `handleKeyDown` already swallows Space/Esc when open, so a stale card
    // would intercept the gallery keyboard nav until manually dismissed.
    if (this.lookCard) this.closeLookCard();
    if (this.state !== "open" && this.state !== "closed" && this.state !== "closedBack") return;
    // Build the whole-issue page list once and open on the page in view; the
    // ‹ › controls then walk the entire magazine, not just the current spread.
    const entries = this.galleryEntries();
    if (!entries.length) return;
    const startIndex = this.galleryStartIndex(entries);
    const info = entries[startIndex];
    if (!info) return;
    if (this.tour) this.endTour();
    // S18: opening 鑑賞 tears down captions today → tear down voice + caption.
    this.stopVoice();
    this.hideCaption();
    // BUG-GALLERY-RACE-A (Sprint 6 / Iter 2): cancel any in-flight turn before
    // entering the gallery overlay. animate() short-circuits while gallery is
    // up, so a stale settle would not be advanced — but the very first frame
    // after closeGallery would see raw >= 1 and finishTurn() would clobber
    // spreadIndex with turn.targetSpread, overwriting whatever applyGallery-
    // Landing just wrote. Apply the same 4-piece reset finishTurn uses (see
    // finishTurn at ~2854), pre-cancel instead of post-settle.
    if (this.turn) {
      this.turn = null;
      this.turningPage.visible = false;
      this.turningPage.rotation.z = 0;
      this.turningPage.position.y = TURN_BASE_Y;
    }
    this.clearPeel();
    this.keys.clear();

    const el = document.createElement("div");
    el.className = "gallery";
    el.innerHTML = `
      <div class="gallery-book"></div>
      <div class="gallery-label">${info.label}</div>
      <button class="gallery-close" type="button" aria-label="戻る">✕</button>
      <button class="gallery-toc-toggle" type="button" aria-label="目次" aria-expanded="false">⊞</button>
      <button class="gallery-nav prev" type="button" aria-label="前のページ">‹</button>
      <button class="gallery-nav next" type="button" aria-label="次のページ">›</button>
      <div class="gallery-hint">ページの端をめくる / ‹ ›　⊞ 目次　✕ / SPACE・戻る</div>
      <div class="gallery-toc" hidden>
        <div class="gallery-toc-grid" role="list"></div>
      </div>
    `;
    this.container.appendChild(el);

    // Single-page aspect taken from a loaded page, so the book is never distorted.
    const sample =
      this.pageMaterials.find((m) => m?.map?.image)?.map?.image ||
      this.coverFrontMaterial?.map?.image;
    const aspect = sample && sample.width ? sample.height / sample.width : PAGE_HEIGHT / PAGE_WIDTH;
    const baseW = 600;

    // Build real <img> pages. loadFromHTML keeps them as DOM images, which the
    // browser always rasterizes at native resolution (crisp at any DPR); the
    // loadFromImages path instead draws to a non-DPR-aware canvas and would blur
    // on high-DPI screens, which is exactly what we are trying to fix.
    const bookEl = el.querySelector(".gallery-book");
    for (const entry of entries) {
      const page = document.createElement("div");
      page.className = "gallery-page";
      if (entry.key === "cover" || entry.key === "back") page.dataset.density = "hard";
      const pageImg = document.createElement("img");
      pageImg.src = entry.src;
      pageImg.alt = "誌面";
      pageImg.draggable = false;
      page.appendChild(pageImg);
      bookEl.appendChild(page);
    }

    const pageFlip = new PageFlip(bookEl, {
      width: baseW,
      height: Math.round(baseW * aspect),
      size: "stretch",
      // StPageFlip switches to single-page portrait when the book is narrower
      // than minWidth*2; 260 -> phones (~<520px) read one page, tablets/desktop
      // keep the two-page spread.
      minWidth: 260,
      maxWidth: 1600,
      minHeight: 300,
      maxHeight: 2400,
      maxShadowOpacity: 0.5,
      showCover: true, // cover and back render as single hard pages
      usePortrait: true, // one page on narrow screens, a spread on wide ones
      mobileScrollSupport: false,
      flippingTime: 700,
      startPage: startIndex,
    });
    pageFlip.loadFromHTML(bookEl.querySelectorAll(".gallery-page"));

    const g = { el, pageFlip, entries };
    this.gallery = g;

    const label = el.querySelector(".gallery-label");
    const prevBtn = el.querySelector(".gallery-nav.prev");
    const nextBtn = el.querySelector(".gallery-nav.next");
    const syncChrome = () => {
      if (this.gallery !== g) return;
      const count = pageFlip.getPageCount() || entries.length;
      const i = THREE.MathUtils.clamp(pageFlip.getCurrentPageIndex(), 0, entries.length - 1);
      if (label) label.innerHTML = entries[i]?.label ?? "";
      if (prevBtn) prevBtn.hidden = i <= 0;
      if (nextBtn) nextBtn.hidden = i >= count - 1;
    };
    // The thumbnail table of contents: a grid of every page in the issue so the
    // reader can see the whole magazine at a glance and jump to any page in one
    // step (the ‹ › flip walks one page at a time). It lives entirely inside this
    // 鑑賞 overlay — it does NOT open a second layer over the 3D scene — so a jump
    // stays in the reading context. The thumbnails reuse each entry's `src`, which
    // is the very same page <img> URL the book renders, so there is no new art and
    // no extra decode beyond the small grid images.
    const tocLayer = el.querySelector(".gallery-toc");
    const tocToggle = el.querySelector(".gallery-toc-toggle");
    const tocGrid = el.querySelector(".gallery-toc-grid");
    const tocCells = [];
    entries.forEach((entry, i) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "gallery-thumb";
      cell.dataset.index = String(i);
      cell.setAttribute("role", "listitem");
      // label is already markup (may wrap a .jp span for the chrome entries).
      cell.innerHTML = `
        <span class="gallery-thumb-img"><img src="${entry.src}" alt="" loading="lazy" draggable="false" /></span>
        <span class="gallery-thumb-label">${entry.label}</span>
      `;
      tocGrid.appendChild(cell);
      tocCells.push(cell);
    });

    // Highlight the cell for the page actually in view. Reads the clamped, real
    // current index off the live book (getCurrentPageIndex is internally bounded),
    // NOT any raw/out-of-range parameter, so the highlight never falls off the end.
    const syncTocActive = () => {
      if (this.gallery !== g) return;
      const active = THREE.MathUtils.clamp(
        pageFlip.getCurrentPageIndex(),
        0,
        entries.length - 1,
      );
      tocCells.forEach((cell, i) => {
        const on = i === active;
        cell.classList.toggle("is-active", on);
        cell.setAttribute("aria-current", on ? "page" : "false");
      });
    };

    const setToc = (open) => {
      if (this.gallery !== g) return;
      g.tocOpen = open;
      tocToggle.setAttribute("aria-expanded", open ? "true" : "false");
      tocToggle.classList.toggle("is-active", open);
      if (open) {
        syncTocActive();
        tocLayer.hidden = false;
        // Reduced motion: no fade/scale transition — show it at once. Otherwise the
        // .is-on class drives the CSS fade-in. Mirror the same guard on close.
        if (this.reducedMotion) {
          tocLayer.classList.add("is-on");
        } else {
          // next frame so the [hidden]→shown swap commits before the transition.
          window.setTimeout(() => {
            if (this.gallery === g && g.tocOpen) tocLayer.classList.add("is-on");
          }, 16);
        }
        // bring the active cell into view (no smooth scroll under reduced motion).
        const activeCell = tocGrid.querySelector(".gallery-thumb.is-active");
        if (activeCell) {
          activeCell.scrollIntoView({
            block: "nearest",
            behavior: this.reducedMotion ? "auto" : "smooth",
          });
        }
      } else {
        tocLayer.classList.remove("is-on");
        if (this.reducedMotion) {
          tocLayer.hidden = true;
        } else {
          window.setTimeout(() => {
            if (this.gallery === g && !g.tocOpen) tocLayer.hidden = true;
          }, 260);
        }
      }
    };
    g.setToc = setToc;

    pageFlip.on("flip", syncChrome);
    pageFlip.on("flip", syncTocActive);
    pageFlip.on("changeOrientation", syncChrome);
    syncChrome();

    el.querySelector(".gallery-close").addEventListener("click", () => this.closeGallery());
    prevBtn.addEventListener("click", () => pageFlip.flipPrev());
    nextBtn.addEventListener("click", () => pageFlip.flipNext());
    tocToggle.addEventListener("click", () => setToc(!g.tocOpen));
    tocGrid.addEventListener("click", (event) => {
      const cell = event.target.closest(".gallery-thumb");
      if (!cell || this.gallery !== g) return;
      const i = Number(cell.dataset.index);
      if (!Number.isInteger(i)) return;
      // Jump to the chosen page IN-PLACE. turnToPage snaps (no flip animation) and,
      // crucially, does NOT fire the "flip" event, so the page label / ‹ › arrows
      // would stop on the stale value unless we resync the chrome by hand here.
      pageFlip.turnToPage(i);
      syncChrome();
      syncTocActive();
      setToc(false);
    });

    // setTimeout (not rAF) so the fade-in still runs if the tab is backgrounded.
    window.setTimeout(() => {
      if (this.gallery === g) el.classList.add("is-on");
    }, 20);
    this.container.classList.add("in-gallery");
    this.syncNarrativeBeat(true);
  }

  // Arrow keys / ‹ › buttons drive the book's own flip animation.
  galleryFlip(delta) {
    const g = this.gallery;
    if (!g) return;
    if (delta > 0) g.pageFlip.flipNext();
    else g.pageFlip.flipPrev();
  }

  closeGallery() {
    const g = this.gallery;
    if (!g) return;
    // D2: write the 鑑賞 reading position back to the 3D magazine before tearing
    // the overlay down, so exiting on P.12 lands the magazine on P.12's spread
    // instead of bouncing back to where the reader entered. Read the page index
    // off the live book first (destroy() invalidates it).
    let landingEntry = null;
    try {
      const i = THREE.MathUtils.clamp(
        g.pageFlip.getCurrentPageIndex(),
        0,
        g.entries.length - 1,
      );
      landingEntry = g.entries[i] ?? null;
    } catch {
      /* book already gone — fall through without a write-back */
    }

    this.gallery = null;
    g.el.classList.remove("is-on");
    try {
      g.pageFlip.destroy();
    } catch {
      /* already torn down */
    }
    this.container.classList.remove("in-gallery");
    this.syncNarrativeBeat(true);
    window.setTimeout(() => g.el.remove(), 380);

    if (landingEntry) this.applyGalleryLanding(landingEntry);
  }

  // Land the 3D magazine on the spread/state a 鑑賞 entry corresponds to. The
  // three chrome entries (cover / colophon / back) carry NO `page` field, so a
  // blind pageToSpread(entry.page) would map undefined → null → spread 0 ("read
  // the back cover, exit, jump to the front cover"). Each is branched explicitly
  // up front. Any already-risen standee on the old spread is folded immediately
  // first, so after exit the current spread never has a stray figure hanging off
  // a foreign spread.
  applyGalleryLanding(entry) {
    if (!entry) return;
    this.foldStandees(true);

    if (entry.key === "cover") {
      // front cover → settled-closed (NOT an open spread 0)
      this.enterClosedCover();
      this.recordSpread();
      // J1: these two chrome branches take a dedicated path (enterClosedCover/
      // enterClosedBack) instead of the shared landOnSpread kernel, which is the
      // only landing path that does NOT fan out to syncHud automatically. Call it
      // here so the page label settles immediately, matching every other arrival
      // (restore / deep-link / interior-page exit) instead of waiting on the
      // per-frame animate() catch-up.
      this.syncHud();
      this.syncMasthead(true);
      return;
    }
    if (entry.key === "back") {
      // back cover → "closed back" — must go through the dedicated path
      // (resets the displaced right stack + hides the right page); the open-state
      // helpers (restoreStacks/applySpread) would leave a stray right-stack offset.
      this.enterClosedBack();
      this.recordSpread();
      this.syncHud(); // J1: same as cover — settle the page label on this path.
      this.syncMasthead(true);
      return;
    }
    if (entry.key === "colophon") {
      // colophon (inside back cover) → the final spread, open
      this.landOnSpread(this.leafCount(), { persist: true });
      return;
    }
    // a regular interior page (has .page) → its spread, open. The reverse lookup
    // is the single source of truth; both pages of a spread resolve to the same
    // spread, and applySpread sets both leaves at once.
    const located = this.pageToSpread(entry.page);
    if (located) {
      this.landOnSpread(located.spread, { persist: true });
    }
  }

  handleResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (!width || !height) return;
    this.appliedWidth = width;
    this.appliedHeight = height;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.viewportAspect = this.camera.aspect;
    // Widen the field of view on portrait so the magazine fits without having
    // to dolly so far back that it reads as a tiny object on a vast floor.
    this.camera.fov = this.baseFov + this.portraitAmount() * this.portraitFovGain;
    this.camera.updateProjectionMatrix();
    if (this.gallery) this.gallery.pageFlip.update();
  }

  // --- Frame loop -----------------------------------------------------------------

  animate() {
    const now = performance.now();
    if (!this.lastFrameTime) this.lastFrameTime = now;
    const delta = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;

    // While the reading overlay is up the 3D scene is fully covered; don't render
    // it (keep the loop alive so it resumes the instant the overlay closes).
    if (this.gallery) {
      this.frameId = window.requestAnimationFrame(this.animate);
      return;
    }
    this.drainTextureWarmupQueue(1);

    this.elapsedTime += delta;
    const elapsed = this.elapsedTime;

    // Self-heal: if the canvas buffer ever drifts from the real layout size
    // (missed resize events, embedded panes, zoom changes), correct it within
    // a second so the projection aspect can never stay wrong.
    this.sizeCheckAccum = (this.sizeCheckAccum ?? 0) + delta;
    if (!this.appliedWidth || !this.appliedHeight) {
      this.handleResize();
    } else if (this.sizeCheckAccum > 1) {
      this.sizeCheckAccum = 0;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      if (width && height && (width !== this.appliedWidth || height !== this.appliedHeight)) {
        this.handleResize();
      }
    }

    this.updateAnimation(now);
    this.updateTurn(now, delta);
    this.updatePeel(delta);
    this.updateStandees(delta, elapsed);
    this.updateLipSync(); // S18: amplitude-driven mouth toggle (degrades to no-op)
    this.updateTour();
    this.syncTourButton();
    this.syncMasthead();
    this.syncNarrativeBeat();
    this.updateShow(delta);
    this.updateCamera(delta, now);
    this.updateMicroMotion(elapsed);
    this.updateDust(elapsed);
    if (!this.reducedMotion && this.grainPass) {
      this.grainPass.uniforms.uTime.value = elapsed;
    }

    // Only re-render the shadow map while a caster is actually moving.
    this.renderer.shadowMap.needsUpdate = this.shadowsNeedUpdate();
    // Trim resolution / DoF if the GPU is sustainedly behind; recover when calm.
    this.trackFrameQuality(now, delta);

    this.composer.render();

    this.frameId = window.requestAnimationFrame(this.animate);
  }

  anyStandeeUnfolded() {
    for (const standee of this.standees.values()) {
      if (standee.state !== "folded") return true;
    }
    return false;
  }

  // True while anything that casts a shadow is moving, plus a short settle tail
  // so the final resting pose is captured. The magazine's idle micro-drift is
  // sub-pixel in shadow terms, so a frozen map there is imperceptible.
  shadowsNeedUpdate() {
    if (this.shadowSettle === undefined) this.shadowSettle = 4;
    // BUG-PEEL-SHADOW: peel.amount is geometry-in-motion (drag-to-preview the
    // page lift) and previously was not in casterMoving — so the shadow map
    // froze on the first peel frame. Add it so peel updates the shadow too.
    const casterMoving =
      !!this.activeAnimation || !!this.turn || !!this.show ||
      this.anyStandeeUnfolded() || (this.peel?.amount ?? 0) > 0.001;
    if (casterMoving) this.shadowSettle = 3;
    if (this.shadowSettle > 0) {
      this.shadowSettle -= 1;
      return true;
    }
    return false;
  }

  // One-way-biased adaptive quality: drop fast when frames stay slow (shed DoF
  // first, then resolution toward the floor), recover slowly after a long calm
  // window. Frame interval is vsync-bounded, so we only treat sustained overruns
  // as "slow" and probe recovery rarely (backoff) to avoid resolution pumping.
  //
  // BUG-QUALITY-STUCK fix (Sprint 6 / Iter 1):
  //   (a) The down-shift branch grew backoff exponentially to a cap of 16;
  //       the up-shift branch never reset it. Once we hit the floor, backoff
  //       stayed at 16 forever — cooldown 80s/step and even after a step the
  //       next probe was still 80s away. Real users who briefly tab-switched
  //       could permanently lock to floor. Now the up-shift branch halves
  //       backoff (mirror of the down-shift) so successful probes cheapen
  //       future probes; failed probes still cost more.
  //   (b) visibilitychange (registered in bindEvents) resets backoff/ema/since
  //       on tab-restore so the next frame's raw-delta spike doesn't poison
  //       the ema. This also keeps headless rAF pauses from accumulating fake
  //       "SMOOTH" intervals between throttled frames.
  trackFrameQuality(now, delta) {
    const q = this.quality ?? (this.quality = { ema: 16.7, since: 0, backoff: 1 });
    const raw = now - (this.lastRawFrame ?? now);
    this.lastRawFrame = now;
    if (raw > 0 && raw < 250) q.ema += (raw - q.ema) * 0.08; // ignore tab-switch spikes
    q.since += delta;
    if (q.since < 1) return; // cooldown between changes

    const SLOW = 22; // ~45fps and below -> trim
    const SMOOTH = 17; // comfortably at ~60fps -> eligible to recover
    // Resolution is the only lever here: DoF is off by default (not a perf
    // fallback). Floor is native, so under load we trade supersampling crispness
    // for smoothness but never drop below the screen.
    if (q.ema > SLOW) {
      if (this.pixelRatio > this.qualityFloor + 0.01) {
        this.applyQuality(Math.max(this.qualityFloor, this.pixelRatio - 0.25));
        q.since = 0;
        q.ema = SMOOTH;
        q.backoff = Math.min(q.backoff * 2, 16);
      }
    } else if (q.ema < SMOOTH && q.since > 5 * q.backoff) {
      if (this.pixelRatio < this.qualityCeil - 0.01) {
        this.applyQuality(Math.min(this.qualityCeil, this.pixelRatio + 0.25));
        q.since = 0;
        // Mirror of the down-shift: successful recovery halves backoff so we
        // probe more eagerly next time, instead of staying at the cap forever.
        q.backoff = Math.max(1, q.backoff / 2);
      }
    }
  }

  // BUG-QUALITY-STUCK (b): tab-restore handler. After a tab is hidden, rAF is
  // paused and the next visible frame may have a huge raw delta — the existing
  // raw<250 filter swallows that one frame but a few subsequent frames before
  // ema recovers can poison things. Reset the quality state so we start fresh.
  handleVisibilityChange() {
    if (typeof document === "undefined" || document.hidden) return;
    if (!this.quality) return;
    this.quality.backoff = 1;
    this.quality.ema = 17; // SMOOTH baseline (matches trackFrameQuality const)
    this.quality.since = 0;
    this.lastRawFrame = performance.now();
  }

  applyQuality(pixelRatio) {
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setPixelRatio(pixelRatio);
    this.handleResize();
  }

  dispose() {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.removeEventListener("resize", this.handleResize);
    this.resizeObserver?.disconnect();
    this.inputTarget?.removeEventListener("pointerdown", this.handlePointerDown);
    this.inputTarget?.removeEventListener("pointermove", this.handlePointerMove);
    this.inputTarget?.removeEventListener("pointerup", this.handlePointerUp);
    this.inputTarget?.removeEventListener("pointercancel", this.handlePointerUp);
    this.inputTarget?.removeEventListener("pointerleave", this.handlePointerLeave);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
    if (this.gallery) {
      this.gallery.el.remove();
      this.gallery = null;
    }
    if (this.lookCard) {
      this.lookCard.el.remove();
      this.lookCard = null;
    }
    this.textureWarmupQueue.length = 0;
    this.textureWarmupSet.clear();
    for (const timer of this.discoveryTimers.values()) window.clearTimeout(timer);
    this.discoveryTimers.clear();
    window.clearTimeout(this.cardShareFlashTimer);
    // BUG-DISPOSE-SHARE-TIMER (Sprint 6 / Iter 2): symmetric counterpart to the
    // line above — cardShareFlashTimer was cleared, shareFlashTimer was not.
    // Same 1600ms HUD-share flash pattern; without clearing, a dispose during
    // the flash window leaves a stale setTimeout in flight (guarded inside,
    // so non-fatal, but a real micro-leak).
    window.clearTimeout(this.shareFlashTimer);
    // S18: stop any active voice + clear the caption fade timer, then disconnect
    // the persistent voice nodes (no dangling source, timer, or AudioContext
    // leak — BUG-DISPOSE-SHARE-TIMER same pattern).
    this.stopVoice();
    this.clearCaptionFade();
    try {
      this.voiceGain?.disconnect();
      this.voiceAnalyser?.disconnect();
    } catch {
      /* nodes already torn down */
    }
    this.voiceGain = null;
    this.voiceAnalyser = null;
    this.roomToneGain = null;
    this.voiceUrlCache.clear();
    this.container.classList.remove("has-pointer", "is-pressing", "in-gallery");
    delete this.container.dataset.cursor;

    this.audio.ctx?.close().catch(() => {});
    for (const standee of this.standees.values()) {
      standee.video?.pause();
    }

    this.disposables.forEach((item) => {
      if (item && typeof item.dispose === "function") item.dispose();
    });

    this.composer?.dispose();
    this.renderer?.dispose();
    if (window.__magazineScene === this) {
      delete window.__magazineScene;
    }
    this.loader?.remove();
    this.hud?.remove();
    this.cursorDot?.remove();
    if (this.renderer?.domElement?.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
