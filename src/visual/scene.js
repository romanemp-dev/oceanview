// Scene HOME (visual-spec §4): desk, stacks as paper piles, working zone
// (Today tray surface), environment layer. Theme presets: minimal / oceanview.
// The scene subscribes to state; it never reads files itself (D-018).
// World scale is realistic: desk ~1.4 m wide, seated camera ~0.45 m above it.
import * as THREE from '../../vendor/three/three.module.js';

// --- Layout constants (metres) ------------------------------------------
const DESK = { w: 1.4, h: 0.08, d: 1.12, y: 0.72, z: 0.28 }; // top = 0.76
const CAMERA = { x: 0, y: 1.18, z: 0.95 };
const WINDOW = { w: 1.4, h: 0.96, cy: 1.45, z: -0.62 };
const STACK_RADIUS = 0.8;
const STACK_ANGLES = Math.PI / 6; // ±30°

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

function makeSheet({ w = 0.24, h = 0.31, color = '#fdfdf8' } = {}) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function makeStackMesh({ name, count, accent = '#2f6f8f', dashed = false, overdue = false }) {
  const group = new THREE.Group();
  const sheets = Math.min(5 + (count % 3), 7);
  const paper = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
  const edgeTint = new THREE.MeshStandardMaterial({ color: '#ece8dc', roughness: 0.9 });
  for (let i = 0; i < sheets; i++) {
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.012, 0.22), i % 2 ? paper : edgeTint);
    sheet.position.set((Math.random() - 0.5) * 0.012, i * 0.0125, (Math.random() - 0.5) * 0.012);
    sheet.rotation.y = (Math.random() - 0.5) * 0.08;
    group.add(sheet);
  }
  const topY = sheets * 0.0125;

  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.002, 0.18),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: dashed ? 0.45 : 0.9 }),
  );
  ribbon.position.set(-0.065, topY + 0.002, 0);
  group.add(ribbon);

  // Flat label lying on the pile (readable when looking down at the desk).
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.038),
    new THREE.MeshBasicMaterial({ map: labelTexture(`${name} · ${count}`, { width: 512, height: 128, font: '600 56px -apple-system, sans-serif' }), transparent: true }),
  );
  label.rotation.x = -Math.PI / 2 + 0.16; // slight lean toward the viewer
  label.position.set(0, topY + 0.012, 0.07);
  group.add(label);

  if (overdue) {
    const seal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.004, 20),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 }),
    );
    seal.position.set(0.05, topY + 0.004, 0.07);
    group.add(seal);
  }

  group.userData = { name, count };
  return group;
}

function makeTaskSheet({ text, overdue }, index) {
  const group = new THREE.Group();
  const sheet = makeSheet({ w: 0.3, h: 0.12, color: overdue ? '#fdeae7' : '#ffffff' });
  group.add(sheet);
  const trimmed = text.length > 34 ? `${text.slice(0, 34)}…` : text;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.27, 0.09),
    new THREE.MeshBasicMaterial({ map: labelTexture(trimmed, { width: 512, height: 128, font: '500 34px -apple-system, sans-serif' }) }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.y = 0.002;
  group.add(label);
  group.position.set(-0.27 + (index % 3) * 0.27, 0.766, 0.5 + Math.floor(index / 3) * 0.13);
  group.rotation.y = (Math.random() - 0.5) * 0.05;
  return group;
}

