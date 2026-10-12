import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/core/markdown.js';
import { toggleTaskLine } from '../src/core/tasks.js';
import { memoryAdapter } from '../src/core/memory-adapter.js';
import { createWorkspaceModel, STACKS_DIR, DESK_DIR } from '../src/core/workspace.js';

test('markdown: escapes html', () => {
  const out = renderMarkdown('<script>alert(1)</script>');
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
});

test('markdown: headings, emphasis, code, links', () => {
  const out = renderMarkdown('# Title\n\nSome **bold** and *em* and `code`.\n\n[site](https://x.y) [bad](javascript:alert(1))');
  assert.ok(out.includes('<h1>Title</h1>'));
  assert.ok(out.includes('<strong>bold</strong>'));
  assert.ok(out.includes('<em>em</em>'));
  assert.ok(out.includes('<code>code</code>'));
  assert.ok(out.includes('href="https://x.y"'));
  assert.ok(!out.includes('href="javascript:'));
});

test('markdown: lists and fenced code', () => {
  const src = '- a\n- b\n\n1. one\n2. two\n\n```js\nconst x = "<b>";\n```';
  const out = renderMarkdown(src);
  assert.ok(out.includes('<ul>'));
  assert.ok(out.includes('<ol>'));
  assert.ok(out.includes('<pre><code>'));
  assert.ok(out.includes('&lt;b&gt;'));
});

test('markdown: task checkboxes carry data-task index', () => {
  const out = renderMarkdown('- [ ] alpha\n- [x] beta');
  assert.equal((out.match(/data-task="\d+"/g) ?? []).length, 2);
  assert.ok(out.includes('checked'));
});

test('toggleTaskLine: check and uncheck the right line', () => {
  const body = 'intro\n\n- [ ] a\n- [ ] b\n- [x] c\n';
  assert.equal(toggleTaskLine(body, 1, true), 'intro\n\n- [ ] a\n- [x] b\n- [x] c\n');
  assert.equal(toggleTaskLine(body, 2, false), 'intro\n\n- [ ] a\n- [ ] b\n- [ ] c\n');
});

test('workspace: trashItem moves file to .desk/trash', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('work');
  const f = await ws.createItem(`${STACKS_DIR}/work`, 'note', 'Temp');
  await ws.trashItem(`${STACKS_DIR}/work`, f);
  const desk = await ws.readDesk();
  assert.equal(desk.stacks.find((s) => s.name === 'work').items.length, 0);
  const trashEntries = await adapter.listDir(`${DESK_DIR}/trash`);
  assert.equal(trashEntries.length, 1);
  const dirName = trashEntries[0].name;
  const files = await adapter.listDir(`${DESK_DIR}/trash/${dirName}`);
  assert.deepEqual(files.map((e) => e.name), [f]);
});

test('workspace: trashStack archives all files and cleans config', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('doomed');
  await ws.createItem(`${STACKS_DIR}/doomed`, 'note', 'One');
  await ws.createItem(`${STACKS_DIR}/doomed`, 'note', 'Two');
  await ws.trashStack('doomed');
  assert.equal((await ws.listStacks()).includes('doomed'), false);
  const config = await ws.readConfig();
  assert.equal(config.stacks['doomed'], undefined);
  const trashEntries = await adapter.listDir(`${DESK_DIR}/trash`);
  assert.equal(trashEntries.length, 1);
});

test('workspace: renameStack moves files and preserves config', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('old');
  const f = await ws.createItem(`${STACKS_DIR}/old`, 'note', 'Note');
  await ws.renameStack('old', 'new');
  assert.equal((await ws.listStacks()).includes('old'), false);
  const desk = await ws.readDesk();
  const newStack = desk.stacks.find((s) => s.name === 'new');
  assert.equal(newStack.items[0].fileName, f);
});

test('workspace: createItem dedupes file names', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('s');
  const f1 = await ws.createItem(`${STACKS_DIR}/s`, 'note', 'Same');
  const f2 = await ws.createItem(`${STACKS_DIR}/s`, 'note', 'Same');
  assert.notEqual(f1, f2);
  assert.equal(f2, 'same-2.md');
});
