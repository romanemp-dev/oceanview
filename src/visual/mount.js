// Visual scene bootstrap (Wave 7): mounts the 3D desk as the HOME state and
// keeps the DOM overlay as the editing layer (D-018). The scene subscribes to
// desk state; it never reads files itself.
import { createScene } from './scene.js';
import { createCameraRig } from './camera-rig.js';

let lastDeskState = null;
let sceneHandle = null;

// Toggle via localStorage: oceanview-visual = {"theme":"oceanview"} |
// {"theme":"minimal"} | remove key to keep the DOM desk as primary UI.
export function visualEnabled() {
  try {
    return window.localStorage.getItem('oceanview-visual') !== null;
  } catch {
    return false;
  }
}

export function mountVisualScene({ canvas, onCaptureClick }) {
  let cfg = {};
  try {
    cfg = JSON.parse(window.localStorage.getItem('oceanview-visual') ?? '{}');
  } catch {
    cfg = {};
  }
  const theme = cfg.theme ?? 'minimal';

  sceneHandle = createScene({
    canvas,
    config: { theme },
    onZoneClick: (kind, entry) => {
      if (kind === 'capture') onCaptureClick?.();
      if (kind === 'stack') {
        // v1: stack click focuses the DOM desk card (overlay navigation).
        window.dispatchEvent(new CustomEvent('oceanview:focus-stack', { detail: entry }));
      }
    },
  });
  sceneHandle.attachRig(createCameraRig({ camera: sceneHandle.camera, domElement: canvas }));

  return {
    update(deskState) {
      lastDeskState = deskState;
      sceneHandle?.refresh(deskState);
    },
    flyNote(stackName) {
      sceneHandle?.flyNote(stackName);
    },
    dispose() {
      sceneHandle?.dispose();
      sceneHandle = null;
    },
  };
}
