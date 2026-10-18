// CameraRig (visual-spec §3): first-person camera with mouse input, v1.
// Input sources are pluggable (mouse | gyro | xr-head); v1 implements mouse.
// Yaw ±22°, pitch anchors (up → window, down → desk), ~12% dead zone,
// exponential lerp smoothing, welcome drift on load (interruptible).
export function createCameraRig({ camera, domElement, config = {} }) {
  const cfg = {
    yawRange: (config.yawRange ?? 15) * (Math.PI / 180),
    pitchUp: config.pitchUp ?? 0.13, // rad, looking straight into the window
    pitchDown: config.pitchDown ?? -0.62, // rad, desk fills ~90% of the frame
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
    if (!state.enabled) return;
    const rect = domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1..1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1..1
    applyInput(nx, ny);
  }

  function applyInput(nx, ny) {
    state.drifting = false;
    // Dead zone: input within the central band maps to 0.
    const dz = cfg.deadZone;
    const dead = (v) => (Math.abs(v) <= dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz));
    state.targetYaw = -dead(nx) * cfg.yawRange;
    // Screen up (ny < 0) → look up at the window; down → look down at the desk.
    const nyDead = dead(ny);
    state.targetPitch = nyDead < 0 ? -nyDead * cfg.pitchUp : -nyDead * Math.abs(cfg.pitchDown);
  }

  function startDrift() {
    state.drifting = true;
    state.driftStart = performance.now();
    state.targetYaw = 0;
    // Drift start: looking at the window; end: looking at the desk.
    state.targetPitch = cfg.pitchUp;
  }

  function tick(now) {
    if (state.drifting) {
      const t = Math.min((now - state.driftStart) / cfg.driftMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      state.targetPitch = cfg.pitchUp + (cfg.pitchDown - cfg.pitchUp) * eased;
      if (t >= 1) state.drifting = false;
    }
    state.yaw += (state.targetYaw - state.yaw) * cfg.lerp;
    state.pitch += (state.targetPitch - state.pitch) * cfg.lerp;
    euler.set(state.pitch, state.yaw, 0);
    camera.quaternion.setFromEuler(euler).multiply(baseQuat);
  }

  function attach() {
    domElement.addEventListener('mousemove', onMouseMove);
    startDrift();
  }

  function detach() {
    domElement.removeEventListener('mousemove', onMouseMove);
  }

  return { tick, attach, detach, startDrift, state };
}
