// Scene HOME (visual-spec §4): desk, stacks as paper piles, working zone
// (Today tray surface), environment layer. Theme presets: minimal / oceanview.
// The scene subscribes to state; it never reads files itself (D-018).
// World scale is realistic: desk ~1.4 m wide, seated camera ~0.45 m above it.
import * as THREE from '../../vendor/three/three.module.js';
import { INBOX } from '../core/workspace.js';
import { EffectComposer } from '../../vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../../vendor/three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from '../../vendor/three/examples/jsm/postprocessing/OutputPass.js';

// --- Layout constants (metres) ------------------------------------------
const DESK = { w: 1.4, h: 0.08, d: 1.12, y: 0.72, z: 0.28 }; // top = 0.76
const CAMERA = { x: 0, y: 1.18, z: 0.95 };
const WINDOW = { w: 1.4, h: 0.96, cy: 1.32, z: -0.40 };
const STACK_RADIUS = 0.8;
const STACK_ANGLES = Math.PI / 6; // ±30°

// Tier 1: toon shading (3-step ramp) + ink outlines (inverted hull).
function makeToonGradient(values = [0.5, 0.78, 1.0]) {
  const data = new Uint8Array(values.length * 4);
  values.forEach((v, i) => {
    const c = Math.round(v * 255);
    data[i * 4] = c;
    data[i * 4 + 1] = c;
    data[i * 4 + 2] = c;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, values.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const TOON_RAMP = makeToonGradient();
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x241c14, side: THREE.BackSide });

function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_RAMP });
}

function labelTexture(text, { width = 512, height = 128, bg = 'rgba(255,255,255,0.94)', color = '#1f2933', font = '600 64px -apple-system, sans-serif' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2, width * 0.9);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a8845c';
  ctx.fillRect(0, 0, 512, 512);
  // Broad soft bands for tone variation.
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(${70 + Math.floor(Math.random() * 24)}, ${50 + Math.floor(Math.random() * 16)}, ${30 + Math.floor(Math.random() * 12)}, 0.04)`;
    ctx.fillRect(0, Math.random() * 512, 512, 24 + Math.random() * 60);
  }
  // Fine, barely visible grain.
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 512;
    ctx.strokeStyle = `rgba(90, 66, 42, ${0.012 + Math.random() * 0.028})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 24) {
      const dy = Math.sin((x + i * 37) / 90) * 3 + Math.sin((x + i * 91) / 31) * 1.4;
      if (x === 0) ctx.moveTo(x, y + dy);
      else ctx.lineTo(x, y + dy);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.6, 1.2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeSheet({ w = 0.24, h = 0.31, color = '#fdfdf8' } = {}) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

const A5 = { w: 0.148, d: 0.21, t: 0.0037 };

// Deterministic PRNG (mulberry32) seeded from a string — piles keep their
// chaotic look across refreshes instead of re-shuffling every update.
function seededRandom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Thin white outline icons (24x24 viewBox paths), transparent fill.
// Thin white outline icons, 24x24 stroke paths (rounded joins).
const ICONS = {
  doc: 'M7 3h7l4 4v14H7z M14 3v4h4 M9.5 12h5 M9.5 15.5h5',
  inbox: 'M4 13l2.2-7h11.6L20 13v6H4z M4 13h4.6a3.4 3.4 0 0 0 6.8 0H20',
  star: 'M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.7l1.1-6L3.4 9.5l6-.8z',
  pen: 'M4.5 19.5l.9-3.6L16.6 4.7a2 2 0 0 1 2.8 2.8L8.2 18.6z M13.8 7.5l2.8 2.8',
  book: 'M5 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5z M19 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
};

const BUBBLE = { H: 256, pad: 36, icon: 120, gap: 26, font: 52, radius: 30 };

function drawIcon(ctx, name, x, y, size) {
  const path = new Path2D(ICONS[name] ?? ICONS.doc);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.35;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);
  ctx.restore();
}

