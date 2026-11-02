import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5180,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
