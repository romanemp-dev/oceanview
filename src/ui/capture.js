// Quick capture (R-08): floating button + hotkey N → two-line composer → inbox/.
import { todayIso } from '../core/frontmatter.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Creates the capture button and binds the hotkey. capture(text) must create
// the inbox item; the composer writes "first line\n\nsecond line".
export function setupQuickCapture({ onCapture }) {
  const btn = el('button', 'capture-fab', '+');
  btn.type = 'button';
  btn.title = 'Quick capture (N)';
  btn.setAttribute('aria-label', 'Quick capture');
  document.body.appendChild(btn);

  function openComposer() {
    if (document.getElementById('capture-overlay')) return;
    const overlay = el('div', 'overlay');
    overlay.id = 'capture-overlay';
    const dialog = el('div', 'dialog capture-dialog');

    const label = el('div', 'dialog-title', 'Quick capture');
    const first = el('textarea', 'capture-first');
    first.rows = 1;
    first.placeholder = 'What is it?';
    const second = el('textarea', 'capture-second');
    second.rows = 2;
    second.placeholder = 'Details (optional)…';
    const hint = el('div', 'notice', 'Goes to Inbox — sort it from there. Enter to save, Esc to cancel.');
    const err = el('div', 'error-text');

    const row = el('div', 'field-row');
    const save = el('button', 'btn primary', 'Capture');
    const cancel = el('button', 'btn', 'Cancel');
    row.append(save, cancel);

    dialog.append(label, first, second, hint, err, row);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    first.focus();

    const close = () => overlay.remove();
    cancel.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

    const submit = async () => {
      const line1 = first.value.trim();
      if (!line1) {
        err.textContent = 'Write at least one line.';
        return;
      }
      save.disabled = true;
      try {
        await onCapture(line1, second.value.trim());
        close();
      } catch (e) {
        err.textContent = e?.message ?? String(e);
        save.disabled = false;
      }
    };
    save.addEventListener('click', submit);
    first.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); second.focus(); }
      if (e.key === 'Escape') close();
    });
    second.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
      if (e.key === 'Escape') close();
    });
  }

  btn.addEventListener('click', openComposer);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'n' && e.key !== 'N' && e.key !== 'т' && e.key !== 'Т') return;
    const t = e.target;
    const typing = t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing) return;
    if (document.getElementById('capture-overlay')) return;
    e.preventDefault();
    openComposer();
  });
}

// Build the front-matter item contents for a captured note.
export function captureItemText(line1, line2) {
  const today = todayIso();
  const body = line2 ? `${line1}\n\n${line2}\n` : `${line1}\n`;
  return {
    meta: { type: 'note', title: line1, created: today, updated: today, tags: [] },
    body,
  };
}
