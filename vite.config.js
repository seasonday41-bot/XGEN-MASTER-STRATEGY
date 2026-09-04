import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        analyzer: resolve(process.cwd(), 'analyzer.html'),
      },
    },
  },
})
