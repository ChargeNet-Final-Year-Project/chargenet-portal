import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Direct API requests exercise the backend's credentialed CORS policy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
