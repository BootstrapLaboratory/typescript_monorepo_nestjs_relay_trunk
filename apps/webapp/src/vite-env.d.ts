/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_HTTP: string;
  readonly VITE_GRAPHQL_WS: string;
  readonly VITE_GRAPHQL_LOG_RECONNECTS?: string;
  readonly VITE_GRAPHQL_RECONNECT_WATCHDOG_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
