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
const WINDOW = { w: 1.4, h: 0.96, cy: 1.28, z: -0.40 }; // dropped: sill bottom ~3mm over desk top
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
// Soft ink for BackSide outline hulls (example ref: thin, warm-dark, uniform).
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x2e251b, side: THREE.BackSide });
// Hand-drawn contact line: jittered ellipse loop lying on a surface under
// an object — sells "seated" contact when hull bottoms self-occlude.
function contactInk({ x = 0, y, z, rx, rz, opacity = 0.65 }) {
  const pts = [];
  const N = 44;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    // deterministic wobble: radius breathes around the footprint
    const j = 1 + (Math.sin(a * 3.7 + x * 41.0) * 0.5 + Math.sin(a * 7.3 + z * 29.0) * 0.5) * 0.06;
    pts.push(new THREE.Vector3(x + Math.cos(a) * rx * j, y, z + Math.sin(a) * rz * j));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0x2e251b, transparent: true, opacity }));
}

const OUTLINE_REGISTRY = []; // {ink, base} — rescaled per-frame for uniform screen width
const OUTLINE_REF_DIST = 1.35; // camera->desk distance the default 4mm targets

function addOutline(mesh, { thickness = 0.004 } = {}) {
  const ink = new THREE.Mesh(mesh.geometry, OUTLINE_MAT);
  ink.position.copy(mesh.position);
  ink.rotation.copy(mesh.rotation);
  ink.scale.setScalar(1);
  // Uniform visual thickness: grow along each axis by a fixed world amount.
  const base = new THREE.Vector3(
    (mesh.geometry.boundingBox?.max.x ?? 0.5) * 2 + thickness,
    (mesh.geometry.boundingBox?.max.y ?? 0.5) * 2 + thickness,
    (mesh.geometry.boundingBox?.max.z ?? 0.5) * 2 + thickness,
  ).divide(new THREE.Vector3(
    (mesh.geometry.boundingBox?.max.x ?? 0.5) * 2,
    (mesh.geometry.boundingBox?.max.y ?? 0.5) * 2,
    (mesh.geometry.boundingBox?.max.z ?? 0.5) * 2,
  ));
  ink.scale.copy(base);
  OUTLINE_REGISTRY.push({ ink, base });
  return ink;
}

// Per-frame: keep every hull's screen thickness constant regardless of its
// distance to the camera — far objects thin their world hull, near ones
// fatten it, so strokes read hand-inked-uniform across the frame.
function updateOutlineScale(camera) {
  const v = new THREE.Vector3();
  for (const { ink, base } of OUTLINE_REGISTRY) {
    ink.getWorldPosition(v);
    const dist = v.distanceTo(camera.position);
    // hull thickness scales linearly with distance: world = px * dist
    const k = dist / OUTLINE_REF_DIST;
    ink.scale.set(
      1 + (base.x - 1) * k,
      1 + (base.y - 1) * k,
      1 + (base.z - 1) * k,
    );
  }
}

// Round 9 art direction: everything white for now (colors come later from
// reference boards) — toon() clamps any requested color to paper white.
const WHITE_MODE = true;
function toon(color) {
  if (WHITE_MODE) color = '#ffffff';
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

const A5 = { w: 0.118, d: 0.168, t: 0.0037 }; // 20% smaller A5

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

// Landscape bubble: H < collapsed width (pad*2+icon), so even the
// icon-only state reads as a wide manga oval, never a vertical egg.
const BUBBLE = { H: 176, pad: 72, icon: 88, gap: 24, font: 44, radius: 30 };

function drawIcon(ctx, name, x, y, size, color = 'rgba(255,255,255,0.95)') {
  const path = new Path2D(ICONS[name] ?? ICONS.doc);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.35;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);
  ctx.restore();
}

// Manga cloud outline: bumpy closed curve around an ellipse + a little tail
// pointing down (speech-bubble tail toward the stack).
function cloudPath2D(cx, cy, rx, ry, bumps = 9) {
  // Gentle bumps (0.93..1.07): organic edge that never dips far enough to
  // bite into the icon or label (the old 0.84..1.16 did — text overflowed).
  const pts = [];
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    const rr = 0.93 + seededRandom(`bump${i}${Math.round(rx)}${Math.round(ry)}`)() * 0.14;
    pts.push({ x: cx + Math.cos(a) * rx * rr, y: cy + Math.sin(a) * ry * rr });
  }
  const path = new Path2D();
  path.moveTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
  for (let i = 1; i <= bumps; i++) {
    const p = pts[i % bumps];
    const n = pts[(i + 1) % bumps];
    path.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
  }
  path.closePath();
  return path;
}

// Matte-glass rectangle: soft white fill, double hairline stroke, faint
// diagonal frost bands. Everything is drawn from explicit state each call
// (fixes the lost-label bug caused by stale canvas/ctx state).
const INK = '#2a2118';

