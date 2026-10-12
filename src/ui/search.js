// Search UI (R-14): topbar input with dropdown results.
import { searchItems } from '../core/search.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Mounts the search box into the given container. getDesk() must return the
// current desk snapshot (or null when no workspace); openItem(dir, fileName)
// navigates to a result.
export function setupSearch({ container, getDesk, openItem }) {
  const wrap = el('div', 'search-wrap');
  const input = el('input', 'search-input');
  input.type = 'search';
  input.placeholder = 'Search items…  ( /)';
  input.setAttribute('aria-label', 'Search items');
  const dropdown = el('div', 'search-dropdown hidden');
  wrap.append(input, dropdown);
  container.appendChild(wrap);

  let desk = null;
  let debounceTimer = null;

  function renderResults(items) {
    dropdown.innerHTML = '';
    if (!items.length) {
      dropdown.appendChild(el('div', 'search-empty', 'No matches'));
      dropdown.classList.remove('hidden');
      return;
    }
    for (const r of items) {
      const row = el('button', 'search-result');
      row.type = 'button';
      row.innerHTML =
        `<span class="search-title"></span>` +
        `<span class="search-meta"></span>` +
        (r.snippet ? `<span class="search-snippet"></span>` : '');
      row.querySelector('.search-title').textContent = r.title;
      row.querySelector('.search-meta').textContent = r.stackName;
      if (r.snippet) row.querySelector('.search-snippet').textContent = r.snippet;
      row.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        input.blur();
        openItem(r.dir, r.fileName);
      });
      dropdown.appendChild(row);
    }
    dropdown.classList.remove('hidden');
  }

  function run() {
    const q = input.value;
    if (!desk || q.trim().length < 2) {
      dropdown.classList.add('hidden');
      return;
    }
    renderResults(searchItems(desk, q));
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 120);
  });
  input.addEventListener('focus', run);
  document.addEventListener('mousedown', (e) => {
    if (!wrap.contains(e.target)) dropdown.classList.add('hidden');
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
      input.blur();
    }
  });

  // Hotkey: "/" focuses search when not typing.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/') return;
    const t = e.target;
    const typing = t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing) return;
    e.preventDefault();
    input.focus();
  });

  return {
    setDesk(next) {
      desk = next;
    },
  };
}
