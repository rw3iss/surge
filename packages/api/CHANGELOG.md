# @sitesurge/server

## 0.1.4

### Patch Changes

- Real plugin marketplace: first-party plugins are bundled into the server (dist/plugins-catalog); marketplaceInstall copies a chosen plugin into the consumer's PLUGINS_DIR and runs the normal install lifecycle (replaces the 501 stub). Bundled catalog resolver + discoverCatalog in the plugin loader.
  - @sitesurge/admin@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies
  - @sitesurge/admin@0.1.3
  - @sitesurge/types@0.1.2
