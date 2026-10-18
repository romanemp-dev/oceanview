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

export function mountVisualScene({ canvas, onCaptureClick, onFail }) {
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
  const rig = createCameraRig({ camera: sceneHandle.camera, domElement: canvas });
  sceneHandle.attachRig(rig);

  // Watchdog: if the renderer never produced a frame (GPU/rAF failure), fall
  // back to the DOM desk instead of leaving the user on a blank colored screen.
  setTimeout(() => {
    try {
      const info = sceneHandle?.debug();
      if (!info || info.frames === 0 || info.calls === 0) {
        onFail?.(info ?? null);
      }
    } catch {
      onFail?.(null);
    }
  }, 1500);
  // Dev aid: ?cam=window|mid|desk pins the camera pose for screenshots.
  const camParam = (() => {
    try {
      return new URLSearchParams(window.location.search).get('cam');
    } catch {
      return null;
    }
  })();
  if (camParam) {
    rig.state.drifting = false;
    const poses = { window: 0.02, rest: -0.18, mid: 0, desk: -0.6 };
    if (camParam in poses) {
      rig.state.targetPitch = poses[camParam];
      rig.state.pitch = poses[camParam];
    }
  }

  let debugBox = null;
  try {
    if (new URLSearchParams(window.location.search).get('debug')) {
      debugBox = document.createElement('div');
      debugBox.id = 'scene-debug';
      debugBox.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9998;background:rgba(0,0,0,.75);color:#9fe3b0;font:11px/1.4 ui-monospace,monospace;padding:8px 10px;border-radius:8px;white-space:pre;';
      document.body.appendChild(debugBox);
    }
  } catch {
    debugBox = null;
  }

  return {
    update(deskState) {
      lastDeskState = deskState;
      sceneHandle?.refresh(deskState);
      if (debugBox) {
        try {
          debugBox.textContent = JSON.stringify({
            ...sceneHandle.debug(),
            stacks: deskState.stacks.length,
            inbox: deskState.inboxItems.length,
          }, null, 1);
        } catch (e) {
          debugBox.textContent = 'debug error: ' + e.message;
        }
      }
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
