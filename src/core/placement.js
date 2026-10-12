// Smart placement heuristics (R-09, D-006): deterministic, no LLM calls.
// Signals: shared terms (title+body vs stack contents), stack-name tokens,
// tag match, and a "last used" fallback when nothing matches.

const STOP = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'your', 'have',
  'want', 'need', 'todo', 'note', 'checklist', 'about', 'when', 'what', 'where',
  'will', 'more', 'like', 'some', 'just', 'also', 'than', 'then', 'over',
  'это', 'для', 'или', 'как', 'что', 'чтобы', 'ещё', 'еще', 'там', 'себя', 'тому', 'который',
]);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/i)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

export function buildStackIndex(desk) {
  const index = {};
  for (const stack of desk.stacks) {
    const terms = new Map();
    const tags = new Set();
    let lastUpdated = '';
    for (const item of stack.items) {
      for (const t of tokenize(`${item.meta.title ?? ''}\n${item.body}`)) {
        terms.set(t, (terms.get(t) ?? 0) + 1);
      }
      for (const tag of item.meta.tags ?? []) tags.add(tag);
      if (item.meta.updated && item.meta.updated > lastUpdated) lastUpdated = item.meta.updated;
    }
    index[stack.name] = {
      name: stack.name,
      terms,
      tags,
      lastUpdated,
      nameTokens: tokenize(stack.name),
    };
  }
  return index;
}

// Returns up to `limit` suggestions: [{ stack, score, reason }].
export function suggestStacks(item, desk, { limit = 3 } = {}) {
  if (!desk.stacks.length) return [];
  const index = buildStackIndex(desk);
  const itemTerms = tokenize(`${item.meta.title ?? ''}\n${item.body}`);
  const itemTags = new Set(item.meta.tags ?? []);

  const results = [];
  for (const stack of Object.values(index)) {
    let score = 0;
    const reasons = [];
    let matched = 0;
    for (const t of itemTerms) {
      const n = stack.terms.get(t);
      if (n) {
        score += 2 + Math.min(n, 5) * 0.1;
        matched++;
      }
    }
    if (matched) reasons.push(`${matched} shared term${matched > 1 ? 's' : ''}`);
    for (const t of stack.nameTokens) {
      if (itemTerms.includes(t)) {
        score += 3;
        reasons.push(`name “${t}”`);
      }
    }
    const tagHits = [...itemTags].filter((t) => stack.tags.has(t));
    if (tagHits.length) {
      score += tagHits.length * 4;
      reasons.push(`tag #${tagHits[0]}`);
    }
    if (score > 0) results.push({ stack: stack.name, score, reason: reasons.slice(0, 2).join(', ') });
  }

  // Recent-stack fallback so there is always a one-click option (D-006).
  if (!results.length) {
    const recent = [...desk.stacks]
      .sort((a, b) => (index[b.name].lastUpdated || '').localeCompare(index[a.name].lastUpdated || ''))[0];
    if (recent?.lastUpdated) {
      results.push({ stack: recent.name, score: 0.1, reason: 'last used' });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
