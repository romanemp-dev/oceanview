// Today tray (R-10) + attention markers (R-11): cross-stack due/overdue panel.
import { todayIso } from '../core/frontmatter.js';
import { isOverdue, isDueToday } from '../core/tasks.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Collect due-today and overdue tasks across stacks + inbox.
// Returns [{ stackDir, stackName, fileName, itemTitle, index, text, due, done, overdue }]
export function collectTodayTasks(desk, today = todayIso()) {
  const out = [];
  const groups = [
    { dir: 'inbox', name: 'Inbox', items: desk.inboxItems },
    ...desk.stacks.map((s) => ({ dir: `stacks/${s.name}`, name: s.name, items: s.items })),
  ];
  for (const group of groups) {
    for (const item of group.items) {
      item.tasks.forEach((t, index) => {
        if (t.done) return;
        const overdue = isOverdue(t.due, today);
        if (!overdue && !isDueToday(t.due, today)) return;
        out.push({
          stackDir: group.dir,
          stackName: group.name,
          fileName: item.fileName,
          itemTitle: item.meta.title ?? item.fileName,
          index,
          text: t.text.replace(/\s*@due\(\d{4}-\d{2}-\d{2}\)/, ''),
          due: t.due,
          overdue,
        });
      });
    }
  }
  // Overdue first, then by date.
  out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  return out;
}

export function renderTodayTray({ desk, handlers }) {
  const tasks = collectTodayTasks(desk);
  const tray = el('section', 'today-tray');
  const header = el('div', 'tray-header');
  header.appendChild(el('h3', null, 'Today'));
  const today = todayIso();
  const overdueCount = tasks.filter((t) => t.overdue).length;
  if (tasks.length) {
    header.appendChild(el('span', 'tray-count', `${tasks.length} task${tasks.length === 1 ? '' : 's'}`));
  }
  tray.appendChild(header);
  tray.dataset.date = today;

  if (!tasks.length) {
    tray.appendChild(el('div', 'tray-empty', 'Nothing due today. 🌤'));
    return tray;
  }

  if (overdueCount) {
    tray.appendChild(el('div', 'tray-overdue-note', `${overdueCount} overdue`));
  }

  const list = el('ul', 'tray-list');
  for (const t of tasks) {
    const li = el('li', 'tray-item');
    const line = el('div', 'tray-line clickable');
    line.appendChild(el('span', 'tray-text', t.text));
    line.appendChild(el('span', `due-chip${t.overdue ? ' overdue' : ' today'}`, t.overdue ? t.due : 'today'));
    line.addEventListener('click', () => handlers.openItem(t.stackDir, t.fileName));
    li.appendChild(line);
    li.appendChild(el('div', 'tray-src', `${t.stackName} · ${t.itemTitle}`));
    list.appendChild(li);
  }
  tray.appendChild(list);
  return tray;
}
