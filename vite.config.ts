import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Replit serves the dev preview from its own domains; Vite refuses unknown hosts otherwise.
    allowedHosts: [".replit.dev", ".repl.co", ".replit.app", "localhost"],
  },
  build: {
    target: "es2022",
    // Three.js is one large module; this only silences the size warning.
    chunkSizeWarningLimit: 1500,
  },
});
