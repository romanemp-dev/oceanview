// Desk view: stack cards with CRUD, inbox card, item rendering (R-03/R-04).
import { INBOX, STACKS_DIR } from '../core/workspace.js';
import { suggestStacks } from '../core/placement.js';
import { renderTodayTray } from './today.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function badge(text, cls = 'badge') {
  return el('span', cls, text);
}

function actionButton(text, title, onClick, cls = 'btn subtle small') {
  const b = el('button', cls, text);
  b.type = 'button';
  b.title = title;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

export function renderDeskView({ desk, handlers }) {
  const root = el('div');
  root.appendChild(renderTodayTray({ desk, handlers }));
  const grid = el('div', 'grid');

  // Inbox card.
  const inbox = el('section', 'card');
  const inboxTitle = el('h3', null, 'Inbox');
  if (desk.inboxItems.length) inboxTitle.appendChild(badge(String(desk.inboxItems.length)));
  inbox.appendChild(inboxTitle);
  inbox.appendChild(el('div', 'count', `${desk.inboxItems.length} unsorted item(s)`));
  for (const item of desk.inboxItems.slice(0, 5)) {
    const line = el('div', 'inbox-entry');
    const title = el('div', 'item-line clickable', item.meta.title ?? item.fileName);
    title.addEventListener('click', () => handlers.openItem(INBOX, item.fileName));
    line.appendChild(title);
    const suggestions = suggestStacks(item, desk);
    if (suggestions.length) {
      const row = el('div', 'suggest-row');
      row.appendChild(el('span', 'suggest-label', '→'));
      for (const s of suggestions) {
        const btn = el('button', 'btn small suggest', s.stack);
        btn.type = 'button';
        btn.title = s.reason ? `Because: ${s.reason}` : 'Suggested';
        btn.addEventListener('click', () => handlers.moveItemTo(INBOX, item.fileName, `stacks/${s.stack}`));
        row.appendChild(btn);
      }
      line.appendChild(row);
    }
    inbox.appendChild(line);
  }
  if (desk.inboxItems.length > 5) {
    inbox.appendChild(el('div', 'notice', `…and ${desk.inboxItems.length - 5} more`));
  }
  grid.appendChild(inbox);

  // Stack cards.
  for (const stack of desk.stacks) {
    const card = el('section', 'card');
    const title = el('h3');
    title.appendChild(el('span', 'stack-name', stack.name));
    if (stack.hasOverdue) title.appendChild(badge('overdue', 'pill overdue'));
    else if (stack.hasDueToday) title.appendChild(badge('due today', 'pill today'));
    if (stack.agentChanges) {
      const marker = el('button', 'agent-marker', `⬡ ${stack.agentChanges} agent change${stack.agentChanges > 1 ? 's' : ''}`);
      marker.type = 'button';
      marker.title = 'Review agent activity';
      marker.addEventListener('click', () => handlers.reviewStack(stack.name));
      title.appendChild(marker);
    }
    const agents = stack.agents ?? [];
    if (agents.length) {
      title.appendChild(el('span', 'agent-chip', `⚑ ${agents.join(', ')}`));
    }
    title.appendChild(actionButton('✎', `Rename stack “${stack.name}”`, () => handlers.renameStack(stack.name)));
    title.appendChild(actionButton('🗑', `Delete stack “${stack.name}” (moves files to .desk/trash)`, () => handlers.deleteStack(stack.name)));
    card.appendChild(title);
    card.appendChild(el('div', 'count', `${stack.items.length} item(s)`));
    for (const item of stack.items.slice(0, 5)) {
      const line = el('div', 'item-line clickable', item.meta.title ?? item.fileName);
      line.addEventListener('click', () => handlers.openItem(`${STACKS_DIR}/${stack.name}`, item.fileName));
      card.appendChild(line);
    }
    if (stack.items.length > 5) {
      card.appendChild(el('div', 'notice', `…and ${stack.items.length - 5} more`));
    }
    card.appendChild(actionButton('+ Add item', `New item in “${stack.name}”`, () => handlers.addItem(stack.name), 'btn small'));
    grid.appendChild(card);
  }

  // New stack card.
  const newCard = el('button', 'card add-card');
  newCard.type = 'button';
  newCard.textContent = '+ New stack';
  newCard.addEventListener('click', handlers.createStack);
  grid.appendChild(newCard);

  root.appendChild(grid);
  return root;
}

export function promptName(title, initial = '') {
  return new Promise((resolve) => {
    const overlay = el('div', 'overlay');
    const dialog = el('div', 'dialog');
    const label = el('div', 'dialog-title', title);
    const input = el('input', 'text');
    input.value = initial;
    input.maxLength = 80;
    const row = el('div', 'field-row');
    const ok = el('button', 'btn primary', 'OK');
    const cancel = el('button', 'btn', 'Cancel');
    row.append(ok, cancel);
    dialog.append(label, input, row);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
    const done = (value) => {
      overlay.remove();
      resolve(value);
    };
    ok.addEventListener('click', () => done(input.value.trim() || null));
    cancel.addEventListener('click', () => done(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value.trim() || null);
      if (e.key === 'Escape') done(null);
    });
  });
}
