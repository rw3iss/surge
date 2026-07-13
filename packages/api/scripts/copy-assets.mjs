// Copy non-JS runtime assets into dist/ so that `node dist` resolves the
// __dirname-relative reads in db/migrator.ts + features/migrations.ts. `tsc`
// only emits .js — these SQL files must be copied alongside.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(pkgRoot, 'src');
const dist = join(pkgRoot, 'dist');

/** [from (relative to src), to (relative to dist)] */
const targets = [
  ['db/schema.sql', 'db/schema.sql'],
  ['db/migrations', 'db/migrations'],
];

for (const [from, to] of targets) {
  const d = join(dist, to);
  mkdirSync(dirname(d), { recursive: true });
  cpSync(join(src, from), d, { recursive: true });
  console.log(`copy-assets: ${from} -> dist/${to}`);
}
