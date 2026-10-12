// Item view: viewer + markdown editor with preview (R-06/R-05/R-15).
import { renderMarkdown } from '../core/markdown.js';
import { toggleTaskLine, setTaskDue } from '../core/tasks.js';
import { todayIso } from '../core/frontmatter.js';
import { parseSlides } from '../core/slides.js';

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
    const typeMenu = actionButton(
      typeMenuLabel(item.meta.type),
      'Switch item type',
      handlers.cycleType,
    );
    actions.appendChild(typeMenu);
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

function typeMenuLabel(type) {
  if (type === 'note') return 'Make checklist';
  if (type === 'checklist') return 'Make list';
  if (type === 'list') return 'Make slides';
  return 'Make note';
}

function buildViewer(item, handlers) {
  const wrap = el('div', 'reader');
  const title = el('h2', 'item-title', item.meta.title ?? item.fileName);
  wrap.appendChild(title);

  if (item.meta.type === 'slides') {
    wrap.appendChild(buildSlidesViewer(item));
    return wrap;
  }

  const body = el('div', 'markdown-body');
  body.innerHTML = renderMarkdown(item.body, todayIso());
  // Due chips become date inputs: set/clear the date inline (R-07).
  for (const chip of body.querySelectorAll('.due-chip[data-task-due]')) {
    const idx = Number(chip.dataset.taskDue);
    const input = document.createElement('input');
    input.type = 'date';
    input.className = chip.className;
    input.dataset.taskDate = String(idx);
    input.value = item.tasks[idx]?.due ?? '';
    chip.replaceWith(input);
  }
  body.addEventListener('change', (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-task]');
    if (!cb) return;
    handlers.toggleTask(Number(cb.dataset.task), cb.checked);
  });
  body.addEventListener('change', (e) => {
    const dateInput = e.target.closest('input[type="date"][data-task-date]');
    if (!dateInput) return;
    handlers.setTaskDue(Number(dateInput.dataset.taskDate), dateInput.value || null);
  });
  wrap.appendChild(body);
  return wrap;
}

function buildSlidesViewer(item) {
  const { options, slides } = parseSlides(item.body);
  const wrap = el('div', 'slides-view');
  const pager = el('div', 'slides-pager');
  const prev = actionButton('←', 'Previous slide', () => go(-1), 'btn small');
  const counter = el('span', 'slides-counter');
  const next = actionButton('→', 'Next slide', () => go(1), 'btn small');
  pager.append(prev, counter, next);
  wrap.appendChild(pager);

  const stage = el('div', 'slide-stage');
  const theme = options.theme === 'dark' ? ' dark' : '';
  stage.className = `slide-stage${theme}`;
  wrap.appendChild(stage);

  let index = 0;
  function render() {
    counter.textContent = `${index + 1} / ${slides.length}`;
    stage.innerHTML = renderMarkdown(slides[index] ?? '', todayIso());
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
  }
  function go(delta) {
    index = Math.min(Math.max(index + delta, 0), slides.length - 1);
    render();
  }
  function onKey(e) {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  }
  document.addEventListener('keydown', onKey);
  // Detach when the view is torn down (desk re-render clears #desk content).
  const observer = new MutationObserver(() => {
    if (!document.body.contains(stage)) {
      document.removeEventListener('keydown', onKey);
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('desk') ?? document.body, { childList: true, subtree: true });

  if (!slides.length) stage.appendChild(el('p', 'notice', 'Empty slides item. Add markdown separated by --- lines.'));
  else render();
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
  const updatePreview = () => {
    if (item.meta.type === 'slides') {
      const { slides } = parseSlides(textarea.value);
      preview.innerHTML = slides.length
        ? `<div class="slide-stage">${renderMarkdown(slides[0] ?? '', todayIso())}</div><p class="notice">Slide 1 of ${slides.length} — open the item to browse.</p>`
        : '<p class="notice">No slides yet. Separate slides with a --- line.</p>';
    } else {
      preview.innerHTML = renderMarkdown(textarea.value, todayIso());
    }
  };
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
