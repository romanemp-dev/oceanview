// File System Access API storage adapter (R-01).
// Implements the uniform adapter interface consumed by domain code; the same
// interface is implemented by the in-memory adapter used in tests.
import { idbGet, idbSet, idbDelete } from './idb.js';

const HANDLE_KEY = 'workspace-handle';

export function isSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

// Must be called from a user gesture.
export async function pickWorkspace() {
  return window.showDirectoryPicker({ id: 'oceanview-workspace', mode: 'readwrite' });
}

export async function saveHandle(handle) {
  return idbSet(HANDLE_KEY, handle);
}

export async function loadSavedHandle() {
  return idbGet(HANDLE_KEY);
}

export async function forgetHandle() {
  return idbDelete(HANDLE_KEY);
}

export async function permissionState(handle) {
  return (await handle.queryPermission({ mode: 'readwrite' })) ?? 'denied';
}

// Must be called from a user gesture.
export async function requestPermission(handle) {
  return handle.requestPermission({ mode: 'readwrite' });
}

export function fsAccessAdapter(rootHandle) {
  async function dirAt(path, { create = false } = {}) {
    let dir = rootHandle;
    for (const part of path.split('/').filter(Boolean)) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
  }

  async function fileAt(path, { create = false } = {}) {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) throw new Error(`Invalid path: ${path}`);
    const dir = await dirAt(parts.join('/'), { create });
    return dir.getFileHandle(name, { create });
  }

  return {
    kind: 'fs-access',
    get name() { return rootHandle.name; },

    async listDir(path = '') {
      const dir = await dirAt(path);
      const entries = [];
      for await (const [name, handle] of dir.entries()) {
        entries.push({ name, kind: handle.kind });
      }
      return entries;
    },

    async exists(path) {
      try {
        await fileAt(path);
        return true;
      } catch {
        try {
          await dirAt(path);
          return true;
        } catch {
          return false;
        }
      }
    },

    async readFile(path) {
      const fh = await fileAt(path);
      const file = await fh.getFile();
      return file.text();
    },

    async writeFile(path, contents) {
      const fh = await fileAt(path, { create: true });
      const writable = await fh.createWritable();
      await writable.write(contents);
      await writable.close();
    },

    async ensureDir(path) {
      await dirAt(path, { create: true });
    },

    async deleteFile(path) {
      const parts = path.split('/').filter(Boolean);
      const name = parts.pop();
      const dir = await dirAt(parts.join('/'));
      await dir.removeEntry(name);
    },

    async deleteDir(path) {
      const parts = path.split('/').filter(Boolean);
      const name = parts.pop();
      const dir = await dirAt(parts.join('/'));
      await dir.removeEntry(name, { recursive: true });
    },
  };
}
