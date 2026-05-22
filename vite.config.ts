import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "unplugin-dts/vite";

export default defineConfig({
  plugins: [dts()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "app-bridge-react": resolve(__dirname, "src/app-bridge-react.ts"),
        vite: resolve(__dirname, "src/vite.ts"),
      },
      name: "ShopifyDebuggerVite",
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        format === "es" ? `${entryName}.mjs` : `${entryName}.js`,
    },
    cssMinify: true,
    cssCodeSplit: true,
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        index: resolve(__dirname, "src/index.ts"),
        "app-bridge-react": resolve(__dirname, "src/app-bridge-react.ts"),
        vite: resolve(__dirname, "src/vite.ts"),
        dashboard: resolve(__dirname, "src/style.css"), // 👈 explicit CSS entry
      },
      output: {
        exports: "named",
        assetFileNames: (assetInfo) => {
          const names = assetInfo.names || [];
          if (names.includes("style.css")) return "style.css";
          return names[0] || "assets/[name].[ext]";
        },
        globals: {
          react: "React",
          "react/jsx-runtime": "ReactJSXRuntime",
          vite: "Vite",
        },
      },
      external: ["react", "react/jsx-runtime", "vite"],
    },
  },
});
