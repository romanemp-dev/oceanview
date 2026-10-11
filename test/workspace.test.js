import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontMatter, serializeFrontMatter, todayIso } from '../src/core/frontmatter.js';
import { parseDue, stripDue, setDue, parseTasks, isOverdue, isDueToday } from '../src/core/tasks.js';
import { memoryAdapter } from '../src/core/memory-adapter.js';
import { createWorkspaceModel, scanReport, INBOX, STACKS_DIR } from '../src/core/workspace.js';

test('front-matter: parse and serialize round-trip', () => {
  const text = '---\ntype: note\ntitle: Flights to Osaka\ncreated: 2026-01-01\nupdated: 2026-01-02\ntags: [travel, japan]\n---\n\nBody text.\n';
  const { meta, body } = parseFrontMatter(text);
  assert.equal(meta.type, 'note');
  assert.equal(meta.title, 'Flights to Osaka');
  assert.deepEqual(meta.tags, ['travel', 'japan']);
  assert.equal(body, 'Body text.\n');
  const out = serializeFrontMatter(meta, body);
  assert.equal(parseFrontMatter(out).meta.title, 'Flights to Osaka');
  assert.equal(parseFrontMatter(out).body, 'Body text.\n');
});

test('front-matter: missing block returns null meta', () => {
  const { meta, body } = parseFrontMatter('Just text');
  assert.equal(meta, null);
  assert.equal(body, 'Just text');
});

test('front-matter: quoting titles with colons', () => {
  const out = serializeFrontMatter({ title: 'Plan: phase one' }, '');
  const back = parseFrontMatter(out);
  assert.equal(back.meta.title, 'Plan: phase one');
});

test('@due: parse, strip, set, clear', () => {
  const line = '- [ ] buy flights @due(2026-06-20)';
  assert.equal(parseDue(line), '2026-06-20');
  assert.equal(stripDue(line), '- [ ] buy flights');
  assert.equal(setDue(line, '2026-07-01'), '- [ ] buy flights @due(2026-07-01)');
  assert.equal(setDue(line, null), '- [ ] buy flights');
  assert.equal(parseDue('- [ ] no date'), null);
});

test('tasks: parse checkboxes with due dates', () => {
  const body = '# Todo\n\n- [ ] alpha @due(2026-01-10)\n- [x] beta\n  - [ ] nested @due(2026-02-02)\nnot a task\n';
  const tasks = parseTasks(body);
  assert.equal(tasks.length, 3);
  assert.deepEqual(tasks[0], { done: false, text: 'alpha @due(2026-01-10)', due: '2026-01-10' });
  assert.equal(tasks[1].done, true);
  assert.equal(tasks[2].due, '2026-02-02');
});

test('due logic: overdue vs today', () => {
  const today = todayIso();
  assert.equal(isOverdue('2000-01-01', today), true);
  assert.equal(isOverdue(today, today), false);
  assert.equal(isDueToday(today, today), true);
  assert.equal(isDueToday('2000-01-01', today), false);
  assert.equal(isOverdue(null, today), false);
});

test('scanReport: flags missing convention folders', () => {
  const report = scanReport([{ name: 'random', kind: 'directory' }]);
  assert.equal(report.issues.length, 3);
  const ok = scanReport([
    { name: INBOX, kind: 'directory' },
    { name: STACKS_DIR, kind: 'directory' },
    { name: '.desk', kind: 'directory' },
  ]);
  assert.equal(ok.issues.length, 0);
});

test('workspace: initialize then read desk', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  const issues = (await ws.validate()).issues;
  assert.ok(issues.length > 0);
  await ws.initialize();
  assert.equal((await ws.validate()).issues.length, 0);

  const desk = await ws.readDesk();
  assert.equal(desk.stacks.length, 0);
  assert.equal(desk.inboxItems.length, 0);

  await ws.createStack('work');
  const fileName = await ws.createItem(`${STACKS_DIR}/work`, 'checklist', 'Plan week');
  const desk2 = await ws.readDesk();
  assert.equal(desk2.stacks[0].name, 'work');
  assert.equal(desk2.stacks[0].items[0].meta.title, 'Plan week');
  assert.equal(desk2.stacks[0].items[0].fileName, fileName);
});

test('workspace: due today surfaces on stack and item', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('home');
  const today = todayIso();
  const path = `${STACKS_DIR}/home/errands.md`;
  await adapter.writeFile(
    path,
    '---\ntype: checklist\ntitle: Errands\ncreated: ' + today + '\nupdated: ' + today + '\ntags: []\n---\n\n- [ ] pay rent @due(' + today + ')\n- [x] done thing\n',
  );
  const desk = await ws.readDesk();
  assert.equal(desk.stacks[0].hasDueToday, true);
  assert.equal(desk.stacks[0].items[0].hasDueToday, true);
  assert.equal(desk.stacks[0].hasOverdue, false);
});

test('workspace: move item between stacks', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('a');
  await ws.createStack('b');
  const f = await ws.createItem(`${STACKS_DIR}/a`, 'note', 'Test note');
  await ws.moveItem(`${STACKS_DIR}/a`, f, `${STACKS_DIR}/b`);
  const desk = await ws.readDesk();
  assert.equal(desk.stacks.find((s) => s.name === 'a').items.length, 0);
  assert.equal(desk.stacks.find((s) => s.name === 'b').items[0].fileName, f);
});

test('workspace: config round-trip', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  const config = await ws.readConfig();
  config.stacks['work'] = { color: 'blue', agents: ['claw'] };
  await ws.writeConfig(config);
  const back = await ws.readConfig();
  assert.deepEqual(back.stacks['work'], { color: 'blue', agents: ['claw'] });
});
