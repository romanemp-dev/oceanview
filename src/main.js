// App state + rendering (R-01).
import { isSupported, pickWorkspace, saveHandle, loadSavedHandle, forgetHandle, permissionState, requestPermission, fsAccessAdapter } from './core/fsaccess.js';
import { createWorkspaceModel } from './core/workspace.js';

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
  const section = document.createElement('section');
  section.className = 'placeholder';
  if (!isSupported()) {
    section.innerHTML = `
      <h1>Oceanview needs Chrome or Edge</h1>
      <p>This browser does not support the File System Access API, which the app
      uses to work with your local folder. Open Oceanview in desktop Chrome/Edge,
      or serve the app and use the browser-storage fallback (coming in R-02).</p>`;
    show(els.connect);
    els.connect.disabled = true;
    return;
  }
  section.innerHTML = `
    <h1>Your desk is empty</h1>
    <p>Connect a local folder to use as your workspace. Your files stay on your machine.</p>`;
  show(els.connect);
  els.connect.disabled = false;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function badge(text, cls = 'badge') {
  const b = el('span', cls, text);
  return b;
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
