import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter } from '../src/core/memory-adapter.js';
import { createWorkspaceModel, STACKS_DIR } from '../src/core/workspace.js';

const NOTE = (title, body) =>
  `---\ntype: note\ntitle: ${title}\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: []\n---\n\n${body}\n`;

const CHECKLIST = (title, body) =>
  `---\ntype: checklist\ntitle: ${title}\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: []\n---\n\n${body}\n`;

test('nested stacks: readDesk returns one level with subStacks', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('Work');
  await ws.createStack('Client X', 'Work');
  await ws.createStack('Client Y', 'Work');
  await ws.createStack('Deep', 'Work/Client X');
  await adapter.writeFile(`${STACKS_DIR}/Work/Client X/brief.md`, NOTE('Brief', 'brief body'));
  await adapter.writeFile(`${STACKS_DIR}/Work/todo.md`, CHECKLIST('Work todo', '- [ ] root level task'));

  const root = await ws.readDesk();
  const work = root.stacks.find((s) => s.name === 'Work');
  assert.deepEqual(work.subStacks, ['Client X', 'Client Y']);
  assert.equal(work.path, 'Work');
  assert.equal(work.items.length, 1);
  assert.ok(!root.stacks.some((s) => s.name === 'Client X'), 'nested stacks stay hidden at root');

  const insideWork = await ws.readDesk('Work');
  assert.equal(insideWork.stackPath, 'Work');
  assert.ok(insideWork.stacks.some((s) => s.name === 'Client X'));
  assert.ok(insideWork.stacks.some((s) => s.name === 'Client Y'));

  const deep = await ws.readDesk('Work/Client X');
  assert.ok(deep.stacks.some((s) => s.name === 'Deep' && s.depth === 2));
  // Client X's items are attached to its card at the 'Work' level.
  const atWork = await ws.readDesk('Work');
  const cxCard = atWork.stacks.find((s) => s.name === 'Client X');
  assert.equal(cxCard.items[0].meta.title, 'Brief');
});

test('nested stacks: createItem works at depth', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('Work');
  await ws.createStack('Client X', 'Work');
  const f = await ws.createItem(`${STACKS_DIR}/Work/Client X`, 'checklist', 'Deep task');
  const desk = await ws.readDesk('Work');
  const cx = desk.stacks.find((s) => s.name === 'Client X');
  assert.equal(cx.items[0].fileName, f);
  assert.equal(cx.items[0].meta.type, 'checklist');
});

test('nested stacks: trashStack removes the whole tree with contents', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('Work');
  await ws.createStack('Client X', 'Work');
  await ws.createItem(`${STACKS_DIR}/Work/Client X`, 'note', 'Inside');
  await adapter.ensureDir(`${STACKS_DIR}/Work/Client X/nested-sub`);
  await adapter.writeFile(`${STACKS_DIR}/Work/Client X/nested-sub/keep.md`, NOTE('Keep', 'x'));
  await ws.trashStack('Work');
  const root = await ws.readDesk();
  assert.ok(!root.stacks.some((s) => s.name === 'Work'));
  const [entry] = await ws.listTrash();
  assert.equal(entry.origin.kind, 'stack');
  assert.equal(entry.origin.name, 'Work');
  const trashRoot = await adapter.listDir('.desk/trash');
  assert.equal(trashRoot.length, 1);
  const files = await adapter.listDir(`.desk/trash/${trashRoot[0].name}/Client X`);
  assert.ok(files.some((f) => f.name === 'nested-sub'), 'nested sub-stack folder preserved in trash');
});

test('nested stacks: createStack returns relative path and registers config', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  const rel = await ws.createStack('Sub', 'Parent');
  assert.equal(rel, 'Parent/Sub');
  const config = await ws.readConfig();
  assert.ok(config.stacks['Parent/Sub']);
});
