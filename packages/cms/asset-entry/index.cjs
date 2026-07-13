'use strict';
const path = require('node:path');

/**
 * Absolute path to the built admin SPA (`dist/`) shipped inside this package.
 * `@sitesurge/server` serves the CMS admin + public SPA from here.
 */
function adminDistPath() {
  return path.join(__dirname, '..', 'dist');
}

module.exports = { adminDistPath };
