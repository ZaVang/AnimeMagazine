import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const coverFrontUrl = new URL("../assets/image/cover.png", import.meta.url).href;
const backCoverUrl = new URL("../assets/image/back-cover.png", import.meta.url).href;

// Interior pages come from asset packs: every numeric folder under
// assets/image-packs is one page, in numeric order. A pack contributes the
// page print plus optional standee, expression-sheet, and runway-video extras.
const packFileUrls = import.meta.glob(
  "../assets/image-packs/*/images/{main-visual,background-only,character-transparent,expression-sheet,expression-sheet-transparent,action-sheet-transparent}.png",
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
  for (const [path, url] of Object.entries(packFileUrls)) {
    const match = path.match(/image-packs\/(\d+)\/images\/([\w-]+)\.png$/);
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
    if (pack) pack.commentary = data;
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
// commentary expression hints map onto the first sheet cells
const EXPRESSION_HINTS = { neutral: 0, smile: 1 };

const textJa = (field) => (field && (field.ja ?? field.zh)) || "";
const textZh = (field) => (field && (field.zh ?? field.ja)) || "";

const TEXTURES = {
  wood: {
    color: "/pbr/wood_0066/wood_0066_color_2k.jpg",
    roughness: "/pbr/wood_0066/wood_0066_roughness_2k.jpg",
    normal: "/pbr/wood_0066/wood_0066_normal_opengl_2k.png",
    ao: "/pbr/wood_0066/wood_0066_ao_2k.jpg",
  },
  paper: {
    color: "/pbr/paper_0026/paper_0026_color_2k.jpg",
    roughness: "/pbr/paper_0026/paper_0026_roughness_2k.jpg",
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
    uAmount: { value: 0.042 },
    uVignette: { value: 0.48 },
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
    this.loadedTextures = [];
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
    this.disposables = [];
    this.reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.audio = { ctx: null, buffers: new Map(), started: false };

    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
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
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070604);
    this.scene.fog = new THREE.Fog(0x070604, 5.2, 12);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envTarget.texture;
    this.scene.environmentIntensity = 0.18;
    this.disposables.push(envTarget.texture, envTarget);
    pmrem.dispose();
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.cameraStart = new THREE.Vector3(0.18, 3.35, 5.6);
    this.cameraClosed = new THREE.Vector3(-0.12, 2.32, 3.08);
    this.cameraClosedBack = new THREE.Vector3(MAGAZINE_X - 0.24, 2.32, 3.08);
    // Original distance: pushing closer exaggerates depth perspective and
    // makes the tall page ratio read even longer than it is.
    this.cameraOpen = new THREE.Vector3(MAGAZINE_X, 2.96, 3.72);
    this.targetStart = new THREE.Vector3(-0.16, 0.02, -0.02);
    this.targetClosed = new THREE.Vector3(MAGAZINE_X + 0.55, 0.06, -0.04);
    this.targetClosedBack = new THREE.Vector3(MAGAZINE_X - 0.55, 0.06, -0.04);
    this.targetOpen = new THREE.Vector3(MAGAZINE_X, 0.07, -0.03);
    this.camera.position.copy(this.cameraStart);
    this.camera.lookAt(this.targetStart);
  }

  createPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 4.1,
      aperture: 0.00012,
      maxblur: 0.0075,
    });
    this.composer.addPass(this.bokehPass);

    this.grainPass = new ShaderPass(GrainShader);
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
          this.renderer.initTexture(texture);
          this.pageMaterials[i] = this.createPrintedMaterial(texture, 0.74, 0.03);
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

  createPrintedMaterial(printMap, roughness, normalStrength) {
    const material = new THREE.MeshStandardMaterial({
      map: printMap,
      roughness,
      metalness: 0,
      normalMap: this.paperNormal,
      normalScale: new THREE.Vector2(normalStrength, normalStrength),
      roughnessMap: this.paperRoughness,
      aoMap: this.paperAo,
      envMapIntensity: 0.32,
    });
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
      envMapIntensity: 0.2,
      side,
    });
    this.disposables.push(material);
    return material;
  }

  // --- Lights, table, dust -------------------------------------------------

  createLights() {
    this.hemiLight = new THREE.HemisphereLight(0xfff4e4, 0x171210, 0.5);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffe4c3, 2.0);
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

    this.poolLight = new THREE.SpotLight(0xffdfb4, 34, 11, 0.47, 0.75, 1.6);
    this.poolLight.position.set(-1.1, 4.6, 1.9);
    this.poolLight.target.position.set(MAGAZINE_X, 0, -0.05);
    this.scene.add(this.poolLight, this.poolLight.target);

    this.fillLight = new THREE.DirectionalLight(0xd8e8ff, 0.32);
    this.fillLight.position.set(3.8, 3.2, -2.6);
    this.scene.add(this.fillLight);
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
      normalScale: new THREE.Vector2(0.18, 0.18),
      envMapIntensity: 0.26,
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
      color: 0x171311,
      roughness: 0.62,
      metalness: 0,
      envMapIntensity: 0.28,
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
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x110f0e,
      roughness: 0.54,
      metalness: 0,
      envMapIntensity: 0.32,
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

    this.turningPage.add(this.turnFront, this.turnBack);
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
            this.loadTexture(source.figure, { color: true }),
            this.loadTexture(source.background, { color: true }),
            source.expressions
              ? this.loadTexture(source.expressions, { color: true })
              : Promise.resolve(null),
            source.actions
              ? this.loadTexture(source.actions, { color: true })
              : Promise.resolve(null),
          ]);
        if (this.disposed) return;
        this.buildStandee(source, figureTexture, backgroundTexture, expressionTexture, actionTexture);
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

    // the settled spread and side where this page is displayed
    let spread = -1;
    let side = null;
    for (let s = 0; s <= this.leafCount(); s += 1) {
      if (this.spreadLeftPage(s) === pageIndex) {
        spread = s;
        side = "left";
        break;
      }
      if (this.spreadRightPage(s) === pageIndex) {
        spread = s;
        side = "right";
        break;
      }
    }
    if (spread < 0) return;

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
      envMapIntensity: 0.32,
    });
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
      envMapIntensity: 0.2,
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

    const name = textJa(item.name);
    let size = 40;
    ctx.font = `${size}px 'Shippori Mincho', serif`;
    while (size > 22 && ctx.measureText(name).width > w - 110) {
      size -= 2;
      ctx.font = `${size}px 'Shippori Mincho', serif`;
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(30, 24, 18, 0.85)";
    ctx.fillText(name, 64, h * 0.46);

    const tags = (item.tags && (item.tags.ja ?? item.tags.zh)) || [];
    ctx.font = "22px 'Shippori Mincho', serif";
    ctx.fillStyle = "rgba(30, 24, 18, 0.5)";
    ctx.fillText(tags.join("・"), 64, h * 0.78);
    standee.cui.tagTexture.needsUpdate = true;
  }

  showCommentaryItem(standee, index, sticky = false) {
    const cui = standee.cui;
    const item = standee.commentary?.items?.[index];
    if (!cui || !item) return;
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
    this.setCaption(textJa(item.text), textZh(item.text));
    this.playSound("pageTurn", { gain: 0.12, rate: 1.7 });
  }

  hideCommentary(standee) {
    const cui = standee.cui;
    if (!cui) return;
    cui.activeIndex = -1;
    cui.tagGroup.visible = false;
    cui.thread.visible = false;
    if (!this.tour) this.hideCaption();
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
    this.cancelStandeeAction(standee);
    this.tour = { standee, stage: -1, stageUntil: performance.now() + 3400 };
    if (standee.cui) {
      standee.cui.activeIndex = -1;
      standee.cui.tagGroup.visible = false;
      standee.cui.thread.visible = false;
    }
    const intro = standee.commentary.intro;
    this.setExpressionHint(standee, intro?.expression);
    this.setCaption(textJa(intro), textZh(intro));
    this.playSound("pageTurn", { gain: 0.2, rate: 1.4 });
  }

  endTour() {
    const tour = this.tour;
    if (!tour) return;
    this.tour = null;
    this.hideCommentary(tour.standee);
    this.hideCaption();
    tour.standee.idleAt = performance.now() + 4500 + Math.random() * 2500;
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
      envMapIntensity: 0.25,
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

  showRunwayHint() {
    if (!this.hudHint) return;
    this.hudHint.textContent = "彼女をクリックするとランウェイ";
    this.hudHint.classList.remove("is-faded");
  }

  // --- Runway show (the lights drop, the video performs) -----------------------

  startShow(standee) {
    if (this.show || !standee.videoUrl || standee.state !== "risen") return;
    if (this.tour) this.endTour();
    this.clearPeel();
    this.cancelStandeeAction(standee);
    this.hideCommentary(standee);
    this.fadeHint();
    const runwayIntro = standee.commentary?.runwayIntro;
    if (runwayIntro) {
      this.setCaption(textJa(runwayIntro), textZh(runwayIntro));
      window.setTimeout(() => {
        if (!this.disposed && !this.tour) this.hideCaption();
      }, 4200);
    }
    this.lightLevels ??= {
      hemi: this.hemiLight.intensity,
      key: this.keyLight.intensity,
      pool: this.poolLight.intensity,
      fill: this.fillLight.intensity,
      env: this.scene.environmentIntensity,
    };
    this.show = { standee, phase: "dimming", dim: 0, fade: 0 };
    this.container.classList.add("in-show");
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
  }

  applyShowDim(dim) {
    if (!this.lightLevels) return;
    const eased = easeInOutCubic(dim);
    const L = this.lightLevels;
    this.hemiLight.intensity = L.hemi * (1 - 0.96 * eased);
    this.keyLight.intensity = L.key * (1 - 0.95 * eased);
    this.poolLight.intensity = L.pool * (1 - 0.78 * eased);
    this.fillLight.intensity = L.fill * (1 - eased);
    this.scene.environmentIntensity = L.env * (1 - 0.97 * eased);
    if (this.grainPass) this.grainPass.uniforms.uVignette.value = 0.48 + 0.3 * eased;
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
        for (let i = 0; i < cui.hotspots.length; i += 1) {
          const dot = cui.hotspots[i];
          dot.visible = showDots;
          if (!showDots) continue;
          const pulse = this.reducedMotion ? 1 : 1 + Math.sin(elapsed * 2.6 + i * 1.3) * 0.12;
          dot.scale.setScalar(cui.activeIndex === i ? 1.6 : pulse);
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

        // auto blink with the closed-eyes cut
        const blinkCell = card.blinkCell ?? BLINK_CELL;
        if (wantCard && card.cell !== blinkCell) {
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
    const desiredTarget = this.desiredTargetWork.copy(
      this.state === "closed"
        ? this.targetClosed
        : this.state === "closedBack"
          ? this.targetClosedBack
          : this.targetOpen,
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

  applyResponsiveCamera(base, target) {
    target.copy(base);
    if (this.viewportAspect < 0.72) {
      const amount = THREE.MathUtils.clamp((0.72 - this.viewportAspect) / 0.32, 0, 1);
      target.y += amount * 0.48;
      target.z += amount * 1.12;
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
      </div>
      <div class="hud-feature hud-item">特集・白と海軍紺の構造美</div>
      <div class="hud-status hud-item">
        <div class="hud-page"><span class="jp">表紙</span></div>
        <div class="hud-rule"></div>
        <div class="hud-hint">クリックして表紙をひらく</div>
        <button class="hud-read" type="button" aria-label="誌面を拡大して読む">鑑賞モード</button>
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
  }

  setCaption(ja, zh) {
    if (!this.hudCaption) return;
    this.hudCaption.querySelector(".cap-ja").textContent = ja;
    this.hudCaption.querySelector(".cap-zh").textContent = zh;
    this.hudCaption.classList.add("is-on");
  }

  hideCaption() {
    this.hudCaption?.classList.remove("is-on");
  }

  fadeHint() {
    this.hudHint?.classList.add("is-faded");
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
        envMapIntensity: 0.2,
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
    if (this.audio.started) return;
    this.audio.started = true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.audio.ctx = new Ctx();

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
      gain.gain.value = 0.05;
      source.connect(gain).connect(this.audio.ctx.destination);
      source.start();
    });
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
  }

  // --- Keyboard -------------------------------------------------------------

  handleKeyDown(event) {
    if (!this.assetsReady) return;

    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) this.toggleGallery();
      return;
    }
    if (event.code === "Escape") {
      if (this.gallery) this.closeGallery();
      return;
    }
    if (this.gallery) return;

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
      if (this.tour) {
        this.endTour();
      } else if (this.state === "open" && !this.show) {
        for (const standee of this.standees.values()) {
          if (
            standee.state === "risen" &&
            standee.spread === this.spreadIndex &&
            standee.commentary
          ) {
            this.startTour(standee);
            break;
          }
        }
      }
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

  galleryPageInfo() {
    if (this.state === "closed") {
      return { src: coverFrontUrl, label: `<span class="jp">表紙</span>` };
    }
    if (this.state === "closedBack") {
      return { src: backCoverUrl, label: `<span class="jp">裏表紙</span>` };
    }
    const side =
      this.galleryShowSide === "left" || this.galleryShowSide === "right"
        ? this.galleryShowSide
        : this.pointerSide === "left"
          ? "left"
          : "right";
    const pageIndex =
      side === "left"
        ? this.spreadLeftPage(this.spreadIndex)
        : this.spreadRightPage(this.spreadIndex);
    if (pageIndex === null) {
      if (!this.colophonCanvas) return null;
      return { src: this.colophonCanvas.toDataURL("image/png"), label: `<span class="jp">奥付</span>` };
    }
    if (!this.pageMaterials[pageIndex]) return null;
    const num = String(pageIndex + 2).padStart(2, "0");
    return { src: imagePageUrls[pageIndex], label: `P.${num}` };
  }

  toggleGallery() {
    if (this.gallery) {
      this.closeGallery();
      return;
    }
    if (this.show) return;
    if (this.state !== "open" && this.state !== "closed" && this.state !== "closedBack") return;
    // Which page the overlay shows. On desktop this follows the hovered side;
    // on touch (no hover) it defaults to the right page, and the ‹ › controls
    // let the reader swap to the other page of the spread.
    this.galleryShowSide =
      this.state === "open" ? (this.pointerSide === "left" ? "left" : "right") : null;
    const info = this.galleryPageInfo();
    if (!info) return;
    if (this.tour) this.endTour();
    this.clearPeel();
    this.keys.clear();

    const canSwap = this.state === "open";
    const el = document.createElement("div");
    el.className = "gallery";
    el.innerHTML = `
      <img class="gallery-img" alt="誌面" draggable="false" />
      <div class="gallery-label">${info.label}</div>
      <button class="gallery-close" type="button" aria-label="戻る">✕</button>
      <button class="gallery-nav prev" type="button" aria-label="前のページ"${canSwap ? "" : " hidden"}>‹</button>
      <button class="gallery-nav next" type="button" aria-label="次のページ"${canSwap ? "" : " hidden"}>›</button>
      <div class="gallery-hint">ドラッグ・移動　ピンチ / ホイール・拡大　✕ / SPACE・戻る</div>
    `;
    this.container.appendChild(el);
    const img = el.querySelector(".gallery-img");

    const g = {
      el,
      img,
      scale: 1,
      fit: 1,
      x: 0,
      y: 0,
      natW: 0,
      natH: 0,
      drag: null,
    };
    this.gallery = g;

    g.pointers = new Map();
    g.pinch = null;
    const twoPoints = () => [...g.pointers.values()];
    const pinchDist = () => {
      const [a, b] = twoPoints();
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const pinchMid = () => {
      const [a, b] = twoPoints();
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    g.onPointerDown = (event) => {
      g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* best-effort */
      }
      if (g.pointers.size >= 2) {
        // second finger down: start a pinch and stop any single-finger pan
        g.drag = null;
        el.classList.remove("is-dragging");
        g.pinch = { dist: pinchDist(), scale: g.scale, mid: pinchMid(), x: g.x, y: g.y };
      } else {
        g.drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, baseX: g.x, baseY: g.y };
        el.classList.add("is-dragging");
      }
    };
    g.onPointerMove = (event) => {
      if (!g.pointers.has(event.pointerId)) return;
      g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (g.pinch && g.pointers.size >= 2) {
        const dist = pinchDist();
        if (g.pinch.dist > 0) {
          const next = THREE.MathUtils.clamp(
            g.pinch.scale * (dist / g.pinch.dist),
            g.fit * 0.6,
            g.fit * 6,
          );
          const ratio = next / g.pinch.scale;
          const m = g.pinch.mid;
          g.x = m.x - (m.x - g.pinch.x) * ratio;
          g.y = m.y - (m.y - g.pinch.y) * ratio;
          g.scale = next;
          this.applyGalleryTransform();
        }
        return;
      }
      if (g.drag && event.pointerId === g.drag.id) {
        g.x = g.drag.baseX + (event.clientX - g.drag.startX);
        g.y = g.drag.baseY + (event.clientY - g.drag.startY);
        this.applyGalleryTransform();
      }
    };
    g.onPointerUp = (event) => {
      g.pointers.delete(event.pointerId);
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      if (g.pointers.size < 2) g.pinch = null;
      if (g.pointers.size === 1) {
        // one finger remains: hand panning back to it from its current spot
        const [id, p] = [...g.pointers.entries()][0];
        g.drag = { id, startX: p.x, startY: p.y, baseX: g.x, baseY: g.y };
        el.classList.add("is-dragging");
      } else if (g.pointers.size === 0) {
        g.drag = null;
        el.classList.remove("is-dragging");
      }
    };
    g.onWheel = (event) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const factor = Math.exp(-event.deltaY * 0.0012);
      const next = THREE.MathUtils.clamp(g.scale * factor, g.fit * 0.6, g.fit * 4.5);
      const ratio = next / g.scale;
      g.x = px - (px - g.x) * ratio;
      g.y = py - (py - g.y) * ratio;
      g.scale = next;
      this.applyGalleryTransform();
    };
    g.onDblClick = () => this.fitGallery();

    el.addEventListener("pointerdown", g.onPointerDown);
    el.addEventListener("pointermove", g.onPointerMove);
    el.addEventListener("pointerup", g.onPointerUp);
    el.addEventListener("pointercancel", g.onPointerUp);
    el.addEventListener("wheel", g.onWheel, { passive: false });
    el.addEventListener("dblclick", g.onDblClick);

    // Overlay controls. stopPropagation on pointerdown keeps a button tap from
    // starting a pan on the gallery surface underneath it.
    const swallow = (event) => event.stopPropagation();
    const closeBtn = el.querySelector(".gallery-close");
    closeBtn.addEventListener("pointerdown", swallow);
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      this.closeGallery();
    });
    if (canSwap) {
      const swapTo = (side) => (event) => {
        event.stopPropagation();
        if (this.galleryShowSide === side) return;
        this.galleryShowSide = side;
        this.reloadGalleryImage();
      };
      for (const [sel, side] of [[".gallery-nav.prev", "left"], [".gallery-nav.next", "right"]]) {
        const btn = el.querySelector(sel);
        btn.addEventListener("pointerdown", swallow);
        btn.addEventListener("click", swapTo(side));
      }
    }

    img.onload = () => {
      if (this.gallery !== g) return;
      g.natW = img.naturalWidth;
      g.natH = img.naturalHeight;
      this.fitGallery();
      el.classList.add("is-on");
    };
    img.src = info.src;
    this.container.classList.add("in-gallery");
  }

  fitGallery() {
    const g = this.gallery;
    if (!g || !g.natW || !g.natH) return;
    const vw = this.container.clientWidth || this.appliedWidth || window.innerWidth;
    const vh = this.container.clientHeight || this.appliedHeight || window.innerHeight;
    g.fit = Math.min((vw * 0.86) / g.natW, (vh * 0.86) / g.natH);
    g.scale = g.fit;
    g.x = (vw - g.natW * g.scale) / 2;
    g.y = (vh - g.natH * g.scale) / 2;
    this.applyGalleryTransform();
  }

  applyGalleryTransform() {
    const g = this.gallery;
    if (!g) return;
    const vw = this.container.clientWidth || this.appliedWidth || window.innerWidth;
    const vh = this.container.clientHeight || this.appliedHeight || window.innerHeight;
    const width = g.natW * g.scale;
    const height = g.natH * g.scale;
    g.x = THREE.MathUtils.clamp(g.x, vw * 0.15 - width, vw * 0.85);
    g.y = THREE.MathUtils.clamp(g.y, vh * 0.15 - height, vh * 0.85);
    g.img.style.transform = `translate3d(${g.x}px, ${g.y}px, 0) scale(${g.scale})`;
  }

  closeGallery() {
    const g = this.gallery;
    if (!g) return;
    this.gallery = null;
    g.el.classList.remove("is-on");
    g.el.removeEventListener("pointerdown", g.onPointerDown);
    g.el.removeEventListener("pointermove", g.onPointerMove);
    g.el.removeEventListener("pointerup", g.onPointerUp);
    g.el.removeEventListener("pointercancel", g.onPointerUp);
    g.el.removeEventListener("wheel", g.onWheel);
    g.el.removeEventListener("dblclick", g.onDblClick);
    this.container.classList.remove("in-gallery");
    window.setTimeout(() => g.el.remove(), 380);
  }

  // Swap the gallery to the other page of the spread (‹ › controls) without
  // tearing down the overlay; the existing img.onload re-fits the new page.
  reloadGalleryImage() {
    const g = this.gallery;
    if (!g) return;
    const info = this.galleryPageInfo();
    if (!info) return;
    const label = g.el.querySelector(".gallery-label");
    if (label) label.innerHTML = info.label;
    g.img.src = info.src;
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
    this.camera.updateProjectionMatrix();
    if (this.gallery) this.fitGallery();
  }

  // --- Frame loop -----------------------------------------------------------------

  animate() {
    const now = performance.now();
    if (!this.lastFrameTime) this.lastFrameTime = now;
    const delta = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
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
    this.updateTour();
    this.updateShow(delta);
    this.updateCamera(delta, now);
    this.updateMicroMotion(elapsed);
    this.updateDust(elapsed);
    if (!this.reducedMotion && this.grainPass) {
      this.grainPass.uniforms.uTime.value = elapsed;
    }
    this.composer.render();

    this.frameId = window.requestAnimationFrame(this.animate);
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
    if (this.gallery) {
      this.gallery.el.remove();
      this.gallery = null;
    }
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
