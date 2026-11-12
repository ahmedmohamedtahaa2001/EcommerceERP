import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/v1": "http://localhost:3001",
      "/healthz": "http://localhost:3001",
      "/readyz": "http://localhost:3001",
    },
  },
});
