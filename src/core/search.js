// Full-text search across items (R-14).
// Client-side over the desk snapshot readDesk() already loaded; no index cache
// needed at workspace scale (hundreds of markdown files).

function searchTokens(query) {
  return String(query)
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/i)
    .filter((w) => w.length >= 2);
}

function snippetFor(body, tokens) {
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const low = t.toLowerCase();
    if (tokens.some((w) => low.includes(w))) {
      return t.length > 90 ? `${t.slice(0, 90)}…` : t;
    }
  }
  return '';
}

// Returns [{ dir, stackName, fileName, title, score, snippet }] sorted by score.
export function searchItems(desk, query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return [];
  const phrase = query.trim().toLowerCase();
  const results = [];

  const groups = [
    { dir: 'inbox', name: 'Inbox', items: desk.inboxItems },
    ...desk.stacks.map((s) => ({ dir: `stacks/${s.name}`, name: s.name, items: s.items })),
  ];

  for (const group of groups) {
    for (const item of group.items) {
      const title = String(item.meta.title ?? item.fileName);
      const body = item.body ?? '';
      const lowTitle = title.toLowerCase();
      const lowBody = body.toLowerCase();
      let score = 0;
      if (lowTitle.includes(phrase)) score += 6;
      if (lowBody.includes(phrase)) score += 2;
      for (const w of tokens) {
        if (lowTitle.includes(w)) score += 4;
        if (lowBody.includes(w)) score += 1;
      }
      if (!score) continue;
      results.push({
        dir: group.dir,
        stackName: group.name,
        fileName: item.fileName,
        title,
        score,
        snippet: snippetFor(body, tokens),
      });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}
