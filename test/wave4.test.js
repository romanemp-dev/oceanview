import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchItems } from '../src/core/search.js';
import { parseSlides, slidesCount } from '../src/core/slides.js';

const desk = {
  stacks: [
    {
      name: 'work',
      items: [
        {
          fileName: 'q3.md',
          meta: { title: 'Q3 plan' },
          body: 'The roadmap mentions osaka office launch and metrics.',
          tasks: [],
        },
        {
          fileName: 'random.md',
          meta: { title: 'Random' },
          body: 'nothing relevant here',
          tasks: [],
        },
      ],
    },
  ],
  inboxItems: [
    { fileName: 'cap.md', meta: { title: 'buy flights to Osaka' }, body: 'compare prices', tasks: [] },
  ],
};

test('search: title match ranks above body match', () => {
  const results = searchItems(desk, 'osaka');
  assert.equal(results.length, 2);
  assert.equal(results[0].fileName, 'cap.md');
  assert.ok(results[0].score > results[1].score);
  assert.equal(results[0].stackName, 'Inbox');
});

test('search: multi-token and phrase matching, snippet', () => {
  const results = searchItems(desk, 'office metrics');
  assert.equal(results[0].fileName, 'q3.md');
  assert.ok(results[0].snippet.toLowerCase().includes('osaka office'));
  const none = searchItems(desk, 'zebra');
  assert.equal(none.length, 0);
  const short = searchItems(desk, 'o');
  assert.equal(short.length, 0);
});

test('slides: parse separators, front-matter options, count', () => {
  const src = '---\ntheme: dark\n---\n\n# Slide one\n\n- a\n- b\n\n---\n\n# Slide two\n\ncontent\n';
  const { options, slides } = parseSlides(src);
  assert.equal(options.theme, 'dark');
  assert.equal(slides.length, 2);
  assert.ok(slides[0].includes('# Slide one'));
  assert.ok(slides[1].includes('# Slide two'));
  assert.equal(slidesCount(src), 2);
});

test('slides: handles empty body and no separators', () => {
  assert.deepEqual(parseSlides('just text').slides, ['just text']);
  assert.equal(parseSlides('   \n\n  ').slides.length, 0);
});
