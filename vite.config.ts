import { defineConfig } from 'vite'
import { postsPlugin } from './plugins/posts'

// GitHub Pages serves the site from /<repo>/, local dev serves from root.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/portfolio/' : '/',
  plugins: [postsPlugin()],
  build: { target: 'es2022' },
})
