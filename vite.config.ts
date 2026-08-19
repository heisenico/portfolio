import { defineConfig } from 'vite'

// GitHub Pages serves the site from /<repo>/, local dev serves from root.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/portfolio/' : '/',
  build: { target: 'es2022' },
})
