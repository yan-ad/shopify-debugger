import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { shopifyDebugger } from "shopify-debugger/vite";

export default defineConfig({
  plugins: [
    react(),
    shopifyDebugger({
      appUrl: "/?shop=debug-store.myshopify.com&embedded=1",
    }),
  ],
});
