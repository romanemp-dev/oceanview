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
    { file: `${STACKS_DIR}/welcome.md`, contents: welcomeItem() },
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
      '- [ ] try the quick capture hotkey @due(' + todayIso() + ')',
      '- [ ] connect your AI agent (see docs/workspace-conventions.md)',
      '',
    ].join('\n'),
  );
}

export function createWorkspaceModel(adapter) {
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
    await adapter.writeFile(`${dir}/${fileName}`, serializeFrontMatter(meta, body));
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

    // Soft delete (D-015): items and stacks move to .desk/trash/<timestamp>/.
    // Nothing is permanently deleted in v1.
    async trashItem(dir, fileName) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const target = `${DESK_DIR}/trash/${stamp}`;
      await adapter.ensureDir(target);
      await adapter.writeFile(`${target}/${fileName}`, await adapter.readFile(`${dir}/${fileName}`));
      await adapter.deleteFile(`${dir}/${fileName}`);
    },

    async trashStack(name) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const target = `${DESK_DIR}/trash/${stamp}-${name}`;
      const entries = await adapter.listDir(`${STACKS_DIR}/${name}`);
      await adapter.ensureDir(target);
      for (const entry of entries) {
        if (entry.kind !== 'file') continue;
        await adapter.writeFile(`${target}/${entry.name}`, await adapter.readFile(`${STACKS_DIR}/${name}/${entry.name}`));
      }
      await adapter.deleteDir(`${STACKS_DIR}/${name}`);
      const config = await readConfig();
      delete config.stacks?.[name];
      await writeConfig(config);
    },

    listStacks,

    async readDesk() {
      const stacks = [];
      for (const name of await listStacks()) {
        const files = await listItemFiles(`${STACKS_DIR}/${name}`);
        const items = [];
        for (const f of files) {
          const item = await readItem(`${STACKS_DIR}/${name}`, f);
          const today = todayIso();
          item.hasOverdue = item.tasks.some((t) => !t.done && isOverdue(t.due, today));
          item.hasDueToday = item.tasks.some((t) => !t.done && isDueToday(t.due, today));
          items.push(item);
        }
        stacks.push({
          name,
          items,
          hasOverdue: items.some((i) => i.hasOverdue),
          hasDueToday: items.some((i) => i.hasDueToday),
        });
      }

      const inboxFiles = await listItemFiles(INBOX);
      const inboxItems = [];
      for (const f of inboxFiles) inboxItems.push(await readItem(INBOX, f));

      return { stacks, inboxItems };
    },

    readItem,
    writeItem,

    async createStack(name) {
      if (!/^[^/\\]+$/.test(name)) throw new Error(`Invalid stack name: ${name}`);
      await adapter.ensureDir(`${STACKS_DIR}/${name}`);
      const config = await readConfig();
      config.stacks = config.stacks ?? {};
      if (!config.stacks[name]) config.stacks[name] = {};
      await writeConfig(config);
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
        await adapter.writeFile(
          `${STACKS_DIR}/${newName}/${entry.name}`,
          await adapter.readFile(`${STACKS_DIR}/${oldName}/${entry.name}`),
        );
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
