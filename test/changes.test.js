import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter } from '../src/core/memory-adapter.js';
import { createWorkspaceModel, STACKS_DIR } from '../src/core/workspace.js';
import {
  scanItemFiles,
  loadIndex,
  saveIndex,
  buildBaselineFromScan,
  diffAgainstIndex,
  createIndexHooks,
  stackOfPath,
  itemDirOfPath,
  sha256Hex,
} from '../src/core/changes.js';

async function fixture() {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('work');
  await adapter.writeFile(`${STACKS_DIR}/work/a.md`, '---\ntype: note\ntitle: A\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: []\n---\n\nhello\n');
  await adapter.writeFile('inbox/b.md', '---\ntype: note\ntitle: B\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: []\n---\n\nworld\n');
  return { adapter, ws };
}

test('changes: scan fingerprints all item files only', async () => {
  const { adapter } = await fixture();
  const scan = await scanItemFiles(adapter);
  assert.equal(scan.size, 2);
  assert.ok(scan.has(`${STACKS_DIR}/work/a.md`));
  assert.ok(scan.has('inbox/b.md'));
  // .desk files are not tracked
  assert.ok(![...scan.keys()].some((p) => p.startsWith('.desk/')));
});

test('changes: baseline then external edit is detected', async () => {
  const { adapter } = await fixture();
  const scan1 = await scanItemFiles(adapter);
  const baseline = buildBaselineFromScan(scan1);
  await saveIndex(adapter, baseline);
  assert.deepEqual(await loadIndex(adapter), baseline);

  // External edit (agent or user, no app write).
  await adapter.writeFile(`${STACKS_DIR}/work/a.md`, '---\ntype: note\ntitle: A\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: []\n---\n\nhello WORLD\n');
  const scan2 = await scanItemFiles(adapter);
  const { changes, index } = diffAgainstIndex(scan2, baseline, []);
  assert.deepEqual(changes, [{ path: `${STACKS_DIR}/work/a.md`, kind: 'changed' }]);
  assert.equal(index.pending[`${STACKS_DIR}/work/a.md`].kind, 'changed');
  // Index files untouched by diff (only moves on app writes / mark seen).
  assert.equal(index.files[`${STACKS_DIR}/work/a.md`].fp, baseline.files[`${STACKS_DIR}/work/a.md`].fp);
});

test('changes: added and removed files are detected', async () => {
  const { adapter } = await fixture();
  const baseline = buildBaselineFromScan(await scanItemFiles(adapter));
  await adapter.writeFile('inbox/new.md', '---\ntype: note\ntitle: N\ncreated: x\nupdated: x\ntags: []\n---\n\nnew\n');
  await adapter.deleteFile('inbox/b.md');
  const { changes } = diffAgainstIndex(await scanItemFiles(adapter), baseline, []);
  const kinds = Object.fromEntries(changes.map((c) => [c.path, c.kind]));
  assert.equal(kinds['inbox/new.md'], 'added');
  assert.equal(kinds['inbox/b.md'], 'removed');
});

test('changes: reverted file clears pending', async () => {
  const { adapter } = await fixture();
  const baseline = buildBaselineFromScan(await scanItemFiles(adapter));
  const orig = await adapter.readFile(`${STACKS_DIR}/work/a.md`);
  await adapter.writeFile(`${STACKS_DIR}/work/a.md`, orig + 'edited\n');
  const step1 = diffAgainstIndex(await scanItemFiles(adapter), baseline, []);
  assert.equal(Object.keys(step1.index.pending).length, 1);
  await adapter.writeFile(`${STACKS_DIR}/work/a.md`, orig); // revert
  const step2 = diffAgainstIndex(await scanItemFiles(adapter), step1.index, []);
  assert.equal(step2.changes.length, 0);
  assert.deepEqual(step2.index.pending, {});
});

test('changes: agent attribution from activity log', async () => {
  const { adapter } = await fixture();
  const baseline = buildBaselineFromScan(await scanItemFiles(adapter));
  await adapter.writeFile(`${STACKS_DIR}/work/a.md`, 'edited by claw\n');
  const activity = [
    { ts: '2026-06-01T10:00:00Z', agent: 'claw', stack: 'work', action: 'edit', files: [`./${STACKS_DIR}/work/a.md`] },
  ];
  const { index } = diffAgainstIndex(await scanItemFiles(adapter), baseline, activity);
  assert.equal(index.pending[`${STACKS_DIR}/work/a.md`].agent, 'claw');
  // Unattributed change has agent: null
  await adapter.writeFile('inbox/b.md', 'edited by hand\n');
  const step2 = diffAgainstIndex(await scanItemFiles(adapter), index, activity);
  assert.equal(step2.index.pending['inbox/b.md'].agent, null);
});

test('changes: app writes through hooks do not show as external', async () => {
  const { adapter } = await fixture();
  const baseline = buildBaselineFromScan(await scanItemFiles(adapter));
  await saveIndex(adapter, baseline);

  const tracker = {
    index: await loadIndex(adapter),
    isReady: () => true,
    save: async () => saveIndex(adapter, tracker.index),
  };
  const hooks = createIndexHooks({
    getIndex: () => tracker.index,
    isReady: tracker.isReady,
    save: tracker.save,
  });
  const ws2 = createWorkspaceModel(adapter, hooks);
  // App-owned edit (writeItem bumps updated, writes via hook).
  const raw = await adapter.readFile(`${STACKS_DIR}/work/a.md`);
  const item = { meta: { type: 'note', title: 'A', created: '2026-01-01', updated: '2026-01-01', tags: [] }, body: 'hello\n' };
  // Simulate what the app does: writeItem on the same workspace model with hooks
  await ws2.writeItem(`${STACKS_DIR}/work`, 'a.md', item.meta, 'app edited body\n');
  void raw;

  const { changes } = diffAgainstIndex(await scanItemFiles(adapter), tracker.index, []);
  assert.equal(changes.length, 0);
});

test('changes: path helpers', async () => {
  assert.equal(stackOfPath('inbox/x.md'), 'Inbox');
  assert.equal(stackOfPath('stacks/work/x.md'), 'work');
  assert.equal(itemDirOfPath('stacks/work/x.md'), 'stacks/work');
  const { createHash } = await import('node:crypto');
  assert.equal(await sha256Hex('abc'), createHash('sha256').update('abc').digest('hex'));
});
