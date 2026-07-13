import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the built admin SPA (`dist/`) shipped inside this package.
 * `@sitesurge/server` serves the CMS admin + public SPA from here.
 */
export function adminDistPath() {
  return path.join(here, '..', 'dist');
}
