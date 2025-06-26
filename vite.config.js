import {defineConfig, transformWithEsbuild} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "tailwindcss";
import netlify from "@netlify/vite-plugin";
// allow this host devserver-main--re360.netlify.app
// to be used in the vite dev server

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: 'devserver-main--re360.netlify.app',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/socket.io/, '/socket.io')
      }
    }
  },
  plugins: [
    netlify(),
    {
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/))  return null

        // Use the exposed transform from vite, instead of directly
        // transforming with esbuild
        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic',
        })
      },
    },
      react(),
    tailwindcss()],

  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      }
    }
  }
})
