// Package a plugin folder into a distributable .zip that the admin
// "Upload .zip" button (POST /api/v1/plugins/upload) accepts.
//
// Usage:
//   node scripts/pack-plugin.mjs <plugin-dir> [outDir]
//   node scripts/pack-plugin.mjs plugins/pageloop
//   node scripts/pack-plugin.mjs plugins/pageloop dist-plugins
//
// The zip contains the plugin folder's files with `plugin.json` at the
// ROOT (installFromZip also accepts it one level down). Excludes runtime
// junk (.data/, .gitignore, node_modules, existing *.zip). The `client/`
// vendor bundle IS included when present so the zip is self-contained —
// the plugin's install() hook then skips the network download.
import AdmZip from 'adm-zip';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const EXCLUDE_TOP = new Set(['.data', '.git', '.gitignore', 'node_modules']);

const pluginArg = process.argv[2];
if (!pluginArg) {
  console.error('Usage: node scripts/pack-plugin.mjs <plugin-dir> [outDir]');
  process.exit(1);
}
const pluginDir = resolve(process.cwd(), pluginArg);
const outDir = resolve(process.cwd(), process.argv[3] ?? '.');

const manifestPath = join(pluginDir, 'plugin.json');
if (!existsSync(manifestPath)) {
  console.error(`No plugin.json in ${pluginDir}`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!manifest.name) {
  console.error('plugin.json is missing "name"');
  process.exit(1);
}

const zip = new AdmZip();
// Add the folder, filtering top-level junk. adm-zip has no per-entry
// filter on addLocalFolder, so add each top-level entry explicitly.
for (const entry of readdirSync(pluginDir, { withFileTypes: true })) {
  if (EXCLUDE_TOP.has(entry.name) || entry.name.endsWith('.zip')) continue;
  const abs = join(pluginDir, entry.name);
  if (entry.isDirectory()) zip.addLocalFolder(abs, entry.name);
  else zip.addLocalFile(abs);
}

mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${manifest.name}-${manifest.version ?? '0.0.0'}.zip`);
zip.writeZip(outFile);

const kb = (statSync(outFile).size / 1024).toFixed(0);
const hasBundle = existsSync(join(pluginDir, 'client'));
console.log(`Packed ${basename(pluginDir)} → ${outFile} (${kb} KB)`);
console.log(`  name=${manifest.name} version=${manifest.version} bundle=${hasBundle ? 'included' : 'downloaded at install'}`);
console.log('  Upload it in Admin → Plugins → "Upload .zip", then Install → configure → Enable.');