export function createScene({ canvas, state, onZoneClick, config = {} }) {
  const theme = config.theme ?? 'minimal';

  const isMobile = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
    || /iPhone|iPad|Android/i.test(navigator.userAgent);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)); // DPR cap (§8)
  renderer.shadowMap.enabled = false;
  // Tier 0: filmic tone mapping — kills the flat "plastic" look.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme === 'oceanview' ? 1.12 : 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme === 'oceanview' ? 0x9ec9dd : 0xf4f6f8);
  // Subtle atmospheric depth (barely visible indoors, helps the window view).
  scene.fog = new THREE.Fog(theme === 'oceanview' ? 0xbcd4de : 0xf4f6f8, 6, 18);

  const camera = new THREE.PerspectiveCamera(55, 2, 0.02, 40);
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
  camera.lookAt(0, CAMERA.y, 0);

  // Lights: warm window light (references: sunlit anime desk).
  // Tier 0 lighting: warm key from the window + cool fill from the room.
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x5a4b3c, theme === 'oceanview' ? 0.55 : 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, theme === 'oceanview' ? 2.2 : 1.0);
  sun.position.set(-1.2, 2.4, -0.9);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd4e8, theme === 'oceanview' ? 0.35 : 0.0);
  fill.position.set(0.8, 1.4, 2.2);
  scene.add(fill);

  // Desk surface.
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(DESK.w, DESK.h, DESK.d),
    new THREE.MeshStandardMaterial({ color: 0x8f6a44, roughness: 0.7 }),
  );
  desk.position.set(0, DESK.y, DESK.z);
  scene.add(desk);

  // Environment layer (window + panorama) — the switchable oceanview layer.
  let environment = null;
  if (theme === 'oceanview') {
    environment = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(WINDOW.w + 0.06, WINDOW.h + 0.06, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.6 }),
    );
    frame.position.set(0, WINDOW.cy, WINDOW.z - 0.06);
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
      new THREE.MeshStandardMaterial({ color: 0x2e343c, roughness: 0.5, metalness: 0.3 }),
    );
    mullion.position.set(-0.32, WINDOW.cy, WINDOW.z + 0.01);
    environment.add(mullion);
    // Windowsill between the window and the desk — future trinkets area.
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(WINDOW.w + 0.04, 0.04, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x6f5540, roughness: 0.6 }),
    );
    sill.position.set(0, 0.95, -0.55);
    environment.add(sill);
    // Wall around the window (references: warm room, window pops).
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3e4a57, roughness: 0.95 });
    const wallDefs = [
      [2.4, 0.82, 0, 2.34, -0.7], // above
      [0.95, 2.2, -1.18, 1.3, -0.7], // left
      [0.95, 2.2, 1.18, 1.3, -0.7], // right
      [2.4, 0.97, 0, 0.485, -0.7], // below
    ];
    for (const [w, h, x, y, z] of wallDefs) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      wall.position.set(x, y, z);
      environment.add(wall);
    }
    // Sill trinkets: a small plant and books (POV reference).
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.028, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0xb5643c, roughness: 0.8 }),
    );
    pot.position.set(-0.55, 1.0, -0.55);
    environment.add(pot);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x4f7a4a, roughness: 0.9 }),
    );
    leaves.position.set(-0.55, 1.07, -0.55);
    environment.add(leaves);
    const book1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.02, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x8a4b3a, roughness: 0.85 }),
    );
    book1.position.set(0.5, 0.97, -0.55);
    environment.add(book1);
    const book2 = book1.clone();
    book2.position.y = 0.995;
    book2.rotation.y = 0.2;
    environment.add(book2);
    // Pen cup on the desk, left side (POV reference composition).
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.026, 0.06, 18),
      new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.7 }),
    );
    cup.position.set(-0.58, 0.79, 0.1);
    environment.add(cup);
    const penColors = [0x2f5d8a, 0xb7791f, 0x2e343c, 0x8a4b3a];
    penColors.forEach((color, i) => {
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.11, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
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

  // Data-driven layers (rebuilt on state refresh).
  const stacksLayer = new THREE.Group();
  const zoneLayer = new THREE.Group();
  scene.add(stacksLayer, zoneLayer);

  let stackMeshes = [];
  let stacksBuilt = false;

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
    const entries = [
      { name: 'Inbox', count: deskState.inboxItems.length, accent: '#8a94a0', dashed: true, path: null },
      ...deskState.stacks.map((s) => ({
        name: s.name,
        count: s.items.length,
        accent: s.accent ?? '#2f6f8f',
        overdue: s.hasOverdue,
        agents: s.agents ?? [],
        path: s.path,
      })),
    ];
    const n = entries.length;
    // Density control: more stacks → wider arc and smaller piles, so they stay
    // readable and don't overlap (single-row semicircle keeps equal reach).
    const scale = n > 8 ? 0.72 : n > 6 ? 0.82 : 1;
    const arc = n > 8 ? (42 * Math.PI) / 180 : STACK_ANGLES;
    const radius = n > 8 ? 0.85 : STACK_RADIUS;
    entries.forEach((entry, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const angle = -arc + t * 2 * arc;
      const mesh = makeStackMesh(entry);
      mesh.scale.setScalar(scale);
      const target = new THREE.Vector3(
        Math.sin(angle) * radius,
        DESK.y + DESK.h / 2,
        CAMERA.z - Math.cos(angle) * radius,
      );
      mesh.position.copy(target);
      if (!stacksBuilt) {
        mesh.position.y = target.y + 0.15;
        moveTween(mesh, target, { duration: 1000, delay: i * 70, ease: easeOutCubic });
      }
      mesh.userData.entry = entry;
      mesh.userData.home = target.clone();
      stacksLayer.add(mesh);
      stackMeshes.push(mesh);
    });
    stacksBuilt = true;
  }

  function layoutZone(deskState) {
    zoneLayer.clear();
    const all = collectTodayTasksLocal(deskState);
    const visible = all.slice(0, 5); // D-021: limit 5
    visible.forEach((task, i) => zoneLayer.add(makeTaskSheet(task, i)));
    if (all.length > 5) {
      const more = makeStackMesh({ name: `+${all.length - 5}`, count: all.length - 5, accent: '#b7791f' });
      more.scale.setScalar(0.7);
      more.position.set(0.5, DESK.y + DESK.h / 2, 0.5);
      zoneLayer.add(more);
    }
    // The always-visible blank sheet (capture entry, R-08).
    const blank = makeTaskSheet({ text: '+ New note (N)' }, 8);
    blank.position.set(0, 0.766, 0.6);
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
          if (t.due <= todayIso) out.push({ text: t.text.replace(/\s*@due\(\d{4}-\d{2}-\d{2}\)/, ''), overdue: t.due < todayIso, due: t.due });
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
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function onPointerDown(e) {
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

  let running = true;
  let frameCount = 0;
  let lastFrameError = null;
  function animate(now) {
    if (!running) return;
    try {
      rig?.tick(now);
      updateTweens(now);
      renderer.render(scene, camera);
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
      renderer.dispose();
    },
  };
}
