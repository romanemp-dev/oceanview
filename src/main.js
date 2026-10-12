// App state + routing between desk and item views (R-01/R-03/R-04/R-06).
import { isSupported, pickWorkspace, saveHandle, loadSavedHandle, forgetHandle, permissionState, requestPermission, fsAccessAdapter, dirHasEntries } from './core/fsaccess.js';
import { createWorkspaceModel, sanitizeDeskFolderName, INBOX, STACKS_DIR } from './core/workspace.js';
import { renderDeskView, promptName } from './ui/desk.js';
import { renderItemView } from './ui/item.js';
import { setupQuickCapture, captureItemText } from './ui/capture.js';
import { renderReviewView } from './ui/review.js';
import { readActivityEntries } from './core/activity.js';

const els = {
  status: document.getElementById('ws-status'),
  connect: document.getElementById('btn-connect'),
  restore: document.getElementById('btn-restore'),
  disconnect: document.getElementById('btn-disconnect'),
  desk: document.getElementById('desk'),
};

let adapter = null;
let ws = null;
let route = { view: 'desk' }; // {view:'desk'} | {view:'item', dir, fileName, editing}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function setStatus(text) { els.status.textContent = text; }
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderBanner(issues) {
  const old = document.getElementById('init-banner');
  if (old) old.remove();
  if (!issues.length) return;
  const banner = el('div', 'banner');
  banner.id = 'init-banner';
  const text = el('div');
  text.appendChild(el('strong', null, 'This folder does not follow the Oceanview workspace layout yet.'));
  const list = el('ul');
  for (const issue of issues) list.appendChild(el('li', null, issue.message));
  text.appendChild(list);
  const btn = el('button', 'btn primary', 'Initialize workspace');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await ws.initialize();
    await refresh();
  });
  banner.appendChild(text);
  banner.appendChild(btn);
  els.desk.before(banner);
}

async function refresh() {
  if (!ws) return;
  const { issues } = await ws.validate();
  renderBanner(issues);
  if (issues.length) {
    els.desk.innerHTML = '';
    const section = el('section', 'placeholder');
    section.appendChild(el('h1', null, 'Folder connected'));
    section.appendChild(el('p', null, 'This folder does not follow the Oceanview layout yet.'));
    els.desk.appendChild(section);
    return;
  }
  if (route.view === 'desk') await renderDesk();
  else if (route.view === 'review') await renderReview();
  else await renderItem();
}

async function renderReview() {
  els.desk.innerHTML = '';
  els.desk.appendChild(
    await renderReviewView({
      adapter,
      stackName: route.stack,
      reviewState: await ws.readReviewState(),
      handlers: {
        backToDesk: () => {
          route = { view: 'desk' };
          refresh();
        },
        markReviewed: async (key) => {
          const entries = await readActivityEntries(adapter);
          const mine = entries.filter((e) => (e.stack ?? '') === key);
          const last = mine.length ? String(mine[mine.length - 1].ts ?? '') : new Date().toISOString();
          const state = await ws.readReviewState();
          state[key] = last;
          await ws.writeReviewState(state);
          route = { view: 'desk' };
          refresh();
        },
      },
    }),
  );
}

async function renderDesk() {
  const desk = await ws.readDesk();
  // Agent activity aggregation (R-12): per-stack unreviewed change counts +
  // assigned agents (R-13, display-only).
  const [entries, reviewState, config] = await Promise.all([
    readActivityEntries(adapter),
    ws.readReviewState(),
    ws.readConfig(),
  ]);
  for (const stack of desk.stacks) {
    const key = stack.name;
    const lastReviewedTs = reviewState[key];
    stack.agentChanges = entries.filter(
      (e) => (e.stack ?? '') === key && (!lastReviewedTs || String(e.ts ?? '') > lastReviewedTs),
    ).length;
    stack.agents = config.stacks?.[key]?.agents ?? [];
  }
  els.desk.innerHTML = '';
  if (!desk.stacks.length && !desk.inboxItems.length) {
    els.desk.appendChild(buildWelcome());
    const hint = el('p', 'notice center', 'Workspace is ready. Create your first stack to start filling the desk.');
    els.desk.appendChild(hint);
    const deskView = renderDeskView({
      desk,
      handlers: deskHandlers(),
    });
    els.desk.appendChild(deskView);
    return;
  }
  els.desk.appendChild(
    renderDeskView({
      desk,
      handlers: deskHandlers(),
    }),
  );
}