function drawBubbleFrame(ctx, W, icon, label, textAlpha, fullW = null) {
  const H = BUBBLE.H;
  ctx.clearRect(0, 0, fullW ?? W, H);
  // Manga speech cloud: bumpy body, opaque white, fat ink outline, tail down.
  const full = fullW ?? W;
  const cx = full / 2; // anchor: canvas center — sprite never shifts
  const cy = H / 2 - 6;
  const rx = W / 2 - 16; // frame width still governs body size
  const ry = H / 2 - 22;
  // Body + tail as ONE Path2D union: fat stroke first, white fill over it —
  // every inner seam (tail/body junction) is covered, only the outer half
  // of the stroke survives as one continuous manga contour.
  const body = cloudPath2D(cx, cy, rx, ry);
  const tail = new Path2D();
  tail.moveTo(cx - 16, cy + ry - 8);
  tail.quadraticCurveTo(cx - 8, cy + ry + 18, cx + 1, cy + ry + 20);
  tail.quadraticCurveTo(cx + 9, cy + ry + 15, cx + 17, cy + ry - 6);
  tail.closePath();
  const union = new Path2D();
  union.addPath(body);
  union.addPath(tail);
  ctx.save();
  ctx.shadowColor = 'rgba(42, 33, 24, 0.20)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.99)';
  ctx.fill(union);
  ctx.restore();
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.stroke(union);
  ctx.fillStyle = 'rgba(255,255,255,0.99)';
  ctx.fill(union);
  // Icon rides the BODY's left edge (not the canvas): stays inside the
  // bumpy outline at any expansion width.
  const iconX = cx - rx + BUBBLE.pad * 0.7;
  drawIcon(ctx, icon, iconX, H / 2 - BUBBLE.icon / 2, BUBBLE.icon, INK);
  // Label fades in to the right of the icon — ink on white, like manga.
  // Right limit stays inside the bumpy boundary's worst inward dip (0.86).
  if (label && textAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = Math.min(Math.max(textAlpha, 0), 1);
    ctx.font = `500 ${BUBBLE.font}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    const labelX = iconX + BUBBLE.icon + BUBBLE.gap;
    const limitR = cx + rx * 0.86 - BUBBLE.pad * 0.6;
    ctx.fillText(label, labelX, cy + 2, Math.max(limitR - labelX, 10));
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
    opacity: 0.97,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  const WORLD_H = 0.057; // 1.5x smaller than v1
  const label = name.length > 18 ? `${name.slice(0, 17)}…` : name;
  const W0 = BUBBLE.pad * 2 + BUBBLE.icon;
  ctx.font = `500 ${BUBBLE.font}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  const textW = ctx.measureText(label).width;
  const W1 = Math.ceil(W0 + BUBBLE.gap + textW + BUBBLE.pad + 30); // +30: bump-safe slack
  let shownW = W0;
  let anim = null;
  // Canvas stays at full expanded width (W1) for the sprite's whole life:
  // the texture aspect never changes, so the icon cannot stretch while the
  // frame animates — the frame is just drawn narrower inside the canvas.
  canvas.width = Math.max(Math.ceil(W1), 2);
  canvas.height = BUBBLE.H;
  const apply = (w, alpha) => {
    shownW = w;
    drawBubbleFrame(ctx, Math.max(Math.round(w), 2), icon, alpha > 0.01 ? label : '', alpha, canvas.width);
    tex.needsUpdate = true;
  };
  apply(W0, 0);
  sprite.scale.set(WORLD_H * (canvas.width / BUBBLE.H), WORLD_H, 1);
  sprite.center.set(0.5, 0.5);
  sprite.userData = {
    name,
    expanded: false,
    setExpanded(on) {
      if (sprite.userData.expanded === on) return;
      sprite.userData.expanded = on;
      mat.opacity = on ? 1.0 : 0.97;
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
  // Horizontal ruled lines (anime notebook ref): soft blue, even spacing.
  ctx.strokeStyle = 'rgba(100, 140, 190, 0.22)';
  ctx.lineWidth = 3;
  for (let y = 180; y < H - 60; y += 96) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(W - 64, y);
    ctx.stroke();
  }
  // Recent note titles — small, thin, same family as the A6 notes.
  ctx.font = '400 60px \'Helvetica Neue\', \'Helvetica Neue LT\', Helvetica, Arial, sans-serif';
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
    if (!group.userData.curl) group.userData.curl = curl; // flutter target
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
    curl.userData.baseRotX = curl.rotation.x;
    curl.userData.baseRotZ = curl.rotation.z;
    group.add(curl);
    // Per-sheet ink edges: crisp LineSegments hugging THIS sheet — anime
    // line art, no shadow box, reads at any distance.
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(sheet.geometry),
      new THREE.LineBasicMaterial({ color: 0x2e251b, transparent: true, opacity: 0.85 }),
    );
    edge.position.copy(sheet.position);
    edge.rotation.copy(sheet.rotation);
    group.add(edge);
    topY = lift + A5.t + 0.003;
  }
  if (overdue) {
    const seal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.004, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    );
    seal.position.set(0.05, topY + 0.003, 0.08);
    group.add(seal);
  }
  group.userData = { name, count, topY, icon };
  return group;
}

const A6 = { w: 0.084, h: 0.118 }; // 20% smaller A6
let curlGeo = null; // shared quarter-cylinder wedge for sheet corner curls

