#!/usr/bin/env node
// Static import check: walks src/**, resolves every relative import and
// verifies the target file exists. Catches broken module paths before the
// browser does (e.g. './visual/scene.js' inside src/visual/).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) files.push(full);
  }
}
walk(join(ROOT, 'src'));

let bad = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const re = /(?:^|\n)\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text))) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue; // bare/importmap specifiers are fine
    const target = resolve(dirname(file), spec);
    if (!existsSync(target) || !statSync(target).isFile()) {
      console.error(`BROKEN IMPORT: ${file.replace(ROOT + '/', '')} -> ${spec}`);
      bad++;
    }
  }
}
if (bad) {
  console.error(`${bad} broken import(s) found`);
  process.exit(1);
}
console.log(`imports OK (${files.length} files checked)`);
