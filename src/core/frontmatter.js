// Front-matter subset parser/serializer (R-02, D-011).
// Supports the conventions fields: type, title, created, updated, tags.
// Deliberately not a full YAML engine — deterministic and reversible for our subset.

const KNOWN_FIELDS = ['type', 'title', 'created', 'updated', 'tags'];

function parseScalar(raw) {
  const t = raw.trim();
  if (/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  if (/^".*"$/.test(t)) return t.slice(1, -1).replace(/\\"/g, '"');
  return t;
}

export function parseFrontMatter(text) {
  if (!text.startsWith('---')) return { meta: null, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { meta: null, body: text };
  const block = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n+/, '');
  const meta = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (key === 'tags') {
      const inner = raw.replace(/^\[/, '').replace(/\]$/, '').trim();
      meta.tags = inner ? inner.split(',').map((t) => parseScalar(t)).filter(Boolean) : [];
    } else {
      meta[key] = parseScalar(raw);
    }
  }
  return { meta, body };
}

function quote(value) {
  return /[:#\[\]{}&*!|>'"%@`,]/.test(value) ? `'${value.replace(/'/g, "''")}'` : value;
}

export function serializeFrontMatter(meta, body) {
  const lines = ['---'];
  for (const key of KNOWN_FIELDS) {
    if (!(key in meta) || meta[key] === undefined || meta[key] === null) continue;
    if (key === 'tags') {
      const tags = meta.tags ?? [];
      lines.push(`tags: [${tags.join(', ')}]`);
    } else {
      lines.push(`${key}: ${quote(String(meta[key]))}`);
    }
  }
  lines.push('---', '', '');
  return lines.join('\n') + body;
}

export function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
