import preact from '@astrojs/preact';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [preact()],
  output: 'static',
  site: 'https://dreamwheels.pro',
  build: {
    format: 'directory',
  },
});
