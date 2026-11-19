import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Static browser build: the renderer lives in src/ and is emitted to dist/.
export default defineConfig({
  root: 'src',
  publicDir: false,
  build: { outDir: '../dist', emptyOutDir: true },
  plugins: [vue({ template: { compilerOptions: { isCustomElement: tag => tag === 'selectedcontent' } } }), {
    name: 'development-content-policy',
    // Vite needs inline styles and HMR websockets only during `vite dev`; the build keeps the strict CSP.
    transformIndexHtml(html, context) {
      return context.server ? html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'").replace("connect-src 'none'", "connect-src 'self' ws:") : html
    }
  }]
})
