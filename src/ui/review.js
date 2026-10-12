// Review view (R-12): agent activity for one stack, read-only.
import { readActivityEntries } from '../core/activity.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Renders the review panel for a stack (or inbox): entries since last review,
// "mark reviewed" action. Pure display — no editing of agent logs.
export async function renderReviewView({ adapter, stackName, reviewState, handlers }) {
  const key = stackName === 'inbox' ? 'inbox' : stackName;
  const lastReviewedTs = reviewState[key];
  const all = (await readActivityEntries(adapter)).filter(
    (e) => (e.stack ?? '') === key || (key !== 'inbox' && (e.stack ?? '') === key),
  );
  const unreviewed = all.filter((e) => !lastReviewedTs || String(e.ts ?? '') > lastReviewedTs);
  const shown = unreviewed.length ? unreviewed : all.slice(-10);

  const root = el('div', 'review-view');
  const top = el('div', 'item-top');
  const back = el('button', 'btn small', '← Desk');
  back.type = 'button';
  back.addEventListener('click', handlers.backToDesk);
  top.appendChild(back);
  top.appendChild(el('span', 'crumb', `Agent activity — ${key}`));
  if (unreviewed.length) {
    const mark = el('button', 'btn primary small', 'Mark reviewed');
    mark.type = 'button';
    mark.addEventListener('click', () => handlers.markReviewed(key));
    top.appendChild(mark);
  }
  root.appendChild(top);

  if (!shown.length) {
    root.appendChild(el('p', 'notice', 'No agent activity recorded for this stack yet.'));
    root.appendChild(
      el('p', 'notice', 'Agents append JSON lines to .desk/activity/YYYY-MM-DD.log — see docs/workspace-conventions.md.'),
    );
    return root;
  }

  const list = el('ul', 'activity-list');
  for (const entry of shown) {
    const li = el('li', 'activity-entry');
    const head = el('div', 'activity-head');
    head.appendChild(el('strong', null, entry.agent ?? 'unknown agent'));
    head.appendChild(el('span', 'chip', entry.action ?? 'edit'));
    head.appendChild(el('span', 'activity-ts', entry.ts ?? entry.source ?? ''));
    li.appendChild(head);
    if (entry.summary) li.appendChild(el('div', 'activity-summary', String(entry.summary)));
    if (Array.isArray(entry.files) && entry.files.length) {
      const files = el('div', 'activity-files');
      for (const f of entry.files) files.appendChild(el('code', null, String(f)));
      li.appendChild(files);
    }
    list.appendChild(li);
  }
  root.appendChild(list);

  if (unreviewed.length) {
    root.appendChild(el('p', 'notice', `${unreviewed.length} new entr${unreviewed.length === 1 ? 'y' : 'ies'} since last review.`));
  } else {
    root.appendChild(el('p', 'notice', 'All entries reviewed.'));
  }
  return root;
}
