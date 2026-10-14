import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter } from '../src/core/memory-adapter.js';
import { createWorkspaceModel, STACKS_DIR, DESK_DIR } from '../src/core/workspace.js';

test('trash: manifest records origin, listTrash shows entries', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('doomed');
  const f = await ws.createItem(`${STACKS_DIR}/doomed`, 'note', 'Doomed note');
  await ws.trashItem(`${STACKS_DIR}/doomed`, f);

  const entries = await ws.listTrash();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].origin.kind, 'item');
  assert.equal(entries[0].origin.dir, `${STACKS_DIR}/doomed`);
  assert.deepEqual(entries[0].files, [f]);
});

test('trash: restore item back to its stack', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('work');
  const f = await ws.createItem(`${STACKS_DIR}/work`, 'note', 'Gone');
  await ws.trashItem(`${STACKS_DIR}/work`, f);
  assert.equal((await ws.readDesk()).stacks.find((s) => s.name === 'work').items.length, 0);

  const [entry] = await ws.listTrash();
  await ws.restoreTrashEntry(entry.dirName);
  const desk = await ws.readDesk();
  assert.equal(desk.stacks.find((s) => s.name === 'work').items.length, 1);
  assert.equal((await ws.listTrash()).length, 0);
});

test('trash: restore stack recreates folder and config entry', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('old-stack');
  await ws.createItem(`${STACKS_DIR}/old-stack`, 'note', 'One');
  await ws.trashStack('old-stack');
  assert.equal((await ws.listStacks()).includes('old-stack'), false);

  const [entry] = await ws.listTrash();
  assert.equal(entry.origin.kind, 'stack');
  assert.equal(entry.origin.name, 'old-stack');
  assert.equal(entry.files.length, 1);
  await ws.restoreTrashEntry(entry.dirName);

  const desk = await ws.readDesk();
  const stack = desk.stacks.find((s) => s.name === 'old-stack');
  assert.ok(stack);
  assert.equal(stack.items.length, 1);
  const config = await ws.readConfig();
  assert.ok(config.stacks['old-stack']);
});

test('trash: restore dedupes name collisions', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('work');
  const f = await ws.createItem(`${STACKS_DIR}/work`, 'note', 'Same');
  await ws.trashItem(`${STACKS_DIR}/work`, f);
  await ws.createItem(`${STACKS_DIR}/work`, 'note', 'Same'); // same-2.md now exists
  const [entry] = await ws.listTrash();
  await ws.restoreTrashEntry(entry.dirName);
  const desk = await ws.readDesk();
  const names = desk.stacks.find((s) => s.name === 'work').items.map((i) => i.fileName).sort();
  assert.equal(names.length, 2);
  assert.notEqual(names[0], names[1]);
});

test('trash: purge permanently removes the entry', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('work');
  const f = await ws.createItem(`${STACKS_DIR}/work`, 'note', 'X');
  await ws.trashItem(`${STACKS_DIR}/work`, f);
  const [entry] = await ws.listTrash();
  await ws.purgeTrashEntry(entry.dirName);
  assert.equal((await ws.listTrash()).length, 0);
  const trashDirs = await adapter.listDir(`${DESK_DIR}/trash`);
  assert.equal(trashDirs.length, 0);
});

test('agents: setStackAgents writes and clears config', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('work');
  await ws.setStackAgents('work', ['claw', 'researcher']);
  let config = await ws.readConfig();
  assert.deepEqual(config.stacks['work'].agents, ['claw', 'researcher']);
  await ws.setStackAgents('work', []);
  config = await ws.readConfig();
  assert.equal(config.stacks['work'].agents, undefined);
});
