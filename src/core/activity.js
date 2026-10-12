// Agent activity logs (R-12): read .desk/activity/YYYY-MM-DD.log JSON lines.
// Append-only convention; malformed lines are skipped, never rewritten here.
export const ACTIVITY_DIR = '.desk/activity';

// Returns [{ ts, agent, stack, action, files, summary, source }] sorted by ts.
export async function readActivityEntries(adapter) {
  let files;
  try {
    files = (await adapter.listDir(ACTIVITY_DIR))
      .filter((e) => e.kind === 'file' && e.name.endsWith('.log'))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
  const entries = [];
  for (const name of files) {
    let text;
    try {
      text = await adapter.readFile(`${ACTIVITY_DIR}/${name}`);
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          entries.push({ ...obj, source: name });
        }
      } catch {
        // Malformed line — skip silently (logs are agent-written, append-only).
      }
    }
  }
  return entries.sort((a, b) => String(a.ts ?? '').localeCompare(String(b.ts ?? '')));
}

export function isEntryUnreviewed(entry, lastReviewedTs) {
  return !lastReviewedTs || String(entry.ts ?? '') > lastReviewedTs;
}

// Number of entries for a scope (stack name or "inbox") newer than the last
// reviewed timestamp. Used for desk markers (R-11/R-12).
export function unreviewedCount(entries, scope, lastReviewedTs) {
  return entries.filter(
    (e) => (e.stack ?? '') === scope && isEntryUnreviewed(e, lastReviewedTs),
  ).length;
}
