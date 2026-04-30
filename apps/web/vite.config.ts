import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/health": "http://localhost:8080",
      "/api": "http://localhost:8080",
      "/v1": "http://localhost:8080"
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor libraries into their own chunks
          "vendor-react": ["react", "react-dom"],
          "vendor-xyflow": ["@xyflow/react"],
          "vendor-lucide": ["lucide-react"]
        }
      }
    }
  }
});
