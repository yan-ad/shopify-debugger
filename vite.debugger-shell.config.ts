import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, "./src/debugger-shell"),
  build: {
    outDir: resolve(__dirname, "../../dist/debugger-shell"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "./src/debugger-shell/index.html"),
    },
  },
  server: {
    port: 5174,
    open: "/",
  },
});
