// App state + rendering (R-01).
import { isSupported, pickWorkspace, saveHandle, loadSavedHandle, forgetHandle, permissionState, requestPermission, fsAccessAdapter, dirHasEntries } from './core/fsaccess.js';
import { createWorkspaceModel, sanitizeDeskFolderName } from './core/workspace.js';

const els = {
  status: document.getElementById('ws-status'),
  connect: document.getElementById('btn-connect'),
  restore: document.getElementById('btn-restore'),
  disconnect: document.getElementById('btn-disconnect'),
  desk: document.getElementById('desk'),
};

let adapter = null;
let ws = null;

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function setStatus(text) { els.status.textContent = text; }

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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Two-path onboarding (D-014): connect an existing folder or create a new desk.
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

function badge(text, cls = 'badge') {
  return el('span', cls, text);
}

function renderDesk(desk) {
  els.desk.innerHTML = '';
  const grid = el('div', 'grid');

  // Inbox card.
  const inbox = el('section', 'card');
  const inboxTitle = el('h3', null, 'Inbox');
  if (desk.inboxItems.length) inboxTitle.appendChild(badge(String(desk.inboxItems.length)));
  inbox.appendChild(inboxTitle);
  inbox.appendChild(el('div', 'count', `${desk.inboxItems.length} unsorted item(s)`));
  for (const item of desk.inboxItems.slice(0, 5)) {
    inbox.appendChild(el('div', 'item-line', item.meta.title ?? item.fileName));
  }
  if (desk.inboxItems.length > 5) {
    inbox.appendChild(el('div', 'notice', `…and ${desk.inboxItems.length - 5} more`));
  }
  grid.appendChild(inbox);

  // Stack cards.
  for (const stack of desk.stacks) {
    const card = el('section', 'card');
    const title = el('h3', null, stack.name);
    if (stack.hasOverdue) title.appendChild(badge('overdue', 'pill overdue'));
    else if (stack.hasDueToday) title.appendChild(badge('due today', 'pill today'));
    card.appendChild(title);
    card.appendChild(el('div', 'count', `${stack.items.length} item(s)`));
    for (const item of stack.items.slice(0, 5)) {
      card.appendChild(el('div', 'item-line', item.meta.title ?? item.fileName));
    }
    if (stack.items.length > 5) {
      card.appendChild(el('div', 'notice', `…and ${stack.items.length - 5} more`));
    }
    grid.appendChild(card);
  }

  els.desk.appendChild(grid);
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
  const desk = await ws.readDesk();
  renderDesk(desk);
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

async function connectFlow(handle) {
  await saveHandle(handle);
  adapter = fsAccessAdapter(handle);
  ws = createWorkspaceModel(adapter);
  setStatus(`Workspace: ${handle.name}`);
  show(els.disconnect);
  hide(els.connect);
  hide(els.restore);
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
