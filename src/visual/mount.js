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

export function mountVisualScene({ canvas, onCaptureClick, onStackMove, onNoteMove, onNoteIntoStack, onNoteOpen, onFail }) {
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
    onStackMove,
    onNoteMove,
    onNoteIntoStack,
    onNoteOpen,
    onZoneClick: (kind, entry) => {
      if (kind === 'capture') onCaptureClick?.();
      if (kind === 'stack') {
        // v1: stack click focuses the DOM desk card (overlay navigation).
        window.dispatchEvent(new CustomEvent('oceanview:focus-stack', { detail: entry }));
      }
    },
  });
  document.getElementById('scene-vignette')?.classList.add('on');
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

  // ?picktest=1: 9x6 probe grid. Every 400ms each cell calls
  // sceneHandle.debugPick(NDC) and paints the resolved stack's initial.
  let pickTimer = null;
  try {
    if (new URLSearchParams(window.location.search).get('picktest')) {
      const layer = document.createElement('div');
      layer.id = 'pick-test';
      layer.style.cssText = 'position:fixed;inset:0;z-index:9997;pointer-events:none;font:600 13px ui-monospace,monospace;';
      document.body.appendChild(layer);
      const COLS = 9;
      const ROWS = 6;
      // picktest=shot: paint once (after the scene settles) and stop — so
      // --virtual-time-budget screenshots terminate. picktest=1: continuous.
      const once = new URLSearchParams(window.location.search).get('picktest') === 'shot';
      let ticks = 0;
      pickTimer = setInterval(() => {
        if (once && ++ticks > 5) {
          clearInterval(pickTimer);
          pickTimer = null;
          return;
        }
        layer.innerHTML = '';
        const w = window.innerWidth;
        const h = window.innerHeight;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const nx = ((c + 0.5) / COLS) * 2 - 1;
            const ny = -(((r + 0.5) / ROWS) * 2 - 1);
            let name = '';
            try {
              const info = sceneHandle?.debugPick?.(nx, ny, true);
              if (info) name = `${info.name.slice(0, 3)} d${info.distance}`;
              else name = '·';
            } catch { name = 'ERR'; }
            if (!name) continue;
            const cell = document.createElement('div');
            cell.textContent = name;
            cell.style.cssText = `position:absolute;left:${(c / COLS) * w}px;top:${(r / ROWS) * h}px;width:${w / COLS}px;height:${h / ROWS}px;display:flex;align-items:center;justify-content:center;color:#ff2d55;background:rgba(255,255,255,0.25);border:1px solid rgba(255,45,85,0.35);`;
            layer.appendChild(cell);
          }
        }
      }, 400);
    }
  } catch { pickTimer = null; }

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
      if (pickTimer) clearInterval(pickTimer);
      document.getElementById('pick-test')?.remove();
      sceneHandle?.dispose();
      sceneHandle = null;
      document.getElementById('scene-vignette')?.classList.remove('on');
    },
  };
}
