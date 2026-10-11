// In-memory storage adapter — mirrors the fs-access adapter interface.
// Used by unit tests; also the basis for the browser-storage fallback.
export function memoryAdapter(initial = {}) {
  const dirs = new Set(Object.keys(initial.dirs ?? {}).map((d) => d.replace(/^\/+|\/+$/g, '')).filter(Boolean));
  const files = new Map();
  for (const [path, contents] of Object.entries(initial.files ?? {})) {
    files.set(path.replace(/^\/+/, ''), contents);
  }

  function parentOf(path) {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  }

  function assertParent(path) {
    const parent = parentOf(path);
    if (parent && !dirs.has(parent)) throw new Error(`ENOENT: ${parent}`);
  }

  return {
    kind: 'memory',
    dirs,
    files,

    async listDir(path = '') {
      const base = path.replace(/^\/+|\/+$/g, '');
      const seen = new Set();
      const entries = [];
      const prefix = base ? base + '/' : '';
      for (const dir of dirs) {
        if (base && !dir.startsWith(prefix)) continue;
        const rest = base ? dir.slice(prefix.length) : dir;
        const name = rest.split('/')[0];
        if (!name || seen.has(name)) continue;
        seen.add(name);
        entries.push({ name, kind: 'directory' });
      }
      for (const filePath of files.keys()) {
        if (base && !filePath.startsWith(prefix)) continue;
        const rest = base ? filePath.slice(prefix.length) : filePath;
        const name = rest.split('/')[0];
        if (!name || rest.includes('/') || seen.has(name)) continue;
        seen.add(name);
        entries.push({ name, kind: 'file' });
      }
      return entries;
    },

    async exists(path) {
      const p = path.replace(/^\/+/, '');
      return files.has(p) || dirs.has(p);
    },

    async readFile(path) {
      const p = path.replace(/^\/+/, '');
      if (!files.has(p)) throw new Error(`ENOENT: ${p}`);
      return files.get(p);
    },

    async writeFile(path, contents) {
      const p = path.replace(/^\/+/, '');
      assertParent(p);
      const parent = parentOf(p);
      if (parent) dirs.add(parent);
      files.set(p, contents);
    },

    async ensureDir(path) {
      const parts = path.split('/').filter(Boolean);
      let cur = '';
      for (const part of parts) {
        cur = cur ? `${cur}/${part}` : part;
        dirs.add(cur);
      }
    },

    async deleteFile(path) {
      files.delete(path.replace(/^\/+/, ''));
    },

    async deleteDir(path) {
      const p = path.replace(/^\/+|\/+$/g, '');
      for (const dir of [...dirs]) if (dir === p || dir.startsWith(p + '/')) dirs.delete(dir);
      for (const file of [...files.keys()]) if (file.startsWith(p + '/')) files.delete(file);
    },
  };
}
