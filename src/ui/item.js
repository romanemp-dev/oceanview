// Item view: viewer + markdown editor with preview (R-06).
import { renderMarkdown } from '../core/markdown.js';
import { toggleTaskLine } from '../core/tasks.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function actionButton(text, title, onClick, cls = 'btn small') {
  const b = el('button', cls, text);
  b.type = 'button';
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

export function renderItemView({ item, handlers }) {
  const root = el('div', 'item-view');

  const top = el('div', 'item-top');
  const back = actionButton('← Desk', 'Back to the desk', handlers.backToDesk);
  top.appendChild(back);
  top.appendChild(el('span', 'crumb', `${item.dir}/${item.fileName}`));

  const actions = el('div', 'item-actions');
  const editBtn = actionButton(handlers.editing ? 'Done' : 'Edit', 'Toggle editor', handlers.toggleEdit, 'btn primary small');
  actions.appendChild(editBtn);
  if (!handlers.editing) {
    const checklistToggle = actionButton(
      item.meta.type === 'checklist' ? 'Make note' : 'Make checklist',
      'Switch item type',
      handlers.switchType,
    );
    actions.appendChild(checklistToggle);
  }
  actions.appendChild(actionButton('Move…', 'Move to another stack or inbox', handlers.moveItem));
  actions.appendChild(actionButton('Delete', 'Move to .desk/trash', handlers.trashItem));
  top.appendChild(actions);
  root.appendChild(top);

  // Meta line.
  const meta = el('div', 'meta-line');
  meta.appendChild(el('span', 'chip', item.meta.type ?? 'note'));
  if (item.meta.created) meta.appendChild(el('span', 'chip muted', `created ${item.meta.created}`));
  if (item.meta.updated) meta.appendChild(el('span', 'chip muted', `updated ${item.meta.updated}`));
  for (const tag of item.meta.tags ?? []) meta.appendChild(el('span', 'chip tag', `#${tag}`));
  root.appendChild(meta);

  if (handlers.editing) {
    root.appendChild(buildEditor(item, handlers));
  } else {
    root.appendChild(buildViewer(item, handlers));
  }
  return root;
}

function buildViewer(item, handlers) {
  const wrap = el('div', 'reader');
  const title = el('h2', 'item-title', item.meta.title ?? item.fileName);
  wrap.appendChild(title);
  const body = el('div', 'markdown-body');
  body.innerHTML = renderMarkdown(item.body);
  body.addEventListener('change', (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-task]');
    if (!cb) return;
    handlers.toggleTask(Number(cb.dataset.task), cb.checked);
  });
  wrap.appendChild(body);
  return wrap;
}

function buildEditor(item, handlers) {
  const wrap = el('div', 'editor');

  const titleRow = el('div', 'field-row');
  const titleLabel = el('label', null, 'Title');
  titleLabel.setAttribute('for', 'item-title');
  const title = el('input', 'text');
  title.id = 'item-title';
  title.value = item.meta.title ?? '';
  title.maxLength = 120;
  titleRow.append(titleLabel, title);
  wrap.appendChild(titleRow);

  const cols = el('div', 'editor-cols');
  const left = el('div', 'editor-pane');
  const editorLabel = el('div', 'pane-label', 'Markdown — Ctrl/Cmd+S to save');
  const textarea = el('textarea');
  textarea.value = item.body;
  textarea.spellcheck = false;
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handlers.save(title.value, textarea.value);
    }
  });
  left.append(editorLabel, textarea);

  const right = el('div', 'editor-pane');
  const previewLabel = el('div', 'pane-label', 'Preview');
  const preview = el('div', 'markdown-body preview');
  const updatePreview = () => { preview.innerHTML = renderMarkdown(textarea.value); };
  textarea.addEventListener('input', updatePreview);
  updatePreview();
  right.append(previewLabel, preview);

  cols.append(left, right);
  wrap.appendChild(cols);

  const saveBar = el('div', 'save-bar');
  saveBar.appendChild(actionButton('Save', 'Write file (bumps updated)', () => handlers.save(title.value, textarea.value), 'btn primary small'));
  saveBar.appendChild(el('span', 'notice', 'Saving writes the .md file to your workspace folder.'));
  wrap.appendChild(saveBar);
  return wrap;
}
