import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://heisenico.github.io',
  base: '/portfolio',
  i18n: {
    locales: ['pt', 'en', 'fr', 'es', 'zh', 'ja'],
    defaultLocale: 'pt',
    routing: { prefixDefaultLocale: false },
  },
});
