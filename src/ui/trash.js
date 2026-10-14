// Trash management UI (Wave 5): list, restore, purge.
import { promptName } from './desk.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderTrashView({ entries, handlers }) {
  const root = el('div', 'item-view');
  const top = el('div', 'item-top');
  const back = el('button', 'btn small', '← Desk');
  back.type = 'button';
  back.addEventListener('click', handlers.backToDesk);
  top.appendChild(back);
  top.appendChild(el('span', 'crumb', `Trash — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`));
  root.appendChild(top);

  if (!entries.length) {
    root.appendChild(el('p', 'notice', 'Trash is empty. Deleted items and stacks land here (soft delete, D-015).'));
    return root;
  }

  const list = el('ul', 'trash-list');
  for (const entry of entries) {
    const li = el('li', 'activity-entry');
    const head = el('div', 'activity-head');
    const what = entry.origin?.kind === 'stack'
      ? `Stack “${entry.origin.name}”`
      : entry.origin?.kind === 'item'
        ? `Item “${entry.origin.fileName}”`
        : `Unknown (no manifest)`;
    head.appendChild(el('strong', null, what));
    if (entry.origin?.kind === 'item' && entry.origin.dir) {
      head.appendChild(el('span', 'chip muted', entry.origin.dir));
    }
    head.appendChild(el('span', 'activity-ts', `${entry.files.length} file(s) · ${entry.dirName}`));
    li.appendChild(head);

    const actions = el('div', 'item-actions');
    const restore = el('button', 'btn small', 'Restore');
    restore.type = 'button';
    restore.addEventListener('click', () => handlers.restore(entry));
    actions.appendChild(restore);
    const purge = el('button', 'btn small', 'Delete forever');
    purge.type = 'button';
    purge.addEventListener('click', () => handlers.purge(entry));
    actions.appendChild(purge);
    li.appendChild(actions);

    if (entry.files.length) {
      const files = el('div', 'activity-files');
      for (const f of entry.files.slice(0, 4)) files.appendChild(el('code', null, f));
      if (entry.files.length > 4) files.appendChild(el('span', 'notice', `+${entry.files.length - 4} more`));
      li.appendChild(files);
    }
    list.appendChild(li);
  }
  root.appendChild(list);
  return root;
}

export { promptName };
