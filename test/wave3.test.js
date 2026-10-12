import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter } from '../src/core/memory-adapter.js';
import { createWorkspaceModel, STACKS_DIR } from '../src/core/workspace.js';
import { tokenize, suggestStacks } from '../src/core/placement.js';
import { readActivityEntries, isEntryUnreviewed } from '../src/core/activity.js';

test('placement: tokenize filters stopwords and short words', () => {
  const tokens = tokenize('Buy flights to Osaka and the hotel');
  assert.deepEqual(tokens, ['flights', 'osaka', 'hotel']);
});

test('placement: suggests stack by shared terms and tags', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('japan-trip');
  await ws.createStack('work');
  await adapter.writeFile(
    `${STACKS_DIR}/japan-trip/itinerary.md`,
    '---\ntype: note\ntitle: Itinerary\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: [travel]\n---\n\nflights osaka hotels shrine plans\n',
  );
  await adapter.writeFile(
    `${STACKS_DIR}/work/q3.md`,
    '---\ntype: note\ntitle: Q3 plan\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: [work]\n---\n\nquarterly roadmap metrics deliverables\n',
  );
  const desk = await ws.readDesk();
  const item = {
    meta: { title: 'buy flights to Osaka', tags: [] },
    body: 'compare flights osaka prices\n',
  };
  const suggestions = suggestStacks(item, desk);
  assert.ok(suggestions.length >= 1);
  assert.equal(suggestions[0].stack, 'japan-trip');
  assert.ok(suggestions[0].score > 0);
  assert.ok(suggestions[0].reason.length > 0);
});

test('placement: tag match beats plain terms', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await ws.createStack('tagged');
  await ws.createStack('untagged');
  await adapter.writeFile(
    `${STACKS_DIR}/tagged/a.md`,
    '---\ntype: note\ntitle: A\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: [recipes]\n---\n\nsoup\n',
  );
  await adapter.writeFile(
    `${STACKS_DIR}/untagged/b.md`,
    '---\ntype: note\ntitle: B\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: []\n---\n\nrandom words here\n',
  );
  const desk = await ws.readDesk();
  const item = { meta: { title: 'soup ideas', tags: ['recipes'] }, body: 'pumpkin soup\n' };
  const suggestions = suggestStacks(item, desk);
  assert.equal(suggestions[0].stack, 'tagged');
});

test('activity: parses valid lines, skips malformed, sorts by ts', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  await adapter.writeFile(
    '.desk/activity/2026-06-01.log',
    [
      '{"ts":"2026-06-01T10:00:00Z","agent":"claw","stack":"work","action":"edit","files":["a.md"],"summary":"first"}',
      'not json at all',
      '{"ts":"2026-06-01T09:00:00Z","agent":"claw","stack":"work","action":"create","files":["b.md"],"summary":"zero"}',
      '',
    ].join('\n'),
  );
  const entries = await readActivityEntries(adapter);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].ts, '2026-06-01T09:00:00Z');
  assert.equal(entries[1].summary, 'first');
});

test('activity: unreviewed detection respects last reviewed ts', () => {
  assert.equal(isEntryUnreviewed({ ts: '2026-06-02T10:00:00Z' }, '2026-06-01T00:00:00Z'), true);
  assert.equal(isEntryUnreviewed({ ts: '2026-06-01T10:00:00Z' }, '2026-06-02T00:00:00Z'), false);
  assert.equal(isEntryUnreviewed({ ts: '2026-06-01T10:00:00Z' }, undefined), true);
});

test('review state: round-trip', async () => {
  const adapter = memoryAdapter();
  const ws = createWorkspaceModel(adapter);
  await ws.initialize();
  assert.deepEqual(await ws.readReviewState(), {});
  await ws.writeReviewState({ work: '2026-06-01T10:00:00Z' });
  assert.deepEqual(await ws.readReviewState(), { work: '2026-06-01T10:00:00Z' });
});