// Matte-glass rectangle: soft white fill, double hairline stroke, faint
// diagonal frost bands. Everything is drawn from explicit state each call
// (fixes the lost-label bug caused by stale canvas/ctx state).
function drawBubbleFrame(ctx, W, icon, label, textAlpha) {
  const H = BUBBLE.H;
  ctx.clearRect(0, 0, W, H);
  // Body: rounded rectangle, frosted.
  const r = BUBBLE.radius;
  ctx.beginPath();
  ctx.roundRect(8, 8, W - 16, H - 16, r);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(252,250,245,0.42)');
  g.addColorStop(1, 'rgba(244,240,230,0.30)');
  ctx.fillStyle = g;
  ctx.fill();
  // Frost: two faint diagonal bands (matte glass hint).
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(8, 8, W - 16, H - 16, r);
  ctx.clip();
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 26;
  for (const bx of [W * 0.3, W * 0.62]) {
    ctx.beginPath();
    ctx.moveTo(bx - 60, H + 20);
    ctx.lineTo(bx + 60, -20);
    ctx.stroke();
  }
  ctx.restore();
  // Double hairline: bright outer, soft inner.
  ctx.beginPath();
  ctx.roundRect(8, 8, W - 16, H - 16, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(13, 13, W - 26, H - 26, Math.max(r - 5, 6));
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Icon at a fixed offset from the LEFT edge (rides it while expanding).
  drawIcon(ctx, icon, BUBBLE.pad, H / 2 - BUBBLE.icon / 2, BUBBLE.icon);
  // Label fades in to the right of the icon. Explicit state every draw.
  if (label && textAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = Math.min(Math.max(textAlpha, 0), 1);
    ctx.font = `300 ${BUBBLE.font}px -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(40, 30, 18, 0.65)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, BUBBLE.pad + BUBBLE.icon + BUBBLE.gap, H / 2 + 2, W - (BUBBLE.pad + BUBBLE.icon + BUBBLE.gap) - BUBBLE.pad);
    ctx.restore();
  }
}

function makeBubble({ name, icon = 'doc' }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  const WORLD_H = 0.085;
  const label = name.length > 18 ? `${name.slice(0, 17)}…` : name;
  const W0 = BUBBLE.pad * 2 + BUBBLE.icon;
  ctx.font = `300 ${BUBBLE.font}px -apple-system, sans-serif`;
  const textW = ctx.measureText(label).width;
  const W1 = Math.ceil(W0 + BUBBLE.gap + textW + BUBBLE.pad);
  let shownW = W0;
  let anim = null;
  const apply = (w, alpha) => {
    shownW = w;
    const pw = Math.max(Math.round(w), 2);
    if (canvas.width !== pw) canvas.width = pw; // resets ctx state
    canvas.height = BUBBLE.H;
    drawBubbleFrame(ctx, pw, icon, alpha > 0.01 ? label : '', alpha);
    tex.needsUpdate = true;
    sprite.scale.set(WORLD_H * (pw / BUBBLE.H), WORLD_H, 1);
  };
  apply(W0, 0);
  sprite.userData = {
    name,
    expanded: false,
    setExpanded(on) {
      if (sprite.userData.expanded === on) return;
      sprite.userData.expanded = on;
      mat.opacity = on ? 0.97 : 0.84;
      anim = { from: shownW, to: on ? W1 : W0, fromA: on ? 0 : 1, toA: on ? 1 : 0, start: performance.now(), dur: 240 };
    },
    tick(now) {
      if (!anim) return;
      const t = Math.min((now - anim.start) / anim.dur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      apply(anim.from + (anim.to - anim.from) * e, anim.fromA + (anim.toA - anim.fromA) * e);
      if (t >= 1) anim = null;
    },
  };
  return sprite;
}


function sheetTopTexture(titles, overdue) {
  const W = 736;
  const H = 1040;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fdfcf6';
  ctx.fillRect(0, 0, W, H);
  // Faint ruled lines for a paper feel.
  ctx.strokeStyle = 'rgba(120, 100, 70, 0.08)';
  ctx.lineWidth = 3;
  for (let y = 300; y < H - 80; y += 110) {
    ctx.beginPath();
    ctx.moveTo(70, y);
    ctx.lineTo(W - 70, y);
    ctx.stroke();
  }
  // Recent note titles — small, thin, same family as the A6 notes.
  ctx.font = '400 72px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lines = titles.slice(0, 3);
  const startY = H / 2 - ((lines.length - 1) * 120) / 2;
  lines.forEach((t, i) => {
    const text = t.length > 22 ? `${t.slice(0, 21)}…` : t;
    const y = startY + i * 120;
    ctx.fillStyle = overdue && i === 0 ? '#b03a2a' : '#a4917a';
    ctx.beginPath();
    ctx.arc(96, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = overdue && i === 0 ? '#8f2f22' : '#332a1d';
    ctx.fillText(text, 132, y, W - 210);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeStackMesh({ name, count, titles = [], overdue = false, icon = 'doc' }) {
  const group = new THREE.Group();
  const sheets = Math.min(3 + count, 10); // 4..10 A5 sheets, height follows count
  const paperA = toon('#fbf7ec');
  const paperB = toon('#efe6d2');
  const rng = seededRandom(`${name}:${count}`);
  let topY = 0;
  for (let i = 0; i < sheets; i++) {
    const isTop = i === sheets - 1;
    const mats = [paperA, paperA, paperA, paperB, paperA, paperB];
    if (isTop) {
      mats[2] = new THREE.MeshStandardMaterial({
        map: sheetTopTexture(titles, overdue),
        roughness: 0.9,
        metalness: 0,
      });
    }
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(A5.w, A5.t, A5.d), mats);
    // Chaotic pile: per-sheet offset, tilt and drift grow slightly with height.
    const lift = i * A5.t;
    sheet.position.set(
      (rng() - 0.5) * (0.014 + i * 0.001),
      lift + A5.t / 2,
      (rng() - 0.5) * (0.014 + i * 0.001),
    );
    sheet.rotation.y = (rng() - 0.5) * 0.14;
    sheet.rotation.x = (rng() - 0.5) * 0.02;
    sheet.rotation.z = (rng() - 0.5) * 0.02;
    group.add(sheet);
    // Minimal corner curl: a small triangular wedge lifts one sheet corner so
    // no sheet reads as perfectly flat. Corner + lift are per-sheet random.
    if (!curlGeo) {
      curlGeo = new THREE.CylinderGeometry(0.016, 0.016, A5.t * 1.02, 12, 1, false, 0, Math.PI / 2);
    }
    const curl = new THREE.Mesh(curlGeo, paperA);
    const corner = Math.floor(rng() * 4);
    const sx = corner % 2 === 0 ? 1 : -1;
    const sz = corner < 2 ? 1 : -1;
    curl.scale.set(1, 1, 1);
    curl.rotation.set(0, 0, 0);
    curl.position.set(
      sheet.position.x + sx * (A5.w / 2 - 0.014),
      lift + A5.t + 0.0015,
      sheet.position.z + sz * (A5.d / 2 - 0.014),
    );
    curl.rotation.y = ((corner % 2 === 0 ? 0 : Math.PI) + (corner < 2 ? 0 : Math.PI / 2)) + (rng() - 0.5) * 0.5;
    group.add(curl);
    // Thin ink outline per sheet keeps the anime look without a hard box.
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(A5.w, A5.t, A5.d)),
      new THREE.LineBasicMaterial({ color: 0x2a2118, transparent: true, opacity: 0.26 }),
    );
    edge.position.copy(sheet.position);
    edge.rotation.copy(sheet.rotation);
    group.add(edge);
    topY = lift + A5.t + 0.003;
  }
  if (overdue) {
    const seal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.004, 20),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 }),
    );
    seal.position.set(0.05, topY + 0.003, 0.08);
    group.add(seal);
  }
  group.userData = { name, count, topY, icon };
  return group;
}

const A6 = { w: 0.105, h: 0.148 };
let curlGeo = null; // shared quarter-cylinder wedge for sheet corner curls

// Invisible snap grid (item 4): stacks/notes land on 7 cm cells so piles
// never overlap and the desk keeps a lived-in but tidy rhythm.
const GRID = 0.07;
const snapGrid = (v) => Math.round(v / GRID) * GRID;
function nearestFreeCell(x, z, taken) {
  const gx = snapGrid(x);
  const gz = snapGrid(z);
  const overs = (cx, cz) => taken.some((p) => Math.abs(p.x - cx) < GRID * 0.9 && Math.abs(p.z - cz) < GRID * 0.9);
  if (!overs(gx, gz)) return { x: gx, z: gz };
  for (let r = 1; r <= 4; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = snapGrid(gx + dx * GRID);
        const cz = snapGrid(gz + dz * GRID);
        if (cx < -0.55 || cx > 0.55 || cz < -0.15 || cz > 0.55) continue;
        if (!overs(cx, cz)) return { x: cx, z: cz };
      }
    }
  }
  return { x: gx, z: gz };
}

function a6NoteTexture(text, overdue) {
  const W = 512;
  const H = 724;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = overdue ? '#fdf1ee' : '#fefdf8';
  ctx.fillRect(0, 0, W, H);
  // Thin border — print feel.
  ctx.strokeStyle = 'rgba(70, 56, 38, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.fillStyle = overdue ? '#8f2f22' : '#4a3d2b';
  ctx.font = '300 42px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 120 && line) {
      lines.push(line);
      line = w;
      if (lines.length >= 4) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < 4) lines.push(line);
  lines.forEach((t, i) => ctx.fillText(t, 60, 64 + i * 62, W - 120));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeTaskSheet({ text, overdue, dir, fileName }, index, noteRegistry = null) {
  const group = new THREE.Group();
  // A6 note lying flat on the desk, portrait orientation (vertical A6).
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(A6.w, 0.0035, A6.h),
    new THREE.MeshStandardMaterial({ color: overdue ? '#f6e3de' : '#fdfbf4', roughness: 0.88 }),
  );
  group.add(sheet);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(A6.w, A6.h),
    new THREE.MeshBasicMaterial({ map: a6NoteTexture(text, overdue), toneMapped: false }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0025;
  group.add(face);
  const col = index % 4;
  const row = Math.floor(index / 4);
  group.position.set(-0.39 + col * 0.26 + (col % 2) * 0.05, 0.763, 0.12 + row * 0.22 + (col % 2) * 0.06);
  group.rotation.y = -0.12 + (Math.random() - 0.5) * 0.24;
  if (dir && fileName && noteRegistry) {
    group.userData.note = { dir, fileName, text };
    noteRegistry.push(group);
  }
  return group;
}

export function createScene({ canvas, state, onZoneClick, onStackMove, onNoteMove, onNoteIntoStack, config = {} }) {
  const theme = config.theme ?? 'minimal';

  const isMobile = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
    || /iPhone|iPad|Android/i.test(navigator.userAgent);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)); // DPR cap (§8)
  renderer.shadowMap.enabled = false;
  // Tier 0: filmic tone mapping — kills the flat "plastic" look.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme === 'oceanview' ? 1.09 : 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme === 'oceanview' ? 0xd9cbb2 : 0xf4f6f8);
  // Subtle atmospheric depth (barely visible indoors, helps the window view).
  scene.fog = new THREE.Fog(theme === 'oceanview' ? 0xd9cbb2 : 0xf4f6f8, 6, 18);

  const camera = new THREE.PerspectiveCamera(55, 2, 0.02, 40);
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
  camera.lookAt(0, CAMERA.y, 0);

  // Tier 2 post-processing: bloom on highlights + gentle film grain.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(1024, 1024),
    isMobile ? 0.10 : 0.16, // strength
    0.35, // radius
    1.0, // threshold — only the window highlights bloom
  );
  composer.addPass(bloomPass);
  const GrainShader = {
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, strength: { value: isMobile ? 0.02 : 0.03 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse;',
      'uniform float time;',
      'uniform float strength;',
      'varying vec2 vUv;',
      'float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }',
      'void main() {',
      '  vec4 c = texture2D(tDiffuse, vUv);',
      '  float n = rand(vUv * vec2(1920.0, 1080.0) + fract(time) * 97.0) - 0.5;',
      '  c.rgb += n * strength;',
      '  gl_FragColor = c;',
      '}',
    ].join('\n'),
  };
  const grainPass = new ShaderPass(GrainShader);
  composer.addPass(grainPass);
  composer.addPass(new OutputPass());

  // Lights: warm window light (references: sunlit anime desk).
  // Tier 0 lighting: warm key from the window + cool fill from the room.
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0x9a8568, theme === 'oceanview' ? 0.92 : 1.0);
  scene.add(hemi);
  // Faint room ambient so the dark walls read as walls, not void.
  const ambient = new THREE.AmbientLight(0xfff2dd, theme === 'oceanview' ? 0.42 : 0.0);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffd9a8, theme === 'oceanview' ? 2.0 : 1.0);
  sun.position.set(-1.2, 2.4, -0.9);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd4e8, theme === 'oceanview' ? 0.35 : 0.0);
  fill.position.set(0.8, 1.4, 2.2);
  scene.add(fill);
  // Cool rim grazing across the desk (edge highlights on the paper piles).
  const rim = new THREE.DirectionalLight(0x9fc4e8, theme === 'oceanview' ? 0.5 : 0.0);
  rim.position.set(-2.0, 0.9, 0.6);
  scene.add(rim);

  // Desk surface.
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(DESK.w, DESK.h, DESK.d),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTexture(), roughness: 0.72 }),
  );
  desk.position.set(0, DESK.y, DESK.z);
  scene.add(desk);

  // Environment layer (window + panorama) — the switchable oceanview layer.
  let environment = null;
  if (theme === 'oceanview') {
    environment = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(WINDOW.w + 0.12, WINDOW.h + 0.12, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x9c7a52, roughness: 0.6 }),
    );
    frame.position.set(0, WINDOW.cy, WINDOW.z - 0.04);
    environment.add(frame);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.w, WINDOW.h),
      new THREE.MeshBasicMaterial({ color: 0xbfe2ef }),
    );
    glass.position.set(0, WINDOW.cy, WINDOW.z);
    environment.add(glass);
    // Window mullion, like the POV reference (left sash seam).
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, WINDOW.h, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.5, metalness: 0.2 }),
    );
    mullion.position.set(-0.32, WINDOW.cy, WINDOW.z + 0.02);
    environment.add(mullion);
    // Windowsill between the window and the desk — future trinkets area.
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(WINDOW.w + 0.04, 0.04, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x9c7a52, roughness: 0.6 }),
    );
    sill.position.set(0, 0.83, -0.34); // front edge flush with the desk (z = -0.28)
    environment.add(sill);
    // Wall around the window (references: warm room, window pops).
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8cab2, roughness: 0.95 });
    const wallDefs = [
      [2.4, 0.8, 0, 2.2, -0.48], // above
      [0.95, 2.2, -1.18, 1.2, -0.48], // left
      [0.95, 2.2, 1.18, 1.2, -0.48], // right
      [2.4, 0.84, 0, 0.42, -0.48], // below
    ];
    for (const [w, h, x, y, z] of wallDefs) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      wall.position.set(x, y, z);
      environment.add(wall);
    }
    // Side shelves flanking the window (D-024): less urgent stacks live here.
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x9c7a52, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.16), shelfMat);
      board.position.set(side * 0.97, 1.18, -0.42);
      environment.add(board);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.12), shelfMat);
      bracket.position.set(side * 0.97, 1.1, -0.45);
      environment.add(bracket);
    }

    // Sill trinkets: a small plant and books (POV reference).
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.028, 0.06, 16),
      toon(0xb5643c),
    );
    pot.position.set(-0.55, 0.88, -0.34);
    environment.add(pot);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      toon(0x4f7a4a),
    );
    leaves.position.set(-0.55, 0.95, -0.34);
    environment.add(leaves);
    const book1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.02, 0.07),
      toon(0x8a4b3a),
    );
    book1.position.set(0.5, 0.86, -0.34);
    environment.add(book1);
    const book2 = book1.clone();
    book2.position.y = 0.885;
    book2.rotation.y = 0.2;
    environment.add(book2);
    for (const prop of [pot, book1, book2]) {
      const ink = new THREE.Mesh(prop.geometry, OUTLINE_MAT);
      ink.position.copy(prop.position);
      ink.rotation.copy(prop.rotation);
      ink.scale.setScalar(1.08);
      environment.add(ink);
    }
    // Pen cup on the desk, left side (POV reference composition).
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.026, 0.06, 18),
      toon(0xd9d2c4),
    );
    cup.position.set(-0.58, 0.79, 0.1);
    environment.add(cup);
    const penColors = [0x2f5d8a, 0xb7791f, 0x2e343c, 0x8a4b3a];
    penColors.forEach((color, i) => {
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.11, 8),
        toon(color),
      );
      pen.position.set(-0.58 + (i - 1.5) * 0.012, 0.85, 0.1 + (i % 2) * 0.01);
      pen.rotation.z = (i - 1.5) * 0.08;
      pen.rotation.x = i % 2 ? 0.05 : -0.04;
      environment.add(pen);
    });
    // Placeholder sky texture; replaced by A0 panorama once loaded.
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 64;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext('2d');
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#7fb8d8');
    grad.addColorStop(0.55, '#cfe6ef');
    grad.addColorStop(0.56, '#5d7d6a');
    grad.addColorStop(1, '#3d5a4a');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const view = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.w, WINDOW.h),
      new THREE.MeshBasicMaterial({ map: skyTex }),
    );
    view.position.set(0, WINDOW.cy, WINDOW.z + 0.005);
    environment.add(view);

    // A0: real panorama from the user's reference (assets/panorama/bay-view.jpg).
    new THREE.TextureLoader().load('assets/panorama/bay-view.jpg', (tex) => {
      const imgAspect = tex.image.width / tex.image.height;
      const planeAspect = WINDOW.w / WINDOW.h;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      if (imgAspect < planeAspect) {
        tex.repeat.set(1, imgAspect / planeAspect);
        tex.offset.set(0, (1 - imgAspect / planeAspect) / 2);
      } else {
        tex.repeat.set(planeAspect / imgAspect, 1);
        tex.offset.set((1 - planeAspect / imgAspect) / 2, 0);
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      view.material.map = tex;
      view.material.needsUpdate = true;
    });
    scene.add(environment);
  }

  // Warm sun pool on the desk (additive plane, cheap — big visual win).
  if (theme === 'oceanview') {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(255, 236, 200, 0.38)');
    g.addColorStop(0.55, 'rgba(255, 226, 178, 0.14)');
    g.addColorStop(1, 'rgba(255, 220, 170, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const sunTex = new THREE.CanvasTexture(c);
    sunTex.colorSpace = THREE.SRGBColorSpace;
    const sunPatch = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.55),
      new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    sunPatch.rotation.x = -Math.PI / 2;
    sunPatch.rotation.z = 0.35;
    sunPatch.position.set(-0.05, DESK.y + DESK.h / 2 + 0.004, 0.12);
    scene.add(sunPatch);
  }

  // Tier 2 atmosphere: dust motes in the window light + a soft light shaft.
  let dust = null;
  let dustSeeds = null;
  if (theme === 'oceanview') {
    const dustCount = isMobile ? 36 : 90;
    const positions = new Float32Array(dustCount * 3);
    dustSeeds = new Float32Array(dustCount * 2);
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2.2;
      positions[i * 3 + 1] = 0.85 + Math.random() * 0.9;
      positions[i * 3 + 2] = Math.random() * 0.95 - 0.25; // stay clear of the camera at z=0.95
      dustSeeds[i * 2] = Math.random() * Math.PI * 2;
      dustSeeds[i * 2 + 1] = 0.3 + Math.random() * 0.7;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dc = document.createElement('canvas');
    dc.width = 32;
    dc.height = 32;
    const dctx = dc.getContext('2d');
    const dg = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    dg.addColorStop(0, 'rgba(255, 244, 214, 1)');
    dg.addColorStop(1, 'rgba(255, 244, 214, 0)');
    dctx.fillStyle = dg;
    dctx.fillRect(0, 0, 32, 32);
    const dustTex = new THREE.CanvasTexture(dc);
    dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      size: 0.013,
      map: dustTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    dust.userData.animate = (t) => {
      const pos = dust.geometry.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        pos.array[i * 3] += Math.sin(t * 0.0002 + dustSeeds[i * 2]) * 0.0002;
        pos.array[i * 3 + 1] += Math.sin(t * 0.00035 + dustSeeds[i * 2]) * 0.00012 + 0.00008;
        if (pos.array[i * 3 + 1] > 1.85) pos.array[i * 3 + 1] = 0.85;
      }
      pos.needsUpdate = true;
      dust.material.opacity = 0.35 + Math.sin(t * 0.0009) * 0.12;
    };
    scene.add(dust);

    // Diagonal light shaft from the window across the desk.
    const shaftCanvas = document.createElement('canvas');
    shaftCanvas.width = 128;
    shaftCanvas.height = 128;
    const sctx = shaftCanvas.getContext('2d');
    const sg = sctx.createLinearGradient(0, 0, 128, 128);
    sg.addColorStop(0, 'rgba(255, 232, 190, 0.55)');
    sg.addColorStop(0.5, 'rgba(255, 232, 190, 0.18)');
    sg.addColorStop(1, 'rgba(255, 232, 190, 0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 128, 128);
    const shaftTex = new THREE.CanvasTexture(shaftCanvas);
    const shaft = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.9),
      new THREE.MeshBasicMaterial({
        map: shaftTex,
        transparent: true,
        opacity: theme === 'oceanview' ? 0.26 : 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    shaft.position.set(-0.5, 1.3, 0.05);
    shaft.rotation.set(0, 0.35, -0.62);
    scene.add(shaft);
  }

  // Data-driven layers (rebuilt on state refresh).
  const stacksLayer = new THREE.Group();
  const zoneLayer = new THREE.Group();
  scene.add(stacksLayer, zoneLayer);

  let stackMeshes = [];
  let noteMeshes = [];
  let bubbles = [];
  let stacksBuilt = false;
  const entryPos = (entry) => {
    const key = entry.path ?? 'inbox';
    const p = deskPositions[key];
    return p && Number.isFinite(p.x) && Number.isFinite(p.z) ? p : null;
  };
  let deskPositions = {};

  // --- Animation system (visual-spec §6) ---------------------------------
  const tweens = [];
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function moveTween(mesh, to, { duration = 900, delay = 0, ease = easeOutCubic, lift = 0, onDone = null } = {}) {
    tweens.push({
      mesh,
      from: mesh.position.clone(),
      to: to.clone(),
      start: performance.now() + delay,
      duration,
      ease,
      lift,
      onDone,
    });
  }

  function updateTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (now < tw.start) continue;
      const t = Math.min((now - tw.start) / tw.duration, 1);
      const e = tw.ease(t);
      const y = tw.from.y + (tw.to.y - tw.from.y) * e + (tw.lift ? Math.sin(Math.PI * t) * tw.lift : 0);
      tw.mesh.position.set(
        tw.from.x + (tw.to.x - tw.from.x) * e,
        y,
        tw.from.z + (tw.to.z - tw.from.z) * e,
      );
      if (t >= 1) {
        if (tw.onDone) tw.onDone();
        tweens.splice(i, 1);
      }
    }
  }

  function layoutStacks(deskState) {
    stacksLayer.clear();
    stackMeshes = [];
    bubbles = [];
    deskPositions = {};
    for (const [key, meta] of Object.entries(deskState.config?.stacks ?? {})) {
      if (meta?.pos) deskPositions[key] = meta.pos;
    }
    const cfgMeta = {};
    for (const [key, meta] of Object.entries(deskState.config?.stacks ?? {})) {
      const name = key.includes('/') ? key.split('/').pop() : key;
      cfgMeta[name] = meta ?? {};
    }
    const recentTitles = (items) => {
      const sorted = [...(items ?? [])].sort((a, b) => ((a.meta?.updated ?? '') < (b.meta?.updated ?? '') ? 1 : -1));
      return sorted.slice(0, 3).map((i) => (i.meta?.title ?? i.fileName ?? '').replace(/\.md$/, ''));
    };
    const stackIcon = (name) => {
      const n = name.toLowerCase();
      if (n.includes('inbox') || n.includes('входящ')) return 'inbox';
      if (n.includes('иде') || n.includes('заметк')) return 'pen';
      if (n.includes('важн') || n.includes('star')) return 'star';
      return 'doc';
    };
    const all = [
      { name: 'Inbox', count: deskState.inboxItems.length, titles: recentTitles(deskState.inboxItems), icon: 'inbox', path: INBOX, shelf: false },
      ...deskState.stacks.map((s) => ({
        name: s.name,
        count: s.items.length,
        titles: recentTitles(s.items),
        icon: stackIcon(s.name),
        overdue: s.hasOverdue,
        agents: s.agents ?? [],
        path: s.path,
        shelf: Boolean(cfgMeta[s.name]?.shelf),
      })),
    ];
    const deskEntries = all.filter((e) => !e.shelf);
    const shelfEntries = all.filter((e) => e.shelf);
    // Sketch layout: two loose clusters (left/right), stacks never leave the
    // desk (|x| ≤ 0.55 m, z within the desktop). Saved positions win.
    const clusterPos = (i) => {
      const saved = entryPos(deskEntries[i]);
      if (saved) {
        return { x: THREE.MathUtils.clamp(saved.x, -0.55, 0.55), z: THREE.MathUtils.clamp(saved.z, -0.15, 0.45) };
      }
      const side = i % 2 === 0 ? -1 : 1;
      const k = Math.floor(i / 2); // index within the cluster
      const col = k % 2;
      const row = Math.floor(k / 2);
      const jitter = () => (Math.random() - 0.5) * 0.04;
      const x = side * (0.26 + col * 0.21) + jitter();
      const z = 0.0 + row * 0.2 + (col % 2) * 0.05 + jitter();
      return { x, z };
    };
    const n = deskEntries.length;
    const place = (entry, i) => {
      const pos = clusterPos(i, n);
      const mesh = makeStackMesh(entry);
      const target = new THREE.Vector3(pos.x, DESK.y + DESK.h / 2, pos.z);
      mesh.position.copy(target);
      if (!stacksBuilt) {
        mesh.position.y = target.y + 0.15;
        moveTween(mesh, target, { duration: 1000, delay: i * 70, ease: easeOutCubic });
      }
      mesh.userData.entry = entry;
      mesh.userData.home = target.clone();
      stacksLayer.add(mesh);
      stackMeshes.push(mesh);
      const bubble = makeBubble({ name: entry.name, icon: entry.icon ?? 'doc' });
      bubble.position.set(0, 0.21, 0);
      mesh.add(bubble);
      bubbles.push(bubble);
    };
    deskEntries.forEach((entry, i) => place(entry, i));
    // Shelf piles sit on the side shelves, smaller, upright (D-024).
    shelfEntries.forEach((entry, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const mesh = makeStackMesh(entry);
      mesh.scale.setScalar(0.62);
      mesh.position.set(side * (0.97 - row * 0.02), 1.18 + 0.02 + row * 0.02, -0.4);
      mesh.rotation.y = side * -0.12;
      mesh.userData.entry = entry;
      mesh.userData.home = mesh.position.clone();
      stacksLayer.add(mesh);
      stackMeshes.push(mesh);
      const bubble = makeBubble({ name: entry.name, icon: entry.icon ?? 'doc' });
      bubble.position.set(0, 0.16, 0);
      mesh.add(bubble);
      bubbles.push(bubble);
    });
    stacksBuilt = true;
  }

  function layoutZone(deskState) {
    zoneLayer.clear();
    noteMeshes = [];
    const all = collectTodayTasksLocal(deskState);
    const visible = all.slice(0, 5); // D-021: limit 5
    noteMeshes = noteMeshes.filter((m) => m.parent !== zoneLayer);
    visible.forEach((task, i) => zoneLayer.add(makeTaskSheet(task, i, noteMeshes)));
    if (all.length > 5) {
      const more = makeStackMesh({ name: `+${all.length - 5}`, count: all.length - 5, accent: '#b7791f' });
      more.scale.setScalar(0.7);
      more.position.set(0.56, DESK.y + DESK.h / 2, 0.3);
      zoneLayer.add(more);
    }
    // The always-visible blank sheet (capture entry, R-08).
    const blank = makeTaskSheet({ text: '+ New note (N)' }, 8);
    blank.position.set(0, 0.764, 0.34);
    blank.userData.blank = true;
    zoneLayer.add(blank);
  }

  function collectTodayTasksLocal(deskState) {
    const today = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const todayIso = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
    const out = [];
    const groups = [
      { name: 'Inbox', items: deskState.inboxItems },
      ...deskState.stacks.map((s) => ({ name: s.name, items: s.items })),
    ];
    for (const g of groups) {
      for (const item of g.items) {
        for (const t of item.tasks ?? []) {
          if (t.done || !t.due) continue;
          if (t.due <= todayIso) {
            out.push({
              text: t.text.replace(/\s*@due\(\d{4}-\d{2}-\d{2}\)/, ''),
              overdue: t.due < todayIso,
              due: t.due,
              dir: item.dir,
              fileName: item.fileName,
            });
          }
        }
      }
    }
    return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  }

  function refresh(deskState) {
    layoutStacks(deskState);
    layoutZone(deskState);
  }

  // Note flight (visual-spec §6): a sheet arcs from the working zone to a stack.
  function flyNote(stackName) {
    const target = stackMeshes.find((m) => m.userData.entry?.name === stackName);
    if (!target) return;
    const sheet = makeSheet({ w: 0.06, h: 0.09, color: '#ffffff' });
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(0, 0.78, 0.5);
    scene.add(sheet);
    const dest = target.position.clone();
    dest.y = 0.82;
    moveTween(sheet, dest, {
      duration: 750,
      ease: easeInOutCubic,
      lift: 0.18,
      onDone: () => scene.remove(sheet),
    });
    const home = target.userData.home?.clone() ?? target.position.clone();
    moveTween(target, home.clone().setY(home.y + 0.02), { duration: 180, ease: easeOutCubic });
    setTimeout(() => moveTween(target, home, { duration: 260, ease: easeInOutCubic }), 200);
  }

  // Picking (stack click → navigation; blank sheet → capture).
  // Tap-vs-swipe guard: only treat as a tap when the pointer barely moved
  // between down and up — otherwise a camera swipe on a stack would open it.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPos = null;
  let dragStack = null;
  let dragMoved = false;
  const gridOccupancy = () => {
    const taken = [];
    for (const m of stackMeshes) {
      if (m === dragStack) continue;
      if (m.position.z < 0.55) taken.push({ x: m.position.x, z: m.position.z });
    }
    for (const m of noteMeshes) {
      if (m === dragStack) continue;
      taken.push({ x: m.position.x, z: m.position.z });
    }
    return taken;
  };
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(DESK.y + DESK.h / 2));
  // Nearest desk stack within ~1.3 grid cells: drop target for notes.
  const stackUnder = (x, z) => {
    let best = null;
    let bestD = 0.1;
    for (const m of stackMeshes) {
      if (!m.userData?.entry || m.position.z < 0.0 || m.position.z > 0.5) continue;
      const d = Math.hypot(m.position.x - x, m.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  };
  const dragPoint = new THREE.Vector3();
  function onPointerDown(e) {
    downPos = { x: e.clientX, y: e.clientY };
    dragMoved = false;
    if (e.pointerType !== 'touch' && state?.enabled !== false) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const rawHits = raycaster.intersectObjects([...stackMeshes, ...noteMeshes], true);
      // Sprites (bubbles) must never win the pick: depthTest:false quads
      // float above piles and made every grab land on the nearest stack.
      const hits = rawHits.filter((h) => !h.object.isSprite);
      if (hits.length) {
        let obj = hits[0].object;
        while (obj.parent && obj.parent !== stacksLayer && obj.parent !== zoneLayer) obj = obj.parent;
        if (obj.userData?.entry) {
          dragStack = obj;
          obj.userData.dragging = true;
          canvas.dataset.dragging = '1';
          canvas.style.cursor = 'grabbing';
        } else if (obj.userData?.note) {
          dragStack = obj;
          obj.userData.dragging = true;
          canvas.dataset.dragging = '1';
          canvas.style.cursor = 'grabbing';
        }
      }
    }
  }
  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    if (dragStack) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
        const x = THREE.MathUtils.clamp(snapGrid(dragPoint.x), -0.56, 0.56);
        const z = THREE.MathUtils.clamp(snapGrid(dragPoint.z), -0.14, 0.56);
        const lift = dragStack.userData?.note ? 0.012 : 0;
        dragStack.position.set(x, DESK.y + DESK.h / 2 + lift, z);
        dragMoved = true;
      }
      return;
    }
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(bubbles, false);
    const hit = hits[0]?.object ?? null;
    for (const b of bubbles) b.userData.setExpanded(b === hit && !b.parent?.userData?.dragging);
    canvas.style.cursor = hit ? 'pointer' : '';
  }
  function onPointerUp(e) {
    if (dragStack) {
      dragStack.userData.dragging = false;
      delete canvas.dataset.dragging;
      if (dragMoved) {
        const note = dragStack.userData?.note;
        if (note) {
          const cell = nearestFreeCell(dragStack.position.x, dragStack.position.z, gridOccupancy());
          dragStack.position.set(cell.x, DESK.y + DESK.h / 2, cell.z);
          // Dropped onto a pile? Ask before filing the note into that stack.
          const target = stackUnder(cell.x, cell.z);
          if (target) {
            dragStack.position.y = DESK.y + DESK.h / 2;
            onNoteIntoStack?.(note, { name: target.userData.name, path: target.userData.entry?.path ?? target.userData.name });
          } else {
            onNoteMove?.(note, { x: cell.x, z: cell.z });
          }
        } else {
          const cell = nearestFreeCell(dragStack.position.x, dragStack.position.z, gridOccupancy());
          dragStack.position.set(cell.x, DESK.y + DESK.h / 2, cell.z);
          const entry = dragStack.userData.entry;
          onStackMove?.(entry.path ?? 'inbox', { x: cell.x, z: cell.z });
        }
      }
      dragStack = null;
      canvas.style.cursor = '';
      downPos = null;
      return;
    }
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > 8) return; // it was a camera swipe, not a tap
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...stackMeshes, ...zoneLayer.children], true);
    const hit = hits[0];
    if (!hit) return;
    let obj = hit.object;
    while (obj.parent && obj.parent !== stacksLayer && obj.parent !== zoneLayer) obj = obj.parent;
    if (obj.userData?.blank) onZoneClick?.('capture');
    else if (obj.userData?.entry?.path) onZoneClick?.('stack', obj.userData.entry);
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);

  let running = true;
  let frameCount = 0;
  let lastFrameError = null;
  function animate(now) {
    if (!running) return;
    try {
      rig?.tick(now);
      updateTweens(now);
      for (const b of bubbles) b.userData.tick(now);
      dust?.userData.animate(now);
      grainPass.uniforms.time.value = now * 0.001;
      composer.render();
      frameCount++;
    } catch (e) {
      lastFrameError = String(e && e.stack || e);
    }
    requestAnimationFrame(animate);
  }

  let rig = null;
  function attachRig(rigInstance) {
    rig = rigInstance;
    rig.attach();
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloomPass.setSize(Math.max(w * (isMobile ? 0.5 : 1), 1), Math.max(h * (isMobile ? 0.5 : 1), 1));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  requestAnimationFrame(animate);

  return {
    refresh,
    attachRig,
    flyNote,
    camera,
    debug: () => ({
      sceneChildren: scene.children.length,
      stackMeshes: stacksLayer.children.length,
      zoneMeshes: zoneLayer.children.length,
      cam: camera.position.toArray().map((v) => Number(v.toFixed(2))),
      quat: camera.quaternion.toArray().map((v) => Number(v.toFixed(2))),
      size: [renderer.domElement.width, renderer.domElement.height],
      calls: renderer.info.render.calls,
      frames: frameCount,
      frameError: lastFrameError,
      rig: rig ? { pitch: rig.state.pitch, yaw: rig.state.yaw } : null,
    }),
    dispose() {
      running = false;
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      composer.dispose?.();
      renderer.dispose();
    },
  };
}
