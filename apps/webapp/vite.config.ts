import path from "node:path";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { visualizer } from "rollup-plugin-visualizer";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

function isPackageModule(moduleId: string, packageNames: string[]): boolean {
  return packageNames.some((packageName) => {
    const pnpmPackageName = packageName.replace("/", "+");

    return (
      moduleId.includes(`/node_modules/${packageName}/`) ||
      moduleId.includes(`/node_modules/.pnpm/${pnpmPackageName}@`)
    );
  });
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [
    vanillaExtractPlugin(),
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
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "react-vendor",
                priority: 30,
                test: (moduleId) =>
                  isPackageModule(moduleId, [
                    "@radix-ui/react-slot",
                    "@tanstack/react-router",
                    "react",
                    "react-dom",
                    "scheduler",
                  ]),
              },
              {
                name: "relay-vendor",
                priority: 20,
                test: (moduleId) =>
                  isPackageModule(moduleId, [
                    "graphql",
                    "graphql-ws",
                    "react-relay",
                    "relay-runtime",
                  ]),
              },
              {
                name: "styles-vendor",
                priority: 10,
                test: (moduleId) =>
                  isPackageModule(moduleId, [
                    "@vanilla-extract/css",
                    "@vanilla-extract/recipes",
                  ]),
              },
            ],
          },
        },
      },
    },
    server: {
      fs: {
        allow: [path.resolve(__dirname, "../..")],
      },
    },
  };
});
