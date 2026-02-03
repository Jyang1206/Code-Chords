import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use a relative base so the app can be hosted under a subpath (e.g. GitHub Pages)
  // If you know the repo name, you can replace "./" with `"/<repo-name>/"`.
  base: "./",
})

