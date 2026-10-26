// Workspace model over the storage adapter (R-02).
// Owns conventions: inbox/, stacks/<name>/, .desk/, front-matter items.
import { parseFrontMatter, serializeFrontMatter, todayIso } from './frontmatter.js';
import { parseTasks, isOverdue, isDueToday } from './tasks.js';

export const INBOX = 'inbox';
export const STACKS_DIR = 'stacks';
export const DESK_DIR = '.desk';

// Folder name for a newly created desk (D-014). OS-invalid characters are
// replaced; case and spaces are preserved.
export function sanitizeDeskFolderName(name) {
  const cleaned = name.replace(/[/\\:\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
  return cleaned || 'My desk';
}

export function scanReport(entries) {
  const names = new Set(entries.filter((e) => e.kind === 'directory').map((e) => e.name));
  const issues = [];
  if (!names.has(STACKS_DIR)) issues.push({ code: 'no-stacks-dir', message: 'Missing stacks/ folder' });
  if (!names.has(INBOX)) issues.push({ code: 'no-inbox-dir', message: 'Missing inbox/ folder' });
  if (!names.has(DESK_DIR)) issues.push({ code: 'no-desk-dir', message: 'Missing .desk/ folder' });
  return { issues };
}

export function workspaceInitPlan() {
  return [
    { dir: INBOX },
    { dir: STACKS_DIR },
    { dir: DESK_DIR },
    { dir: `${DESK_DIR}/activity` },
    { dir: `${DESK_DIR}/trash` },
    { file: `${DESK_DIR}/config.json`, contents: JSON.stringify({ version: 1, stacks: {} }, null, 2) + '\n' },
    { file: `${INBOX}/welcome.md`, contents: welcomeItem() },
  ];
}

function welcomeItem() {
  return serializeFrontMatter(
    {
      type: 'note',
      title: 'Welcome to Oceanview',
      created: todayIso(),
      updated: todayIso(),
      tags: ['meta'],
    },
    [
      'This workspace folder is your desk.',
      '',
      '## Layout',
      '',
      '- `inbox/` — unsorted items land here first',
      '- `stacks/<name>/` — one folder = one stack on the desk',
      '- `.desk/` — app state; agents append activity logs to `.desk/activity/`',
      '',
      '## Tasks',
      '',
      '- [ ] try the quick capture hotkey N',
      '- [ ] connect your AI agent (see AGENTS.md at the workspace root)',
      '',
    ].join('\n'),
  );
}

// Recursively archive a stack directory (with nested sub-stacks) into the
// trash target, preserving relative structure.
function makeArchiveStackDirRecursive(adapter, hooks) {
  return async function archive(srcDir, targetDir) {
    await adapter.ensureDir(targetDir);
    for (const entry of await adapter.listDir(srcDir)) {
      if (entry.kind === 'directory') {
        await archive(`${srcDir}/${entry.name}`, `${targetDir}/${entry.name}`);
      } else if (entry.name.endsWith('.md')) {
        const contents = await adapter.readFile(`${srcDir}/${entry.name}`);
        await adapter.writeFile(`${targetDir}/${entry.name}`, contents);
        await hooks?.onDelete?.(`${srcDir}/${entry.name}`);
      }
    }
  };
}

function uniqueName(existing, fileName) {
  if (!existing.has(fileName)) return fileName;
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : '';
  let n = 2;
  while (existing.has(`${base}-${n}${ext}`)) n++;
  return `${base}-${n}${ext}`;
}

export function createWorkspaceModel(adapter, hooks = null) {
  const archiveStackDirRecursive = makeArchiveStackDirRecursive(adapter, hooks);

  async function listStacks() {
    const entries = await adapter.listDir(STACKS_DIR);
    return entries.filter((e) => e.kind === 'directory').map((e) => e.name).sort();
  }

  async function listItemFiles(dir) {
    const entries = await adapter.listDir(dir);
    return entries
      .filter((e) => e.kind === 'file' && e.name.endsWith('.md'))
      .map((e) => e.name)
      .sort();
  }

  async function readItem(dir, fileName) {
    const path = `${dir}/${fileName}`;
    const raw = await adapter.readFile(path);
    const { meta, body } = parseFrontMatter(raw);
    return {
      path,
      dir,
      fileName,
      meta: meta ?? {},
      body,
      tasks: parseTasks(body),
    };
  }

  async function writeItem(dir, fileName, meta, body) {
    meta.updated = todayIso();
    if (!meta.created) meta.created = meta.updated;
    const path = `${dir}/${fileName}`;
    const contents = serializeFrontMatter(meta, body);
    await adapter.writeFile(path, contents);
    await hooks?.onWrite?.(path, contents);
  }

  async function readConfig() {
    try {
      return JSON.parse(await adapter.readFile(`${DESK_DIR}/config.json`));
    } catch {
      return { version: 1, stacks: {} };
    }
  }

  async function writeConfig(config) {
    await adapter.writeFile(`${DESK_DIR}/config.json`, JSON.stringify(config, null, 2) + '\n');
  }

  return {
    adapter,

    async validate() {
      const entries = await adapter.listDir('');
      return scanReport(entries);
    },

    async initialize() {
      for (const step of workspaceInitPlan()) {
        if (step.dir) await adapter.ensureDir(step.dir);
        if (step.file) await adapter.writeFile(step.file, step.contents);
      }
    },

    // Soft delete (D-015): items and stacks move to .desk/trash/<stamp>/ with
    // an _origin.json manifest so they can be restored.
    async trashItem(dir, fileName) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const target = `${DESK_DIR}/trash/${stamp}`;
      await adapter.ensureDir(target);
      const contents = await adapter.readFile(`${dir}/${fileName}`);
      await adapter.writeFile(`${target}/${fileName}`, contents);
      await adapter.writeFile(`${target}/_origin.json`, JSON.stringify({ kind: 'item', dir, fileName }, null, 2) + '\n');
      await adapter.deleteFile(`${dir}/${fileName}`);
      await hooks?.onDelete?.(`${dir}/${fileName}`);
    },

    async trashStack(name) {
      // name may be a nested path: 'Work/Client X'. Directories under it move
      // to trash recursively (adapter.deleteDir handles nesting on restore of
      // flat files; nested sub-stack files are preserved with their relative
      // paths in the trash folder).
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const base = String(name).split('/').pop();
      const target = `${DESK_DIR}/trash/${stamp}-${base}`;
      await archiveStackDirRecursive(`${STACKS_DIR}/${name}`, target);      await adapter.writeFile(`${target}/_origin.json`, JSON.stringify({ kind: 'stack', name }, null, 2) + '\n');
      await adapter.deleteDir(`${STACKS_DIR}/${name}`);
      const config = await readConfig();
      delete config.stacks?.[name];
      await writeConfig(config);
    },

    async listTrash() {
      let entries;
      try {
        entries = await adapter.listDir(`${DESK_DIR}/trash`);
      } catch {
        return [];
      }
      const out = [];
      for (const e of entries.filter((x) => x.kind === 'directory')) {
        let origin = null;
        try {
          origin = JSON.parse(await adapter.readFile(`${DESK_DIR}/trash/${e.name}/_origin.json`));
        } catch {
          // Legacy entry without a manifest — restore defaults to inbox/.
        }
        const files = (await adapter.listDir(`${DESK_DIR}/trash/${e.name}`))
          .filter((f) => f.kind === 'file' && f.name.endsWith('.md'))
          .map((f) => f.name);
        out.push({ dirName: e.name, origin, files });
      }
      return out;
    },

    async restoreTrashEntry(dirName) {
      let origin = null;
      try {
        origin = JSON.parse(await adapter.readFile(`${DESK_DIR}/trash/${dirName}/_origin.json`));
      } catch {
        // Legacy entry — restore to inbox.
      }
      const files = (await adapter.listDir(`${DESK_DIR}/trash/${dirName}`))
        .filter((f) => f.kind === 'file' && f.name.endsWith('.md'))
        .map((f) => f.name);
      const targetDir = origin?.kind === 'stack'
        ? `${STACKS_DIR}/${origin.name}`
        : origin?.dir && (origin.dir === INBOX || origin.dir.startsWith(`${STACKS_DIR}/`))
          ? origin.dir
          : INBOX;
      await adapter.ensureDir(targetDir);
      const existing = new Set((await adapter.listDir(targetDir)).map((x) => x.name));
      for (const f of files) {
        const name = uniqueName(existing, f);
        const contents = await adapter.readFile(`${DESK_DIR}/trash/${dirName}/${f}`);
        await adapter.writeFile(`${targetDir}/${name}`, contents);
        await hooks?.onWrite?.(`${targetDir}/${name}`, contents);
        existing.add(name);
      }
      if (origin?.kind === 'stack') {
        const config = await readConfig();
        config.stacks = config.stacks ?? {};
        if (!config.stacks[origin.name]) {
          config.stacks[origin.name] = {};
          await writeConfig(config);
        }
      }
      await adapter.deleteDir(`${DESK_DIR}/trash/${dirName}`);
    },

    async purgeTrashEntry(dirName) {
      await adapter.deleteDir(`${DESK_DIR}/trash/${dirName}`);
    },

    async setStackAgents(name, agents) {
      const config = await readConfig();
      config.stacks = config.stacks ?? {};
      config.stacks[name] = config.stacks[name] ?? {};
      if (agents.length) config.stacks[name].agents = agents;
      else delete config.stacks[name].agents;
      await writeConfig(config);
    },

    listStacks,

    async readDesk(path = '') {
      // Nested stacks (Wave 6): stacks may contain sub-stacks (folders) at any
      // depth. readDesk() returns one level; the UI navigates like a folder tree.
      const clean = String(path).replace(/^\/+|\/+$/g, '');
      const base = clean ? `${STACKS_DIR}/${clean}` : STACKS_DIR;
      const entries = await adapter.listDir(base);
      const stacks = [];
      for (const e of entries.filter((x) => x.kind === 'directory').map((x) => x.name).sort()) {
        const relPath = clean ? `${clean}/${e}` : e;
        const dir = `${base}/${e}`;
        const files = await listItemFiles(dir);
        const items = [];
        for (const f of files) {
          const item = await readItem(dir, f);
          const today = todayIso();
          item.hasOverdue = item.tasks.some((t) => !t.done && isOverdue(t.due, today));
          item.hasDueToday = item.tasks.some((t) => !t.done && isDueToday(t.due, today));
          items.push(item);
        }
        // Sub-stacks of this stack (children only).
        const subEntries = await adapter.listDir(dir);
        const subStacks = subEntries.filter((x) => x.kind === 'directory').map((x) => x.name).sort();
        stacks.push({
          name: e,
          path: relPath,
          depth: relPath.split('/').length - 1,
          items,
          subStacks,
          hasOverdue: items.some((i) => i.hasOverdue),
          hasDueToday: items.some((i) => i.hasDueToday),
        });
      }

      const inboxFiles = await listItemFiles(INBOX);
      const inboxItems = [];
      for (const f of inboxFiles) inboxItems.push(await readItem(INBOX, f));

      return { stacks, inboxItems, stackPath: clean, config: await readConfig() };
    },

    readItem,
    writeItem,

    async createStack(name, parentPath = '') {
      if (!/^[^/\\]+$/.test(name)) throw new Error(`Invalid stack name: ${name}`);
      const parent = String(parentPath).replace(/^\/+|\/+$/g, '');
      const rel = parent ? `${parent}/${name}` : name;
      await adapter.ensureDir(`${STACKS_DIR}/${rel}`);
      const config = await readConfig();
      config.stacks = config.stacks ?? {};
      if (!config.stacks[rel]) config.stacks[rel] = {};
      await writeConfig(config);
      return rel;
    },

    async deleteStack(name) {
      await adapter.deleteDir?.(`${STACKS_DIR}/${name}`);
    },

    async createItem(dir, type, title) {
      const today = todayIso();
      const meta = { type, title, created: today, updated: today, tags: [] };
      const body = type === 'checklist' ? '- [ ] ' : '';
      const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
      const files = new Set((await adapter.listDir(dir)).filter((e) => e.kind === 'file').map((e) => e.name));
      let fileName = `${base}.md`;
      let n = 2;
      while (files.has(fileName)) {
        fileName = `${base}-${n}.md`;
        n++;
      }
      await writeItem(dir, fileName, meta, body);
      return fileName;
    },

    async renameStack(oldName, newName) {
      if (!/^[^/\\]+$/.test(newName)) throw new Error(`Invalid stack name: ${newName}`);
      if (newName === oldName) return;
      const entries = await adapter.listDir(`${STACKS_DIR}/${oldName}`);
      await adapter.ensureDir(`${STACKS_DIR}/${newName}`);
      for (const entry of entries) {
        if (entry.kind !== 'file') continue;
        const contents = await adapter.readFile(`${STACKS_DIR}/${oldName}/${entry.name}`);
        await adapter.writeFile(`${STACKS_DIR}/${newName}/${entry.name}`, contents);
        await hooks?.onWrite?.(`${STACKS_DIR}/${newName}/${entry.name}`, contents);
        await hooks?.onDelete?.(`${STACKS_DIR}/${oldName}/${entry.name}`);
      }
      await adapter.deleteDir(`${STACKS_DIR}/${oldName}`);
      const config = await readConfig();
      config.stacks = config.stacks ?? {};
      if (config.stacks[oldName]) {
        config.stacks[newName] = config.stacks[oldName];
        delete config.stacks[oldName];
      }
      await writeConfig(config);
    },

    async moveItem(fromDir, fileName, toDir) {
      const raw = await adapter.readFile(`${fromDir}/${fileName}`);
      await adapter.writeFile(`${toDir}/${fileName}`, raw);
      await adapter.deleteFile?.(`${fromDir}/${fileName}`);
      await hooks?.onWrite?.(`${toDir}/${fileName}`, raw);
      await hooks?.onDelete?.(`${fromDir}/${fileName}`);
      return `${toDir}/${fileName}`;
    },

    readConfig,
    writeConfig,

    // Reviewed-state per stack lives in .desk/review-state.json:
    // { "<stack>": "<last reviewed activity ts>" }. Inbox uses "inbox".
    async readReviewState() {
      try {
        return JSON.parse(await adapter.readFile(`${DESK_DIR}/review-state.json`));
      } catch {
        return {};
      }
    },

    async writeReviewState(state) {
      await adapter.writeFile(`${DESK_DIR}/review-state.json`, JSON.stringify(state, null, 2) + '\n');
    },
  };
}