// Invisible snap grid: stacks/notes land on 1.75 cm cells (4x finer than
// the old 7 cm grid) for granular placement. Occupancy keeps the OLD 6.3 cm
// radius in absolute terms, so piles still never overlap; the free-cell
// spiral searches the same 28 cm reach (16 x 1.75 cm).
const GRID = 0.0175;
const CELL = GRID; // occupancy radius = one 1.75 cm cell (art direction)
const snapGrid = (v) => Math.round(v / GRID) * GRID;
function nearestFreeCell(x, z, taken) {
  const gx = snapGrid(x);
  const gz = snapGrid(z);
  const overs = (cx, cz) => taken.some((p) => Math.abs(p.x - cx) < CELL && Math.abs(p.z - cz) < CELL);
  if (!overs(gx, gz)) return { x: gx, z: gz };
  for (let r = 1; r <= 16; r++) {
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
  // Horizontal ruled lines (anime ref).
  ctx.strokeStyle = 'rgba(100, 140, 190, 0.20)';
  ctx.lineWidth = 2;
  for (let y = 300; y < H - 40; y += 78) {
    ctx.beginPath();
    ctx.moveTo(44, y);
    ctx.lineTo(W - 44, y);
    ctx.stroke();
  }
  ctx.fillStyle = overdue ? '#8f2f22' : '#4a3d2b';
  ctx.font = '300 34px \'Helvetica Neue\', \'Helvetica Neue LT\', Helvetica, Arial, sans-serif';
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
    new THREE.MeshStandardMaterial({ color: '#fdfcf8', roughness: 0.88 }),
  );
  sheet.geometry.computeBoundingBox();
  group.add(sheet, addOutline(sheet, { thickness: 0.005 }));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(A6.w, A6.h),
    new THREE.MeshBasicMaterial({ map: a6NoteTexture(text, overdue), toneMapped: false }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0025;
  group.add(face);
  const col = index % 4;
  const row = Math.floor(index / 4);
  group.position.set(-0.39 + col * 0.26 + (col % 2) * 0.05, 0.7625, 0.12 + row * 0.22 + (col % 2) * 0.06);
  group.rotation.y = -0.12 + (Math.random() - 0.5) * 0.24;
  if (dir && fileName && noteRegistry) {
    group.userData.note = { dir, fileName, text };
    group.userData.owner = group;
    noteRegistry.push(group);
  }
  return group;
}

export function createScene({ canvas, state, onZoneClick, onStackMove, onNoteMove, onNoteIntoStack, onNoteOpen, config = {} }) {
  const theme = config.theme ?? 'minimal';
  const noview = (() => { try { return new URLSearchParams(window.location.search).get('noview') === '1'; } catch { return false; } })();
  const nograde = (() => { try { return new URLSearchParams(window.location.search).get('nograde') === '1'; } catch { return false; } })();
  const probe = (() => { try { return new URLSearchParams(window.location.search).get('probetest') === '1'; } catch { return false; } })();

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
  let rayGroupRef = null;
  const bgprobe = (() => { try { return new URLSearchParams(window.location.search).get('bgprobe') === '1'; } catch { return false; } })();
  scene.background = new THREE.Color(theme === 'oceanview' ? 0xf1ede6 : 0xf4f6f8);
  // Subtle atmospheric depth (barely visible indoors, helps the window view).
  scene.fog = new THREE.Fog(theme === 'oceanview' ? 0xf1ede6 : 0xf4f6f8, 6, 18);

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

  // Color grade (Tier 2): anime film look — richer saturation, lifted teal
  // shadows, warm highlights, gentle S-curve. Cheap single-pass shader.
  const GradeShader = {
    uniforms: {
      tDiffuse: { value: null },
      saturation: { value: theme === 'oceanview' ? 1.04 : 1.08 }, // colors come later; keep whites clean
      lift: { value: new THREE.Vector3(0.012, 0.028, 0.052) },   // teal shadows
      gain: { value: new THREE.Vector3(1.015, 1.005, 0.99) },    // near-neutral highs (white mode)
      contrast: { value: 1.09 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float saturation;
      uniform vec3 lift;
      uniform vec3 gain;
      uniform float contrast;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec3 col = c.rgb * gain + lift;
        col = (col - 0.5) * contrast + 0.5;
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = clamp(mix(vec3(l), col, saturation), 0.0, 1.0);
        gl_FragColor = vec4(col, c.a);
      }`,
  };
  const gradePass = new ShaderPass(GradeShader);
  if (!nograde) composer.addPass(gradePass);
  composer.addPass(grainPass);
  composer.addPass(new OutputPass());

  // Lights: warm window light (references: sunlit anime desk).
  // Tier 0 lighting: warm key from the window + cool fill from the room.
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0x9a8568, theme === 'oceanview' ? 0.92 : 1.0);
  scene.add(hemi);
  // Faint room ambient so the dark walls read as walls, not void.
  const ambient = new THREE.AmbientLight(0xfff2dd, theme === 'oceanview' ? 0.42 : 0.0);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffd9a8, theme === 'oceanview' ? 2.3 : 1.0);
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
    new THREE.MeshStandardMaterial({ color: 0xfefdfa, roughness: 0.8 }),
  );
  desk.position.set(0, DESK.y, DESK.z);
  desk.geometry.computeBoundingBox();
  scene.add(desk, addOutline(desk));
  // Crisp top-rim line: anime props get one clean stroke on the facing edge.
  const rimPts = [
    new THREE.Vector3(-DESK.w / 2, DESK.y + DESK.h / 2 + 0.001, DESK.z - DESK.d / 2),
    new THREE.Vector3(DESK.w / 2, DESK.y + DESK.h / 2 + 0.001, DESK.z - DESK.d / 2),
  ];
  const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPts);
  scene.add(new THREE.Line(rimGeo, new THREE.LineBasicMaterial({ color: 0x4a3d2e, transparent: true, opacity: 0.6 })));

  // Environment layer (window + panorama) — the switchable oceanview layer.
  let environment = null;
  if (theme === 'oceanview') {
    environment = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xfefdfa, roughness: 0.7 });
    const frameT = 0.06; // frame strip thickness
    const frameDepth = 0.05;
    const frameZ = WINDOW.z - 0.04;
    const frameDefs = [
      [WINDOW.w + 0.24, frameT, 0, WINDOW.cy + WINDOW.h / 2 + frameT / 2], // top
      [WINDOW.w + 0.24, frameT, 0, WINDOW.cy - WINDOW.h / 2 - frameT / 2], // bottom
      [frameT, WINDOW.h, -WINDOW.w / 2 - frameT / 2, WINDOW.cy], // left
      [frameT, WINDOW.h, WINDOW.w / 2 + frameT / 2, WINDOW.cy], // right
    ];
    for (const [w, h, x, y] of frameDefs) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameDepth), frameMat);
      strip.position.set(x, y, frameZ);
      strip.geometry.computeBoundingBox();
      environment.add(strip, addOutline(strip));
    }
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.w, WINDOW.h),
      new THREE.MeshBasicMaterial({ color: 0xdff1f7, transparent: true, opacity: 0.1, depthWrite: false }),
    );
    glass.position.set(0, WINDOW.cy, WINDOW.z);
    environment.add(glass);
    // Window mullion, like the POV reference (left sash seam).
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, WINDOW.h, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xfefdfa, roughness: 0.6 }),
    );
    mullion.position.set(-0.32, WINDOW.cy, WINDOW.z + 0.02);
    mullion.geometry.computeBoundingBox();
    environment.add(mullion, addOutline(mullion, { thickness: 0.003 }));
    // Windowsill between the window and the desk — future trinkets area.
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(WINDOW.w + 0.12, 0.04, 0.12), // flush with frame outer edge (±0.76)
      new THREE.MeshStandardMaterial({ color: 0xfefdfa, roughness: 0.7 }),
    );
    sill.position.set(0, 0.783, -0.34); // bottom 0.763: 3mm above the desk top (0.76)
    sill.geometry.computeBoundingBox();
    environment.add(sill, addOutline(sill));
    // Wall around the window (references: warm room, window pops).
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.95 });
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
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xfefdfa, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.16), shelfMat);
      board.position.set(side * 1.08, 1.18, -0.42);
      board.geometry.computeBoundingBox();
      environment.add(board, addOutline(board));
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.12), shelfMat);
      bracket.position.set(side * 1.08, 1.1, -0.45);
      bracket.geometry.computeBoundingBox();
      environment.add(bracket, addOutline(bracket));
    }

    // Sill trinkets: a small plant and books (POV reference).
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.028, 0.06, 16),
      toon(0xb5643c),
    );
    pot.position.set(-0.55, 0.8335, -0.34); // bottom tangent to the sill top
    environment.add(pot);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      toon(0x4f7a4a),
    );
    leaves.position.set(-0.55, 0.906, -0.34);
    environment.add(leaves);
    const book1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.02, 0.07),
      toon(0x8a4b3a),
    );
    book1.position.set(0.5, 0.8145, -0.34); // hull bottom arc lands on the sill (cup recipe)
    environment.add(book1);
    const book2 = book1.clone();
    book2.position.y = 0.8375; // hull arcs of both books touch
    book2.rotation.y = 0.2;
    environment.add(book2);
    for (const prop of [pot, leaves, book1, book2]) {
      prop.geometry.computeBoundingBox();
      environment.add(addOutline(prop, { thickness: 0.003 }));
    }
    // Ground contact ink under the sill trinkets (hull bottoms self-occlude
    // at grazing angles — a drawn line reads reliably, like anime ground).
    environment.add(contactInk({ x: 0.5, y: 0.8036, z: -0.34, rx: 0.054, rz: 0.038 }));
    environment.add(contactInk({ x: 0.5, y: 0.8266, z: -0.34, rx: 0.054, rz: 0.038 }));
    // Pot base ring: torus half-sunk at the foot — grazing angles kill flat
    // ground lines, a 3D ring keeps the manga contact mark visible.
    const potRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.029, 0.0013, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x2e251b }),
    );
    potRing.rotation.x = -Math.PI / 2;
    potRing.position.set(-0.55, 0.8042, -0.34);
    environment.add(potRing);
    // Pen cup on the desk, left side (POV reference composition).
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.026, 0.06, 18),
      toon(0xd9d2c4),
    );
    cup.position.set(-0.58, 0.7925, 0.1); // sits ON the desk; hull bottom visible
    cup.geometry.computeBoundingBox();
    environment.add(cup, addOutline(cup, { thickness: 0.003 }));
    const penColors = [0x2f5d8a, 0xb7791f, 0x2e343c, 0x8a4b3a];
    penColors.forEach((color, i) => {
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.11, 8),
        toon(color),
      );
      pen.position.set(-0.58 + (i - 1.5) * 0.012, 0.8525, 0.1 + (i % 2) * 0.01);
      pen.rotation.z = (i - 1.5) * 0.08;
      pen.rotation.x = i % 2 ? 0.05 : -0.04;
      pen.geometry.computeBoundingBox();
      environment.add(pen, addOutline(pen, { thickness: 0.0025 }));
    });
    // DEPTH LAYERS (parallax on camera yaw): sky (far) → panorama (mid) →
    // drifting cumulus (near-far) → haze veil (nearest). Each layer sits at
    // its own z behind the window opening; rotation slides them against
    // each other, giving the view real depth instead of a flat poster.
    // Sky gradient plane (farthest, z -2.4): 'Your Name' blue with a warm
    // horizon band.
    const skyFar = document.createElement('canvas');
    skyFar.width = 64;
    skyFar.height = 512;
    const skyCtx = skyFar.getContext('2d');
    const sg = skyCtx.createLinearGradient(0, 0, 0, 512);
    sg.addColorStop(0, '#4f8fc0');
    sg.addColorStop(0.45, '#8fc3e0');
    sg.addColorStop(0.62, '#d8ecf2');
    sg.addColorStop(0.70, '#f2e3c4');
    sg.addColorStop(1, '#dfe8e4');
    skyCtx.fillStyle = sg;
    skyCtx.fillRect(0, 0, 64, 512);
    const skyTex = new THREE.CanvasTexture(skyFar);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.w * 2.6, WINDOW.h * 2.6),
      new THREE.MeshBasicMaterial({ color: probe ? 0xff0000 : 0xffffff, map: probe ? null : skyTex, fog: false }),
    );
    const probeZ = (() => { try { const v = parseFloat(new URLSearchParams(window.location.search).get('probeZ')); return Number.isFinite(v) ? v : -2.4; } catch { return -2.4; } })();
    skyPlane.position.set(0, WINDOW.cy + 0.5, probeZ);
    environment.add(skyPlane);

    // Drifting cumulus band between the panorama and the haze: flat-based
    // puffy clouds (manga/anime staple), slow drift + yaw parallax.
    const cloudTexCanvas = document.createElement('canvas');
    cloudTexCanvas.width = 1024;
    cloudTexCanvas.height = 256;
    const cctx = cloudTexCanvas.getContext('2d');
    const drawCloud = (x, y, scale) => {
      cctx.save();
      cctx.translate(x, y);
      cctx.scale(scale, scale);
      cctx.beginPath();
      cctx.arc(-46, -8, 26, Math.PI * 0.5, Math.PI * 1.5);
      cctx.arc(-16, -26, 30, Math.PI * 0.8, Math.PI * 1.95);
      cctx.arc(24, -22, 26, Math.PI * 1.2, Math.PI * 0.15);
      cctx.arc(48, -6, 24, Math.PI * 1.5, Math.PI * 0.5);
      cctx.closePath();
      const cg = cctx.createLinearGradient(0, -56, 0, 10);
      cg.addColorStop(0, 'rgba(255,255,255,0.98)');
      cg.addColorStop(0.75, 'rgba(238,242,246,0.95)');
      cg.addColorStop(1, 'rgba(208,220,232,0.92)');
      cctx.fillStyle = cg;
      cctx.fill();
      cctx.restore();
    };
    for (const [x, y, sc] of [[70, 150, 1.0], [300, 110, 0.72], [520, 170, 1.15], [760, 100, 0.66], [950, 160, 0.95]]) drawCloud(x, y, sc);
    const cloudTex = new THREE.CanvasTexture(cloudTexCanvas);
    cloudTex.colorSpace = THREE.SRGBColorSpace;
    const cloudPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.w * 2.1, WINDOW.w * 2.1 * 0.25),
      new THREE.MeshBasicMaterial(probe ? { color: 0x00ff00, fog: false } : { map: cloudTex, transparent: true, depthWrite: false, fog: false }),
    );
    cloudPlane.position.set(0, WINDOW.cy + 0.55, -1.75);
    environment.add(cloudPlane);
    cloudPlane.userData.animate = (now) => {
      const t = now * 0.000012;
      cloudPlane.position.x = Math.sin(t) * 0.22;
    };

    // Haze veil right behind the panorama: sells aerial perspective.
    const hazeTex = (() => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 256;
      const hctx = c.getContext('2d');
      const hg = hctx.createLinearGradient(0, 0, 0, 256);
      hg.addColorStop(0, 'rgba(214,232,240,0)');
      hg.addColorStop(0.72, 'rgba(222,236,242,0.10)');
      hg.addColorStop(1, 'rgba(232,240,244,0.26)');
      hctx.fillStyle = hg;
      hctx.fillRect(0, 0, 64, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.w * 2.2, WINDOW.h * 2.2),
      new THREE.MeshBasicMaterial(probe ? { color: 0x0000ff, transparent: true, opacity: 0.9, depthWrite: false, fog: false } : { map: hazeTex, transparent: true, depthWrite: false, fog: false }),
    );
    haze.position.set(0, WINDOW.cy - 0.25, -0.95);
    environment.add(haze);

    // Placeholder sky texture; replaced by A0 panorama once loaded.
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 64;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext('2d');
    sctx.fillStyle = '#cfe0e8';
    sctx.fillRect(0, 0, 64, 256);
    const panoPlaceholder = new THREE.CanvasTexture(skyCanvas);
    panoPlaceholder.colorSpace = THREE.SRGBColorSpace;
    const view = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.w * 1.9, WINDOW.h * 1.9),
      new THREE.MeshBasicMaterial(probe ? { color: 0xffff00 } : { map: panoPlaceholder }),
    );
    view.position.set(0, WINDOW.cy - 0.10, -1.5); // bottom edge hides behind the sill — no gray gap
    if (!noview) environment.add(view);

    // A0: real panorama from the user's reference (assets/panorama/bay-view.jpg).
    new THREE.TextureLoader().load('assets/panorama/bay-view.jpg', (tex) => {
      const imgAspect = tex.image.width / tex.image.height;
      const planeAspect = WINDOW.w / WINDOW.h;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      const zoom = 1.35; // visible slice of the pano through the opening
      if (imgAspect < planeAspect) {
        tex.repeat.set(1 / zoom, (imgAspect / planeAspect) / zoom);
        tex.offset.set((1 - 1 / zoom) / 2, (1 - (imgAspect / planeAspect) / zoom) / 2);
      } else {
        tex.repeat.set((planeAspect / imgAspect) / zoom, 1 / zoom);
        tex.offset.set((1 - (planeAspect / imgAspect) / zoom) / 2, Math.max((1 - 1 / zoom) / 2 - 0.06, 0));
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
    g.addColorStop(0, 'rgba(255, 238, 205, 0.5)');
    g.addColorStop(0.55, 'rgba(255, 228, 185, 0.2)');
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
      // Round 9: motes live from the window to the desk MIDDLE (z <= 0.28);
      // nothing drifts into the camera space (camera at z=0.95).
      positions[i * 3 + 2] = -0.4 + Math.random() * 0.68;
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
          if (pos.array[i * 3 + 2] > 0.3) pos.array[i * 3 + 2] = -0.35;
      }
      pos.needsUpdate = true;
      dust.material.opacity = 0.35 + Math.sin(t * 0.0009) * 0.12;
    };
    scene.add(dust);

    // Sun rays (sunrays ref): a fan of parallel bright beams streaming from
    // the upper-left of the window down across the desk. Each beam is a
    // thin additive plane; widths vary so the fan reads organic, not CG.
    const rayGroup = new THREE.Group();
    const beamTex = (() => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 256;
      const bctx = c.getContext('2d');
      const bg = bctx.createLinearGradient(0, 0, 0, 256);
      bg.addColorStop(0, 'rgba(255, 244, 214, 0.85)');
      bg.addColorStop(0.55, 'rgba(255, 240, 205, 0.30)');
      bg.addColorStop(1, 'rgba(255, 236, 200, 0)');
      bctx.fillStyle = bg;
      bctx.fillRect(0, 0, 64, 256);
      // Soft lateral falloff so beam edges never alias.
      const lat = bctx.createLinearGradient(0, 0, 64, 0);
      lat.addColorStop(0, 'rgba(0,0,0,1)');
      lat.addColorStop(0.25, 'rgba(0,0,0,0)');
      lat.addColorStop(0.75, 'rgba(0,0,0,0)');
      lat.addColorStop(1, 'rgba(0,0,0,1)');
      bctx.globalCompositeOperation = 'destination-out';
      bctx.fillStyle = lat;
      bctx.fillRect(0, 0, 64, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const beamDefs = [
      { x: -0.75, w: 0.11, o: 0.34 },
      { x: -0.52, w: 0.06, o: 0.46 },
      { x: -0.36, w: 0.16, o: 0.26 },
      { x: -0.14, w: 0.08, o: 0.4 },
      { x: 0.06, w: 0.04, o: 0.5 },
      { x: 0.24, w: 0.1, o: 0.28 },
      { x: 0.45, w: 0.05, o: 0.38 },
    ];
    for (const b of beamDefs) {
      const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(b.w, 2.6),
        new THREE.MeshBasicMaterial({
          map: beamTex,
          transparent: true,
          opacity: b.o,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      // Enter at the window's top edge, stream toward ~5 o'clock: the plane
      // is oriented EXACTLY along the light vector (quaternion +Y -> -dir),
      // so its top edge sits at the entry point and its bottom dives into
      // the desk — nothing pokes above the window (no more ceiling rays).
      const ex = b.x * 0.55 - 0.1; // entry x inside the window opening
      const ey = WINDOW.cy + WINDOW.h / 2 - 0.05; // entry y (window top)
      const ez = WINDOW.z + 0.06; // just inside the glass
      const dir = new THREE.Vector3(0.41, -0.78, 0.51).normalize(); // ~5 o'clock
      const L = 1.35;
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
      beam.position.set(ex, ey, ez).addScaledVector(dir, L / 2);
      beam.scale.y = L / 2.6; // plane was 2.6 tall
      rayGroup.add(beam);
    }
    // Whole fan breathes very slowly (living light).
    rayGroup.userData.animate = (now) => {
      const k = 0.85 + Math.sin(now * 0.00035) * 0.15;
      rayGroup.children.forEach((m, i) => {
        m.material.opacity = beamDefs[i].o * k;
      });
    };
    scene.add(rayGroup);
    rayGroupRef = rayGroup;
  }

  // Data-driven layers (rebuilt on state refresh).
  const stacksLayer = new THREE.Group();
  const zoneLayer = new THREE.Group();
  const bubbleLayer = new THREE.Group(); // uniform bubble scale, never inherits pile scale
  scene.add(stacksLayer, zoneLayer, bubbleLayer);

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
    bubbleLayer.clear();
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
      const target = new THREE.Vector3(pos.x, DESK.y + DESK.h / 2 + 0.001, pos.z);
      mesh.position.copy(target);
      if (!stacksBuilt) {
        mesh.position.y = target.y + 0.15;
        moveTween(mesh, target, { duration: 1000, delay: i * 70, ease: easeOutCubic });
      }
      mesh.userData.entry = entry;
      mesh.userData.owner = mesh; // hover linkage for the bubble layer
      mesh.userData.home = target.clone();
      stacksLayer.add(mesh);
      stackMeshes.push(mesh);
      const bubble = makeBubble({ name: entry.name, icon: entry.icon ?? 'doc' });
      bubble.userData.owner = mesh;
      // Relative to the owner (it moves when dragged); animate() applies it.
      bubble.userData.offset = new THREE.Vector3(0, 0.055, 0); // sits right on the pile
      bubbleLayer.add(bubble);
      bubbles.push(bubble);
    };
    deskEntries.forEach((entry, i) => place(entry, i));
    // Shelf stacks live in vertical cardboard file boxes (STAFF-box ref,
    // D-024): white box + label plate + string tie, stack hidden inside.
    shelfEntries.forEach((entry, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const box = makeFileBox({ name: entry.name });
      box.position.set(side * (1.08 - row * 0.02), 1.1975, -0.4);
      box.rotation.y = side * -0.14;
      box.userData.entry = entry;
      box.userData.owner = box;
      box.userData.home = box.position.clone();
      stacksLayer.add(box);
      stackMeshes.push(box);
      const bubble = makeBubble({ name: entry.name, icon: entry.icon ?? 'doc' });
      bubble.userData.owner = box;
      bubble.userData.offset = new THREE.Vector3(-side * 0.12, 0.37, -0.02); // floats above, toward the window
      bubbleLayer.add(bubble);
      bubbles.push(bubble);
    });
    stacksBuilt = true;
    // QA hook (?bubbles=1): force-expand every bubble to inspect contours.
    if (new URLSearchParams(window.location.search).get('bubbles') === '1') {
      bubbles.forEach((b) => b.userData.setExpanded(true));
    }

    // Vertical file box (round 9 item 5): cardboard-white upright box,
    // label plate with ruled lines, string-tie button on the front.
    function makeFileBox({ name }) {
      const group = new THREE.Group();
      const boxMat = new THREE.MeshStandardMaterial({ color: 0xfefdfa, roughness: 0.85 });
      const W = 0.13, H = 0.185, D = 0.055;
      const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), boxMat);
      body.position.y = H / 2;
      body.geometry.computeBoundingBox();
      group.add(body, addOutline(body, { thickness: 0.003 }));
      // Lid lip (slightly wider top band, like real archive boxes).
      const lip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.006, 0.018, D + 0.006), boxMat);
      lip.position.y = H - 0.009;
      lip.geometry.computeBoundingBox();
      group.add(lip, addOutline(lip, { thickness: 0.002 }));
      // Label plate: recessed rectangle with ruled lines (canvas texture).
      const label = (() => {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 192;
        const x = c.getContext('2d');
        x.fillStyle = '#fefdfa';
        x.fillRect(0, 0, 256, 192);
        x.strokeStyle = 'rgba(74, 61, 46, 0.85)';
        x.lineWidth = 5;
        x.strokeRect(24, 24, 208, 144);
        x.lineWidth = 3;
        for (let ly = 64; ly <= 128; ly += 32) {
          x.beginPath();
          x.moveTo(48, ly);
          x.lineTo(208, ly);
          x.stroke();
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })();
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(W * 0.66, W * 0.66 * (192 / 256)),
        new THREE.MeshBasicMaterial({ map: label, toneMapped: false }),
      );
      plate.position.set(0, H * 0.52, D / 2 + 0.0005);
      group.add(plate);
      // String-tie: two tiny discs + a thread line on the front edge.
      const discMat = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.6 });
      for (const dx of [-0.03, 0.03]) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), discMat);
        disc.rotation.x = Math.PI / 2;
        disc.position.set(dx, H * 0.28, D / 2 + 0.002);
        group.add(disc);
      }
      const thread = new THREE.Mesh(
        new THREE.BoxGeometry(0.058, 0.003, 0.003),
        new THREE.MeshBasicMaterial({ color: 0xd8cfc0 }),
      );
      thread.position.set(0, H * 0.28, D / 2 + 0.004);
      group.add(thread);
      return group;
    }
  }

  function layoutZone(deskState) {
    zoneLayer.clear();
    for (let i = OUTLINE_REGISTRY.length - 1; i >= 0; i--) {
      if (!OUTLINE_REGISTRY[i].ink.parent) OUTLINE_REGISTRY.splice(i, 1); // notes re-render: drop stale hulls
    }
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
  // Ink outlines (LineSegments) and dust (Points) must never win a pick:
  // their default raycast thresholds are 1 world unit, so every ray "hits"
  // the nearest decorative edge and mirrors/wrongs the selection.
  raycaster.params.Line = { threshold: 0.0001 };
  raycaster.params.Points = { threshold: 0.0001 };
  const pointer = new THREE.Vector2();
  let downPos = null;      // {x,y,target} — target resolved on down, used on up
  let dragStack = null;    // armed only after real movement (never on click)
  let dragMoved = false;
  let dragOrigin = null;   // {x,y,z} where the carried item was grabbed
  const DRAG_THRESHOLD = 8; // px of movement before a press becomes a drag
  const setDraggingVisual = (mesh, on) => {
    mesh.userData.dragging = on;
    mesh.traverse((o) => {
      if (!o.isMesh && !o.isSprite) return;
      if (on) {
        // Clone materials for the carry: paperA/paperB are SHARED across all
        // piles — mutating them in place leaked translucency to other stacks
        // and broke restore on release. Clones guarantee clean restore.
        o.userData._origMats = o.material;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const clones = mats.map((m) => {
          const c = m.clone();
          c.transparent = true;
          c.opacity = (m.opacity ?? 1) * 0.7;
          c.depthWrite = false;
          return c;
        });
        o.material = Array.isArray(o.material) ? clones : clones[0];
      } else if (o.userData._origMats) {
        o.material = o.userData._origMats;
        delete o.userData._origMats;
      }
    });
  };
  // Fluttering corner while carrying: the curl wedge oscillates like paper
  // caught in a draft. Runs in animate() while dragStack is set.
  const flutterCurl = (now) => {
    const curl = dragStack?.userData?.curl;
    if (!curl) return;
    const a = Math.sin(now * 0.02) * 0.35 + Math.sin(now * 0.031) * 0.18;
    curl.rotation.z = curl.userData.baseRotZ + a;
    curl.rotation.x = curl.userData.baseRotX + Math.cos(now * 0.026) * 0.22;
  };
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
    let bestD = 0.12; // forgiving: any desk pile within ~1.7 grid cells
    for (const m of stackMeshes) {
      if (!m.userData?.entry) continue;
      if (m.position.z < -0.1 || m.position.z > 0.55) continue; // desk piles only
      const d = Math.hypot(m.position.x - x, m.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  };
  const dragPoint = new THREE.Vector3();
  // One authoritative pick for both drag-arm and click-open: distance-sorted
  // over stacks + zone + desk. The desk mesh BLOCKS the ray, so clicks on
  // empty wood can never fall through to wall shelves (bug: random stack).
  // Sprites (bubbles, depthTest:false) never win a pick.
  const pickNdc = (nx, ny, wantInfo = false) => {
    pointer.set(nx, ny);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster
      .intersectObjects([...stackMeshes, ...zoneLayer.children, desk], true)
      .filter((h) => !h.object.isSprite)
      .sort((a, b) => a.distance - b.distance);
    const hit = hits[0];
    if (!hit) return null;
    let obj = hit.object;
    while (obj.parent && obj.parent !== stacksLayer && obj.parent !== zoneLayer) obj = obj.parent;
    if (wantInfo) {
      return {
        name: obj.userData?.entry?.name ?? (obj.userData?.note ? 'N' : obj === desk ? 'DESK' : (obj.userData?.blank ? 'CAP' : obj.type)),
        distance: Number(hit.distance.toFixed(2)),
        point: hit.point.toArray().map((v) => Number(v.toFixed(2))),
        cam: camera.position.toArray().map((v) => Number(v.toFixed(2))),
      };
    }
    if (hit.object === desk) return null; // bare wood: nothing under pointer
    if (obj === desk || obj === scene) return null;
    return obj.userData?.entry || obj.userData?.note ? obj : null;
  };
  const pickAt = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    return pickNdc(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  };
  function onPointerDown(e) {
    if (e.pointerType === 'touch') return; // touch = camera swipes only
    const candidate = state?.enabled === false ? null : pickAt(e.clientX, e.clientY);
    downPos = { x: e.clientX, y: e.clientY, candidate };
    dragStack = null;
    dragMoved = false;
  }
  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    if (!dragStack && downPos) {
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (moved > DRAG_THRESHOLD) {
        // Re-pick NOW: zone notes are rebuilt on refresh, the down-time
        // candidate can be stale (that's how a right-side stack got grabbed
        // instead of the note). The pointer decides, not history.
        let target = downPos.candidate;
        if (target && !target.parent) target = null;
        if (!target) target = pickAt(e.clientX, e.clientY);
        downPos = null;
        if (target) {
          dragStack = target;
          dragMoved = true; // threshold crossed = definitely not a click
          dragOrigin = { x: target.position.x, y: target.position.y, z: target.position.z };
          dragStack.userData.dragging = true;
          canvas.dataset.dragging = '1';
          canvas.style.cursor = 'grabbing';
          setDraggingVisual(dragStack, true);
        }
      }
    }
    if (dragStack) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
        // Smooth follow: raw pointer position, no grid while carrying —
        // the snap to the nearest free cell happens AFTER release.
        const x = THREE.MathUtils.clamp(dragPoint.x, -0.58, 0.58);
        const z = THREE.MathUtils.clamp(dragPoint.z, -0.16, 0.58);
        const lift = dragStack.userData?.note ? 0.012 : 0;
        dragStack.position.set(x, DESK.y + DESK.h / 2 + lift, z);
        dragMoved = true;
      }
      return;
    }
    const hoverObj = pickAt(e.clientX, e.clientY);
    const hoverOwner = hoverObj?.userData?.owner; // stack/note that owns the hovered mesh
    for (const b of bubbles) b.userData.setExpanded(b.userData.owner === hoverOwner && hoverOwner);
    canvas.style.cursor = hoverObj ? 'pointer' : '';
  }
  function onPointerUp(e) {
    if (!e || typeof e.clientX !== 'number') return;
    if (dragStack) {
      const mesh = dragStack;
      const origin = dragOrigin;
      dragStack = null; // stops flutter before visual restore
      setDraggingVisual(mesh, false);
      mesh.userData.dragging = false;
      delete canvas.dataset.dragging;
      canvas.style.cursor = '';
      const settleY = DESK.y + DESK.h / 2;
      if (dragMoved) {
        const note = mesh.userData?.note;
        if (note) {
          const dropX = mesh.position.x;
          const dropZ = mesh.position.z;
          // Dropped onto a pile? Ask before filing the note into that stack.
          // Check BEFORE the snap: the free-cell resolver pushes the note
          // away from the occupied pile cell and broke targeting last round.
          const target = stackUnder(dropX, dropZ);
          if (target) {
            // Wait for the answer: cancel → glide back to the grab origin.
            mesh.position.set(dropX, settleY, dropZ);
            Promise.resolve(
              onNoteIntoStack?.(note, { name: target.userData.name, path: target.userData.entry?.path ?? target.userData.name }),
            ).then((outcome) => {
              if (outcome === false) {
                moveTween(mesh, new THREE.Vector3(origin.x, settleY, origin.z), { duration: 320, ease: easeOutCubic });
              }
            }).catch(() => {
              moveTween(mesh, new THREE.Vector3(origin.x, settleY, origin.z), { duration: 320, ease: easeOutCubic });
            });
          } else {
            const cell = nearestFreeCell(dropX, dropZ, gridOccupancy());
            moveTween(mesh, new THREE.Vector3(cell.x, settleY, cell.z), { duration: 280, ease: easeOutCubic });
            onNoteMove?.(note, { x: cell.x, z: cell.z });
          }
        } else {
          const cell = nearestFreeCell(mesh.position.x, mesh.position.z, gridOccupancy());
          moveTween(mesh, new THREE.Vector3(cell.x, settleY, cell.z), { duration: 280, ease: easeOutCubic });
          const entry = mesh.userData.entry;
          onStackMove?.(entry.path ?? 'inbox', { x: cell.x, z: cell.z });
        }
      } else if (origin) {
        // Threshold never crossed (e.g. blur synthetic) — return home.
        moveTween(mesh, new THREE.Vector3(origin.x, origin.y, origin.z), { duration: 280, ease: easeOutCubic });
      }
      dragOrigin = null;
      downPos = null;
      return;
    }
    // No drag armed: treat as a click (opens stacks/notes/capture). Same
    // authoritative pickAt as the drag arm — open exactly what the pointer
    // is on, nothing else.
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > DRAG_THRESHOLD) return; // camera swipe, not a tap
    const obj = pickAt(e.clientX, e.clientY);
    if (!obj) return;
    if (obj.userData?.note) {
      onNoteOpen?.(obj.userData.note);
    } else if (obj.userData?.blank) {
      onZoneClick?.('capture');
    } else if (obj.userData?.entry?.path) {
      onZoneClick?.('stack', obj.userData.entry);
    }
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  // Release/leave must be caught even if the pointer leaves the canvas
  // mid-drag — otherwise a carried pile stays translucent forever.
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('blur', () => {
    if (dragStack) onPointerUp({ clientX: -999, clientY: -999, pointerType: 'mouse' });
  });

  let running = true;
  let frameCount = 0;
  let lastFrameError = null;
  function animate(now) {
    if (!running) return;
    try {
      rig?.tick(now);
      updateTweens(now);
      for (const b of bubbles) {
        b.userData.tick(now);
        const owner = b.userData.owner;
        if (owner?.parent) {
          // Follow the owner with its per-bubble offset (set at build time;
          // the old hardcoded +0.21/+0.16 here used to clobber it per-frame).
          const off = b.userData.offset;
          if (off) {
            b.position.set(owner.position.x + off.x, owner.position.y + off.y, owner.position.z + off.z);
          } else {
            const shelf = !owner.userData?.entry || Math.abs(owner.position.x) > 0.7;
            b.position.set(owner.position.x, owner.position.y + (shelf ? 0.16 : 0.21), owner.position.z - (shelf ? 0.02 : 0));
          }
        }
      }
      if (dragStack) flutterCurl(now);
      dust?.userData.animate(now);
      environment?.children.forEach((o) => o.userData?.animate?.(now));
      rayGroupRef?.userData?.animate?.(now);
      updateOutlineScale(camera); // uniform screen-space stroke width
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
    debugPick: pickNdc,
    debug: () => ({
      sceneChildren: scene.children.length,
      stackMeshes: stacksLayer.children.length,
      zoneMeshes: zoneLayer.children.length,
      envChildren: environment?.children.length ?? -1,
      envZ: environment?.children.map((o) => Number(o.position.z.toFixed(1))) ?? [],
      viewMap: (() => { const v = environment?.children.find((o) => o.position.z === -1.5); const m = v?.material?.map; return m ? `${m.image?.width ?? '?'}x${m.image?.height ?? '?'}` : 'none'; })(),
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
