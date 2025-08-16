import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss()],

  // Disable PostCSS plugins since we're using Tailwind Vite plugin
  css: {
    postcss: {
      plugins: [],
    },
  },

  // Define global variables for Node.js compatibility
  define: {
    global: 'globalThis',
  },

  // Resolve configuration to fix LangChain package issues
  resolve: {
    alias: {
      // Fix for @langchain/core package resolution issue
      // See: https://github.com/langchain-ai/langchainjs/discussions/5522
      '@langchain/core': path.resolve(
        __dirname,
        'node_modules/@langchain/core'
      ),
      '@langchain/google-genai': path.resolve(
        __dirname,
        'node_modules/@langchain/google-genai'
      ),
      '@langchain/langgraph': path.resolve(
        __dirname,
        'node_modules/@langchain/langgraph'
      ),
    },
  },

  // Optimize dependencies and handle Node.js modules
  optimizeDeps: {
    include: [
      '@langchain/core',
      '@langchain/google-genai',
      '@langchain/langgraph',
    ],
    exclude: ['@tauri-apps/api'],
  },

  // Configure build options for better compatibility
  build: {
    rollupOptions: {
      // Handle Node.js modules that don't work in browser
      external: id => {
        // Exclude Node.js built-in modules
        if (
          id.includes('node:') ||
          id.includes('async_hooks') ||
          id.includes('worker_threads')
        ) {
          return true;
        }
        return false;
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1421,
    strictPort: false,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
});
