import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    const fromFile = loadEnv(mode, process.cwd(), 'VITE_');
    const apiBase = process.env.VITE_API_BASE_URL || fromFile.VITE_API_BASE_URL || '';
    if (!apiBase.trim() || /localhost|127\.0\.0\.1/.test(apiBase)) {
      throw new Error('VITE_API_BASE_URL must be the deployed API origin for a production build.');
    }
  }

  return {
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Recharts (largest single dependency)
          'vendor-recharts': ['recharts'],
          // Lucide icons
          'vendor-lucide': ['lucide-react'],
          // Axios
          'vendor-axios': ['axios'],
        },
      },
    },
  },
};
});
