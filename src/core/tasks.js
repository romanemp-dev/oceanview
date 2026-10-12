// Inline @due(YYYY-MM-DD) task-date syntax (R-02/R-07, D-008).
// Isolated in a single module so the syntax can change without refactoring.

const DUE_RE = /@due\((\d{4}-\d{2}-\d{2})\)/;

export function parseDue(line) {
  const m = line.match(DUE_RE);
  return m ? m[1] : null;
}

export function stripDue(line) {
  return line.replace(/\s*@due\(\d{4}-\d{2}-\d{2}\)/, '');
}

export function setDue(line, dateIso) {
  const base = stripDue(line);
  return dateIso ? `${base} @due(${dateIso})` : base;
}

// Checkbox tasks are parsed in any item type (D-013).
// Returns [{ done, text, due }]; lines that are not tasks are ignored.
export function parseTasks(body) {
  const tasks = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (!m) continue;
    tasks.push({ done: m[1] !== ' ', text: m[2].trim(), due: parseDue(m[2]) });
  }
  return tasks;
}

export function isOverdue(dueIso, todayIsoStr) {
  return Boolean(dueIso) && dueIso < todayIsoStr;
}

export function isDueToday(dueIso, todayIsoStr) {
  return Boolean(dueIso) && dueIso === todayIsoStr;
}

// Replace the nth task line's checkbox state (index order matches parseTasks).
export function toggleTaskLine(body, index, done) {
  let seen = -1;
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*[-*]\s+)\[( |x|X)\](\s+.*)$/);
    if (!m) continue;
    seen++;
    if (seen === index) {
      lines[i] = `${m[1]}[${done ? 'x' : ' '}]${m[3]}`;
      break;
    }
  }
  return lines.join('\n');
}
