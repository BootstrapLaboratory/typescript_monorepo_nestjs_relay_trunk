import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createNodeBrowserTypeScriptConfig } from "@repo/eslint-config";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default createNodeBrowserTypeScriptConfig({ tsconfigRootDir });
