import { assertCatalogBuild } from '../scripts/catalog/verify-build.mjs';
import preact from '@astrojs/preact';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [preact(), {name:'catalog-build-guard',hooks:{'astro:build:start':()=>{assertCatalogBuild();}}}],
  output: 'static',
  site: 'https://dreamwheels.pro',
  build: {
    format: 'directory',
  },
});
