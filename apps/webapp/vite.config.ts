import path from "node:path";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [
    react(),
    babel({ plugins: ["babel-plugin-relay"] }),
  ];

  if (mode === "analyze") {
    plugins.push(
      visualizer({
        filename: "dist/bundle-treemap.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
      }) as PluginOption,
    );
    plugins.push(
      visualizer({
        filename: "dist/bundle-report.html",
        template: "list",
        gzipSize: true,
        brotliSize: true,
      }) as PluginOption,
    );
  }

  return {
    plugins,
    server: {
      fs: {
        allow: [path.resolve(__dirname, "../..")],
      },
    },
  };
});
