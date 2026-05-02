import path from "node:path";
import { defineConfig, loadEnv, type ConfigEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { visualizer } from "rollup-plugin-visualizer";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

const REQUIRED_PRODUCTION_ENV = [
  "VITE_GRAPHQL_HTTP",
  "VITE_GRAPHQL_WS",
] as const;

function isPackageModule(moduleId: string, packageNames: string[]): boolean {
  return packageNames.some((packageName) => {
    const pnpmPackageName = packageName.replace("/", "+");

    return (
      moduleId.includes(`/node_modules/${packageName}/`) ||
      moduleId.includes(`/node_modules/.pnpm/${pnpmPackageName}@`)
    );
  });
}

function requireProductionBuildEnv({ command, mode }: ConfigEnv): void {
  if (command !== "build") {
    return;
  }

  const env = loadEnv(mode, __dirname, "");
  const missingEnvNames = REQUIRED_PRODUCTION_ENV.filter((name) => {
    const value = env[name];

    return value === undefined || value.trim().length === 0;
  });

  if (missingEnvNames.length === 0) {
    return;
  }

  throw new Error(
    [
      `Missing required production webapp environment: ${missingEnvNames.join(", ")}.`,
      "Set these variables in the build environment or in apps/webapp/.env.production.",
      "GitHub Actions should map WEBAPP_VITE_GRAPHQL_HTTP/WS repository variables to VITE_GRAPHQL_HTTP/WS before the webapp build runs.",
    ].join(" "),
  );
}

// https://vite.dev/config/
export default defineConfig((configEnv) => {
  requireProductionBuildEnv(configEnv);

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
