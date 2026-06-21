import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  server: {
    port: 8000,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons'],
          'supabase': ['@supabase/supabase-js'],
          'utils': ['xlsx', 'file-saver', 'axios', 'moment'],
        },
      },
    },
  },
});