import path from "node:path";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { visualizer } from "rollup-plugin-visualizer";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import {
  createPackageModuleChunkGroups,
  requireProductionBuildEnv,
} from "@omgjs/labkit-webapp-build-config";

const REQUIRED_PRODUCTION_ENV = [
  "VITE_GRAPHQL_HTTP",
  "VITE_GRAPHQL_WS",
] as const;

const VENDOR_CHUNK_GROUPS = createPackageModuleChunkGroups([
  {
    name: "react-vendor",
    priority: 30,
    packageNames: [
      "@radix-ui/react-slot",
      "@tanstack/react-router",
      "react",
      "react-dom",
      "scheduler",
    ],
  },
  {
    name: "relay-vendor",
    priority: 20,
    packageNames: ["graphql", "graphql-ws", "react-relay", "relay-runtime"],
  },
  {
    name: "styles-vendor",
    priority: 10,
    packageNames: ["@vanilla-extract/css", "@vanilla-extract/recipes"],
  },
]);

// https://vite.dev/config/
export default defineConfig((configEnv) => {
  requireProductionBuildEnv({
    appName: "webapp",
    command: configEnv.command,
    env: loadEnv(configEnv.mode, __dirname, ""),
    envFilePath: "apps/webapp/.env.production",
    extraHelp: [
      "GitHub Actions should map WEBAPP_VITE_GRAPHQL_HTTP/WS repository variables to VITE_GRAPHQL_HTTP/WS before the webapp build runs.",
    ],
    requiredEnvNames: REQUIRED_PRODUCTION_ENV,
  });

  const { mode } = configEnv;
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
            groups: VENDOR_CHUNK_GROUPS,
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
