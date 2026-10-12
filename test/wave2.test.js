import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter } from '../src/core/memory-adapter.js';
import { createWorkspaceModel, STACKS_DIR } from '../src/core/workspace.js';
import { collectTodayTasks } from '../src/ui/today.js';
import { captureItemText } from '../src/ui/capture.js';
import { parseFrontMatter } from '../src/core/frontmatter.js';

const TODAY = '2026-06-15';

async function deskFixture() {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('work');
  await ws.createStack('home');
  const today = TODAY;
  await adapter.writeFile(
    `${STACKS_DIR}/work/report.md`,
    `---\ntype: checklist\ntitle: Report\ncreated: ${today}\nupdated: ${today}\ntags: []\n---\n\n- [ ] send draft @due(${today})\n- [ ] old thing @due(2020-01-01)\n- [x] done thing @due(${today})\n- [ ] someday thing\n`,
  );
  await adapter.writeFile(
    `${STACKS_DIR}/home/chores.md`,
    `---\ntype: checklist\ntitle: Chores\ncreated: ${today}\nupdated: ${today}\ntags: []\n---\n\n- [ ] water plants @due(${today})\n`,
  );
  await adapter.writeFile(
    'inbox/note.md',
    `---\ntype: note\ntitle: Note\ncreated: ${today}\nupdated: ${today}\ntags: []\n---\n\n- [ ] sort me @due(${today})\n`,
  );
  return ws;
}

test('today tray: collects due-today and overdue across stacks and inbox', async () => {
  const ws = await deskFixture();
  const desk = await ws.readDesk();
  const tasks = collectTodayTasks(desk, TODAY);
  // send draft (today), old thing (overdue), water plants (today), sort me (today)
  assert.equal(tasks.length, 4);
  assert.equal(tasks[0].due, '2020-01-01'); // overdue sorts first
  assert.equal(tasks[0].overdue, true);
  assert.equal(tasks[0].stackName, 'work');
  const todayOnes = tasks.filter((t) => !t.overdue);
  assert.equal(todayOnes.length, 3);
  assert.ok(todayOnes.every((t) => t.due === TODAY));
  // done and undated tasks are excluded
  assert.ok(!tasks.some((t) => t.text.includes('done thing')));
  assert.ok(!tasks.some((t) => t.text.includes('someday')));
});

test('today tray: @due suffix is stripped from task text', async () => {
  const ws = await deskFixture();
  const desk = await ws.readDesk();
  const tasks = collectTodayTasks(desk, TODAY);
  const old = tasks.find((t) => t.overdue);
  assert.equal(old.text, 'old thing');
});

test('capture: builds note meta with title from first line', () => {
  const { meta, body } = captureItemText('buy flights to Osaka', 'check prices tonight');
  assert.equal(meta.title, 'buy flights to Osaka');
  assert.equal(meta.type, 'note');
  assert.ok(meta.created);
  assert.equal(body, 'buy flights to Osaka\n\ncheck prices tonight\n');
  const { meta: back, body: backBody } = parseFrontMatter(`---\ntype: ${meta.type}\ntitle: ${meta.title}\ncreated: ${meta.created}\nupdated: ${meta.updated}\ntags: []\n---\n${body}`);
  assert.equal(back.title, 'buy flights to Osaka');
  assert.equal(backBody, body);
});