function deskHandlers() {
  return {
    openItem: (dir, fileName) => {
      route = { view: 'item', dir, fileName, editing: false };
      refresh();
    },
    reviewStack: (stackName) => {
      route = { view: 'review', stack: stackName };
      refresh();
    },
    moveItemTo: async (fromDir, fileName, toDir) => {
      await ws.moveItem(fromDir, fileName, toDir);
      refresh();
    },
    createStack: async () => {
      const name = await promptName('New stack name');
      if (!name) return;
      await ws.createStack(name);
      refresh();
    },
    renameStack: async (oldName) => {
      const name = await promptName(`Rename stack “${oldName}”`, oldName);
      if (!name || name === oldName) return;
      await ws.renameStack(oldName, name);
      refresh();
    },
    deleteStack: async (name) => {
      const ok = await confirmDialog(`Delete stack “${name}”?`, 'All its items move to .desk/trash/ inside the workspace. Nothing is permanently deleted.');
      if (!ok) return;
      await ws.trashStack(name);
      refresh();
    },
    addItem: async (stackName) => {
      const title = await promptName(`New item in “${stackName}”`);
      if (!title) return;
      const type = await pickItemType();
      const fileName = await ws.createItem(`${STACKS_DIR}/${stackName}`, type, title);
      route = { view: 'item', dir: `${STACKS_DIR}/${stackName}`, fileName, editing: true };
      refresh();
    },
  };
}

function pickItemType() {
  return new Promise((resolve) => {
    const overlay = el('div', 'overlay');
    const dialog = el('div', 'dialog');
    dialog.appendChild(el('div', 'dialog-title', 'Item type'));
    const row = el('div', 'field-row');
    const note = el('button', 'btn', 'Note');
    const checklist = el('button', 'btn primary', 'Checklist');
    row.append(note, checklist);
    dialog.appendChild(row);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    note.addEventListener('click', () => { overlay.remove(); resolve('note'); });
    checklist.addEventListener('click', () => { overlay.remove(); resolve('checklist'); });
  });
}

function confirmDialog(title, text) {
  return new Promise((resolve) => {
    const overlay = el('div', 'overlay');
    const dialog = el('div', 'dialog');
    dialog.appendChild(el('div', 'dialog-title', title));
    dialog.appendChild(el('p', 'dialog-text', text));
    const row = el('div', 'field-row');
    const yes = el('button', 'btn primary', 'Delete');
    const no = el('button', 'btn', 'Cancel');
    row.append(yes, no);
    dialog.appendChild(row);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    yes.addEventListener('click', () => { overlay.remove(); resolve(true); });
    no.addEventListener('click', () => { overlay.remove(); resolve(false); });
  });
}

async function renderItem() {
  const item = await ws.readItem(route.dir, route.fileName);
  els.desk.innerHTML = '';
  els.desk.appendChild(
    renderItemView({
      item,
      editing: route.editing,
      handlers: {
        editing: route.editing,
        backToDesk: () => {
          route = { view: 'desk' };
          refresh();
        },
        toggleEdit: () => {
          route.editing = !route.editing;
          refresh();
        },
        switchType: async () => {
          item.meta.type = item.meta.type === 'checklist' ? 'note' : 'checklist';
          await ws.writeItem(route.dir, route.fileName, item.meta, item.body);
          refresh();
        },
        toggleTask: async (index, done) => {
          const body = toggleTaskLine(item.body, index, done);
          item.body = body;
          await ws.writeItem(route.dir, route.fileName, item.meta, body);
          refresh();
        },
        setTaskDue: async (index, dateIso) => {
          const body = setTaskDue(item.body, index, dateIso);
          item.body = body;
          await ws.writeItem(route.dir, route.fileName, item.meta, body);
          refresh();
        },
        save: async (title, body) => {
          item.meta.title = title || item.meta.title;
          await ws.writeItem(route.dir, route.fileName, item.meta, body);
          route.editing = false;
          refresh();
        },
        moveItem: async () => {
          const desk = await ws.readDesk();
          const options = [
            { dir: INBOX, label: 'Inbox' },
            ...desk.stacks.map((s) => ({ dir: `${STACKS_DIR}/${s.name}`, label: `Stack: ${s.name}` })),
          ].filter((o) => o.dir !== route.dir);
          if (!options.length) return;
          const target = await pickOption('Move item to…', options);
          if (!target) return;
          await ws.moveItem(route.dir, route.fileName, target.dir);
          route.dir = target.dir;
          refresh();
        },
        trashItem: async () => {
          const ok = await confirmDialog('Delete this item?', 'It moves to .desk/trash/ inside the workspace. Nothing is permanently deleted.');
          if (!ok) return;
          await ws.trashItem(route.dir, route.fileName);
          route = { view: 'desk' };
          refresh();
        },
      },
    }),
  );
}

