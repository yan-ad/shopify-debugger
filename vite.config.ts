import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: fileURLToPath(new URL("src/index.ts", import.meta.url)),
        "app-bridge-react": fileURLToPath(
          new URL("src/app-bridge-react.ts", import.meta.url),
        ),
        vite: fileURLToPath(new URL("src/vite.ts", import.meta.url)),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "vite"],
    },
  },
});
