// External change detection (R-19).
// The desk fingerprints every item file into .desk/index.json (the derived
// cache from architecture.md). On every refresh the current files are compared
// against the index, so ANY change made outside the app is caught — by an
// agent that skipped its activity log, or by the user editing in another
// editor. Changes the app made itself are recorded into the index via write
// hooks, so they never show up as external.
import { INBOX, STACKS_DIR } from './workspace.js';

export const INDEX_PATH = '.desk/index.json';

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isTrackedPath(path) {
  return path === INBOX || path.startsWith(`${INBOX}/`) || path.startsWith(`${STACKS_DIR}/`);
}

// Scan all item files (inbox/*.md, stacks/*/*.md) → Map path -> { fp, size }.
export async function scanItemFiles(adapter) {
  const out = new Map();
  async function scanDir(dir) {
    let entries;
    try {
      entries = await adapter.listDir(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.kind !== 'file' || !e.name.endsWith('.md')) continue;
      const path = `${dir}/${e.name}`;
      const text = await adapter.readFile(path);
      out.set(path, { fp: await sha256Hex(text), size: text.length });
    }
  }
  await scanDir(INBOX);
  let stackEntries;
  try {
    stackEntries = await adapter.listDir(STACKS_DIR);
  } catch {
    stackEntries = [];
  }
  for (const e of stackEntries) {
    if (e.kind === 'directory') await scanDir(`${STACKS_DIR}/${e.name}`);
  }
  return out;
}

export async function loadIndex(adapter) {
  try {
    const idx = JSON.parse(await adapter.readFile(INDEX_PATH));
    if (idx && typeof idx === 'object' && !Array.isArray(idx)) {
      return { files: idx.files ?? {}, pending: idx.pending ?? {} };
    }
  } catch {
    // No index yet — caller builds a baseline.
  }
  return null;
}

export async function saveIndex(adapter, index) {
  await adapter.writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
}

export function buildBaselineFromScan(scan) {
  return { files: Object.fromEntries(scan), pending: {} };
}

// Latest activity entry whose `files` include the path (conventions: agents
// log workspace-relative paths; tolerate a leading ./).
function agentForPath(activityEntries, path) {
  let best = null;
  for (const e of activityEntries ?? []) {
    const files = Array.isArray(e.files) ? e.files : [];
    if (files.some((f) => String(f).replace(/^\.\//, '') === path)) {
      if (!best || String(e.ts ?? '') > String(best.ts ?? '')) best = e;
    }
  }
  return best ? String(best.agent ?? 'agent') : null;
}

// Compare a fresh scan against the index. Returns updated index (pending
// refreshed) + the current change list. Index.files is NOT updated here —
// it only moves when the app writes (hooks) or the user marks seen.
export function diffAgainstIndex(scan, index, activityEntries = []) {
  const changes = [];
  for (const [path, fp] of scan) {
    const prev = index.files[path];
    if (!prev) changes.push({ path, kind: 'added' });
    else if (prev.fp !== fp.fp) changes.push({ path, kind: 'changed' });
  }
  for (const path of Object.keys(index.files)) {
    if (!scan.has(path)) changes.push({ path, kind: 'removed' });
  }

  const pending = { ...index.pending };
  for (const ch of changes) {
    const agent = agentForPath(activityEntries, ch.path);
    const existing = pending[ch.path];
    if (existing && existing.kind === ch.kind) {
      pending[ch.path] = { ...existing, agent: agent ?? existing.agent ?? null };
    } else {
      pending[ch.path] = { kind: ch.kind, detected: new Date().toISOString(), agent };
    }
  }
  // Differences that resolved themselves (file reverted to the indexed state)
  // stop being highlighted.
  for (const path of Object.keys(pending)) {
    if (!changes.some((c) => c.path === path)) delete pending[path];
  }

  return { changes, index: { files: index.files, pending } };
}

// Hook adapters for workspace model writes (app-owned changes).
export function createIndexHooks({ getIndex, isReady, save }) {
  return {
    async onWrite(path, contents) {
      if (!isReady() || !isTrackedPath(path)) return;
      const index = getIndex();
      index.files[path] = { fp: await sha256Hex(contents), size: String(contents).length };
      delete index.pending[path];
      await save();
    },
    async onDelete(path) {
      if (!isReady() || !isTrackedPath(path)) return;
      const index = getIndex();
      delete index.files[path];
      delete index.pending[path];
      await save();
    },
  };
}

export function stackOfPath(path) {
  if (path === `${INBOX}` || path.startsWith(`${INBOX}/`)) return 'Inbox';
  const parts = path.split('/');
  return parts.length >= 2 ? parts[1] : '';
}

export function itemDirOfPath(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}