function pickOption(title, options) {
  return new Promise((resolve) => {
    const overlay = el('div', 'overlay');
    const dialog = el('div', 'dialog');
    dialog.appendChild(el('div', 'dialog-title', title));
    for (const opt of options) {
      const b = el('button', 'btn option-row', opt.label);
      b.type = 'button';
      b.addEventListener('click', () => { overlay.remove(); resolve(opt); });
      dialog.appendChild(b);
    }
    const cancel = el('button', 'btn subtle', 'Cancel');
    cancel.addEventListener('click', () => { overlay.remove(); resolve(null); });
    dialog.appendChild(cancel);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

// ---------- onboarding (D-014) ----------

function buildWelcome() {
  const hero = el('div', 'hero');
  hero.appendChild(el('h1', null, 'Welcome to Oceanview'));
  hero.appendChild(el('p', null, 'A local-first desk for your notes, tasks and lists. Choose where it lives on your machine — your files never leave it.'));

  const options = el('div', 'options');

  const connectCard = el('button', 'option-card');
  connectCard.type = 'button';
  connectCard.innerHTML =
    '<span class="option-title">Connect workspace…</span>' +
    '<span class="option-desc">Already keep notes in a folder? Pick it — Oceanview will show its stacks and items.</span>';
  connectCard.addEventListener('click', onConnect);

  const createCard = el('button', 'option-card');
  createCard.type = 'button';
  createCard.innerHTML =
    '<span class="option-title">Create new desk…</span>' +
    '<span class="option-desc">Starting fresh? Name your desk, pick a location, and the workspace structure is set up for you.</span>';

  const form = buildCreateForm();
  createCard.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) form.querySelector('input')?.focus();
  });

  options.append(connectCard, createCard, form);
  hero.appendChild(options);
  return hero;
}

function buildCreateForm() {
  const wrap = el('div', 'option-form hidden');
  const label = el('label', null, 'Desk name');
  label.setAttribute('for', 'desk-name');
  const input = el('input', 'text');
  input.id = 'desk-name';
  input.type = 'text';
  input.placeholder = 'e.g. Work desk';
  input.maxLength = 80;
  const row = el('div', 'field-row');
  const createBtn = el('button', 'btn primary', 'Choose location & create');
  const err = el('div', 'error-text');
  createBtn.addEventListener('click', () => onCreateDesk(input, err, createBtn));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') createBtn.click(); });
  row.append(input, createBtn);
  wrap.append(label, row, err);
  return wrap;
}

async function onCreateDesk(input, err, btn) {
  err.textContent = '';
  const folderName = sanitizeDeskFolderName(input.value || 'My desk');
  btn.disabled = true;
  try {
    const parent = await pickWorkspace();
    try {
      const existing = await parent.getDirectoryHandle(folderName);
      if (await dirHasEntries(existing)) {
        err.textContent = `“${folderName}” already exists in that location and is not empty. Pick another location or name.`;
        return;
      }
    } catch {
      // Folder does not exist — proceed with creation.
    }
    const deskHandle = await parent.getDirectoryHandle(folderName, { create: true });
    await connectFlow(deskHandle);
    await ws.initialize();
    await refresh();
  } catch (e) {
    if (e?.name !== 'AbortError') {
      console.error(e);
      err.textContent = e?.message ?? String(e);
    }
  } finally {
    btn.disabled = false;
  }
}

// ---------- connection ----------

async function connectFlow(handle) {
  await saveHandle(handle);
  adapter = fsAccessAdapter(handle);
  ws = createWorkspaceModel(adapter);
  route = { view: 'desk' };
  setStatus(`Workspace: ${handle.name}`);
  show(els.disconnect);
  hide(els.connect);
  hide(els.restore);
  setupQuickCapture({
    onCapture: async (line1, line2) => {
      const { meta, body } = captureItemText(line1, line2);
      await ws.writeItem(INBOX, `${Date.now()}-capture.md`, meta, body);
      refresh();
    },
  });
  await refresh();
}

async function onConnect() {
  try {
    const handle = await pickWorkspace();
    await connectFlow(handle);
  } catch (err) {
    if (err?.name !== 'AbortError') console.error(err);
  }
}

async function onRestore() {
  const handle = await loadSavedHandle();
  if (!handle) return;
  const state = await permissionState(handle);
  if (state === 'granted') return connectFlow(handle);
  const res = await requestPermission(handle);
  if (res === 'granted') return connectFlow(handle);
}

async function onDisconnect() {
  await forgetHandle();
  adapter = null;
  ws = null;
  hide(els.disconnect);
  renderNotConnected();
}

function renderNotConnected() {
  setStatus('No workspace connected');
  hide(els.disconnect);
  els.desk.innerHTML = '';
  if (!isSupported()) {
    const section = document.createElement('section');
    section.className = 'placeholder';
    section.innerHTML = `
      <h1>Oceanview needs Chrome or Edge</h1>
      <p>This browser does not support the File System Access API, which the app
      uses to work with your local workspace folder. Please open Oceanview in
      desktop Chrome or Edge.</p>`;
    els.desk.appendChild(section);
    show(els.connect);
    els.connect.disabled = true;
    return;
  }
  els.desk.appendChild(buildWelcome());
}

async function init() {
  if (!isSupported()) {
    renderNotConnected();
    return;
  }
  const handle = await loadSavedHandle();
  if (handle) {
    const state = await permissionState(handle);
    if (state === 'granted') {
      await connectFlow(handle);
      return;
    }
    setStatus(`Last workspace: ${handle.name}`);
    show(els.restore);
    hide(els.connect);
    return;
  }
  renderNotConnected();
}

els.connect.addEventListener('click', onConnect);
els.restore.addEventListener('click', onRestore);
els.disconnect.addEventListener('click', onDisconnect);

init();
