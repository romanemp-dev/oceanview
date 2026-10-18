// Scene HOME (visual-spec §4): desk, stacks as paper piles, working zone
// (Today tray surface), environment layer. Theme presets: minimal / oceanview.
// The scene subscribes to state; it never reads files itself (D-018).
import * as THREE from '../../vendor/three/three.module.js';

function labelTexture(text, { width = 256, height = 96, bg = 'rgba(255,255,255,0.92)', color = '#1f2933', font = '600 44px -apple-system, sans-serif' } = {}) {
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

function makeSheet({ w = 1, h = 1.35, color = '#fdfdf8' } = {}) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function makeStackMesh({ name, count, accent = '#2f6f8f', dashed = false, overdue = false }) {
  const group = new THREE.Group();
  const sheets = Math.min(5 + (count % 3), 7);
  for (let i = 0; i < sheets; i++) {
    const sheet = makeSheet();
    sheet.position.set((Math.random() - 0.5) * 0.08, i * 0.02, (Math.random() - 0.5) * 0.08);
    sheet.rotation.y = (Math.random() - 0.5) * 0.12;
    group.add(sheet);
  }
  // Ribbon (accent stripe) on top sheet.
  const ribbonGeo = new THREE.PlaneGeometry(0.16, 1.35);
  const ribbonMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(accent),
    transparent: true,
    opacity: 0.85,
  });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.rotation.x = -Math.PI / 2;
  ribbon.position.set(-0.32, sheets * 0.02 + 0.005, 0);
  if (dashed) ribbon.material.opacity = 0.45; // inbox: dashed = lighter
  group.add(ribbon);

  // Counter label.
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.34),
    new THREE.MeshBasicMaterial({ map: labelTexture(`${name} · ${count}`), transparent: false }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, sheets * 0.02 + 0.01, 0.95);
  group.add(label);

  if (overdue) {
    // Red wax-seal hint (R-11): small red disc on the corner.
    const seal = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 24),
      new THREE.MeshBasicMaterial({ color: 0xc0392b }),
    );
    seal.rotation.x = -Math.PI / 2;
    seal.position.set(0.38, sheets * 0.02 + 0.008, -0.5);
    group.add(seal);
  }

  group.userData = { name, count };
  return group;
}

function makeTaskSheet({ text, overdue }, index) {
  const group = new THREE.Group();
  const sheet = makeSheet({ w: 1.15, h: 0.5, color: overdue ? '#fdeae7' : '#ffffff' });
  group.add(sheet);
  const trimmed = text.length > 42 ? `${text.slice(0, 42)}…` : text;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 0.4),
    new THREE.MeshBasicMaterial({ map: labelTexture(trimmed, { width: 512, height: 128, font: '500 40px -apple-system, sans-serif' }) }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.y = 0.005;
  group.add(label);
  group.position.set(-1.1 + (index % 3) * 1.1, 0.766, 1.15 + Math.floor(index / 3) * 0.5);
  group.rotation.y = (Math.random() - 0.5) * 0.06;
  return group;
}

