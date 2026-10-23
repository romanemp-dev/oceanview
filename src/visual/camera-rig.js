// CameraRig (visual-spec §3): first-person camera with mouse input, v1.
// Input sources are pluggable (mouse | gyro | xr-head); v1 implements mouse.
// Yaw ±22°, pitch anchors (up → window, down → desk), ~12% dead zone,
// exponential lerp smoothing, welcome drift on load (interruptible).
export function createCameraRig({ camera, domElement, config = {} }) {
  const cfg = {
    yawRange: (config.yawRange ?? 15) * (Math.PI / 180),
    pitchUp: config.pitchUp ?? 0.02, // rad, looking straight into the window
    pitchRest: config.pitchRest ?? -0.18, // rad, resting POV (window + desk)
    pitchDown: config.pitchDown ?? -0.6, // rad, desk fills ~90% of the frame
    deadZone: config.deadZone ?? 0.12,
    lerp: config.lerp ?? 0.05,
    driftMs: config.driftMs ?? 1500,
    ...config,
  };

  const state = {
    targetYaw: 0,
    targetPitch: 0,
    yaw: 0,
    pitch: 0,
    driftStart: 0,
    drifting: true,
    enabled: true,
  };

  const baseQuat = camera.quaternion.clone();
  const euler = new (camera.rotation.constructor)(0, 0, 0, 'YXZ');

  function onMouseMove(e) {
    if (!state.enabled || e.pointerType === 'touch') return;
    const rect = domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1..1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1..1
    applyInput(nx, ny);
  }

  // Touch: relative swipe follows the finger (swipe right → look right).
  let touchLast = null;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  function onTouchStart(e) {
    if (e.pointerType !== 'touch') return;
    touchLast = { x: e.clientX, y: e.clientY };
    state.drifting = false;
  }
  function onTouchMove(e) {
    if (!state.enabled || e.pointerType !== 'touch' || !touchLast) return;
    const rect = domElement.getBoundingClientRect();
    const dx = (e.clientX - touchLast.x) / rect.width;
    const dy = (e.clientY - touchLast.y) / rect.height;
    touchLast = { x: e.clientX, y: e.clientY };
    state.targetYaw = clamp(state.targetYaw - dx * cfg.yawRange * 2.4, -cfg.yawRange, cfg.yawRange);
    state.targetPitch = clamp(state.targetPitch - dy * (cfg.pitchUp - cfg.pitchRest) * 1.8, cfg.pitchDown, cfg.pitchUp);
    state.drifting = false;
  }
  function onTouchEnd() {
    touchLast = null;
  }

  function applyInput(nx, ny) {
    state.drifting = false;
    // Dead zone: input within the central band maps to 0.
    const dz = cfg.deadZone;
    const dead = (v) => (Math.abs(v) <= dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz));
    state.targetYaw = -dead(nx) * cfg.yawRange;
    // Screen up (ny < 0) → look up at the window; down → look down at the desk.
    // The screen center rests at the POV composition (window top + desk bottom).
    const nyDead = dead(ny);
    state.targetPitch = nyDead < 0
      ? cfg.pitchRest + -nyDead * (cfg.pitchUp - cfg.pitchRest)
      : cfg.pitchRest - nyDead * (cfg.pitchRest - cfg.pitchDown);
  }

  function startDrift() {
    state.drifting = true;
    state.driftStart = performance.now();
    state.targetYaw = 0;
    // Drift start: looking at the window; end: the resting POV composition
    // (window top + desk bottom, per the user's POV reference).
    state.targetPitch = cfg.pitchUp;
  }

  function tick(now) {
    if (state.drifting) {
      const t = Math.min((now - state.driftStart) / cfg.driftMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      state.targetPitch = cfg.pitchUp + (cfg.pitchRest - cfg.pitchUp) * eased;
      if (t >= 1) state.drifting = false;
    }
    state.yaw += (state.targetYaw - state.yaw) * cfg.lerp;
    state.pitch += (state.targetPitch - state.pitch) * cfg.lerp;
    euler.set(state.pitch, state.yaw, 0);
    camera.quaternion.setFromEuler(euler).multiply(baseQuat);
  }

  function attach() {
    domElement.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('pointerdown', onTouchStart);
    domElement.addEventListener('pointermove', onTouchMove);
    domElement.addEventListener('pointerup', onTouchEnd);
    domElement.addEventListener('pointercancel', onTouchEnd);
    startDrift();
  }

  function detach() {
    domElement.removeEventListener('mousemove', onMouseMove);
    domElement.removeEventListener('pointerdown', onTouchStart);
    domElement.removeEventListener('pointermove', onTouchMove);
    domElement.removeEventListener('pointerup', onTouchEnd);
    domElement.removeEventListener('pointercancel', onTouchEnd);
  }

  return { tick, attach, detach, startDrift, state };
}