export function createScene({ canvas, state, onZoneClick, config = {} }) {
  const theme = config.theme ?? 'minimal';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap (§8)
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme === 'oceanview' ? 0x9ec9dd : 0xf4f6f8);

  const camera = new THREE.PerspectiveCamera(55, 2, 0.1, 60);
  camera.position.set(0, 1.6, 2.45); // higher seated eye height, desk reaches the viewer
  camera.lookAt(0, 0.85, 0.2);

  // Lights: warm window light (references: sunlit anime desk).
  const hemi = new THREE.HemisphereLight(0xfff2e0, 0x6b5a48, theme === 'oceanview' ? 1.0 : 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c0, theme === 'oceanview' ? 1.7 : 0.9);
  sun.position.set(-2.5, 3, -1.5); // from the window
  scene.add(sun);

  // Desk surface: deeper so it reaches the viewer at the bottom camera anchor.
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.08, 3.4),
    new THREE.MeshStandardMaterial({ color: 0xb28a5f, roughness: 0.7 }),
  );
  desk.position.set(0, 0.72, 0.55);
  scene.add(desk);

  // Environment layer (window + panorama) — the switchable oceanview layer.
  let environment = null;
  let viewMesh = null;
  if (theme === 'oceanview') {
    environment = new THREE.Group();
    // Large window, roughly desk-width and taller (visual-spec §4).
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 3.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.6 }),
    );
    frame.position.set(0, 2.05, -1.26);
    environment.add(frame);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.9),
      new THREE.MeshBasicMaterial({ color: 0xbfe2ef }),
    );
    glass.position.set(0, 2.05, -1.2);
    environment.add(glass);
    // Window mullion, like the POV reference (left sash seam).
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 2.9, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x2e343c, roughness: 0.5, metalness: 0.3 }),
    );
    mullion.position.set(-0.95, 2.05, -1.17);
    environment.add(mullion);
    // Windowsill between the window and the desk — future trinkets area.
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(4.3, 0.1, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x6f5540, roughness: 0.6 }),
    );
    sill.position.set(0, 0.9, -1.03);
    environment.add(sill);
    // Wall around the window (references: warm room, window pops).
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x37424e, roughness: 0.95 });
    const wallDefs = [
      [7.2, 1.2, 0, 4.05, -1.32],
      [1.5, 3.6, -2.85, 2.0, -1.32],
      [1.5, 3.6, 2.85, 2.0, -1.32],
      [7.2, 0.62, 0, 0.29, -1.32],
    ];
    for (const [w, h, x, y, z] of wallDefs) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      wall.position.set(x, y, z);
      environment.add(wall);
    }
    // Sill trinkets: a small plant, books and a pen cup (POV reference).
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.07, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0xb5643c, roughness: 0.8 }),
    );
    pot.position.set(-1.6, 1.01, -1.03);
    environment.add(pot);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x4f7a4a, roughness: 0.9 }),
    );
    leaves.position.set(-1.6, 1.19, -1.03);
    environment.add(leaves);
    const book1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.05, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x8a4b3a, roughness: 0.85 }),
    );
    book1.position.set(1.5, 0.98, -1.03);
    environment.add(book1);
    const book2 = book1.clone();
    book2.position.y = 1.03;
    book2.rotation.y = 0.2;
    environment.add(book2);

    // Pen cup on the desk, left side (POV reference composition).
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.075, 0.16, 18),
      new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.7 }),
    );
    cup.position.set(-1.72, 0.84, 0.5);
    environment.add(cup);
    const penColors = [0x2f5d8a, 0xb7791f, 0x2e343c, 0x8a4b3a];
    penColors.forEach((color, i) => {
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
      );
      pen.position.set(-1.72 + (i - 1.5) * 0.035, 0.95, 0.5 + (i % 2) * 0.03);
      pen.rotation.z = (i - 1.5) * 0.08;
      pen.rotation.x = (i % 2 ? 0.06 : -0.05);
      environment.add(pen);
    });
    // Placeholder panorama gradient (A0 track replaces this with a real image).
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
      new THREE.PlaneGeometry(4.2, 2.9),
      new THREE.MeshBasicMaterial({ map: skyTex }),
    );
    view.position.set(0, 2.05, -1.19);
    environment.add(view);
    viewMesh = view;

    // A0: real panorama from the user's reference (assets/panorama/bay-view.jpg).
    new THREE.TextureLoader().load('assets/panorama/bay-view.jpg', (tex) => {
      const imgAspect = tex.image.width / tex.image.height;
      const planeAspect = 4.2 / 2.9;
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
    // Semicircle around the viewer (equal reach for left/right/center stacks).
    const radius = 1.55;
    const maxAngle = Math.PI / 3; // ±60°
    entries.forEach((entry, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const angle = -maxAngle + t * 2 * maxAngle;
      const mesh = makeStackMesh(entry);
      const target = new THREE.Vector3(
        Math.sin(angle) * radius,
        0.76,
        2.45 - Math.cos(angle) * radius,
      );
      mesh.position.copy(target);
      // First build: stacks float in and settle (assembly animation §6).
      if (!stacksBuilt) {
        mesh.position.y = target.y + 0.45;
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
      more.position.set(1.6, 0.76, 1.0);
      zoneLayer.add(more);
    }
    // The always-visible blank sheet (capture entry, R-08).
    const blank = makeTaskSheet({ text: '+ New note (N)' }, 8);
    blank.position.set(0, 0.766, 1.95);
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

  // Picking (stack click → future navigation; blank sheet → capture).
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
    while (obj.parent && obj.parent.type !== 'Scene' && obj.parent !== zoneLayer) obj = obj.parent;
    if (obj.userData?.blank) onZoneClick?.('capture');
    else if (obj.userData?.entry?.path) onZoneClick?.('stack', obj.userData.entry);
  }
  canvas.addEventListener('pointerdown', onPointerDown);

  // Note flight (visual-spec §6): a sheet arcs from the working zone to a stack.
  function flyNote(stackName) {
    const target = stackMeshes.find((m) => m.userData.entry?.name === stackName);
    if (!target) return;
    const sheet = makeSheet({ w: 0.3, h: 0.4, color: '#ffffff' });
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(0, 0.78, 1.9);
    scene.add(sheet);
    const dest = target.position.clone();
    dest.y = 0.9;
    moveTween(sheet, dest, {
      duration: 750,
      ease: easeInOutCubic,
      lift: 0.55,
      onDone: () => scene.remove(sheet),
    });
    // Small pulse on the receiving stack.
    const home = target.userData.home?.clone() ?? target.position.clone();
    moveTween(target, home.clone().setY(home.y + 0.06), { duration: 180, ease: easeOutCubic });
    setTimeout(() => moveTween(target, home, { duration: 260, ease: easeInOutCubic }), 200);
  }

  let running = true;
  function animate(now) {
    if (!running) return;
    rig?.tick(now);
    updateTweens(now);
    renderer.render(scene, camera);
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
    dispose() {
      running = false;
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
    },
  };
}
