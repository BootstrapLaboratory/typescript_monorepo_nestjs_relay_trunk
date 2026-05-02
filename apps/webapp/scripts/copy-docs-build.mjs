import { access, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const webappDir = path.resolve(path.dirname(scriptPath), "..");
const docsBuildDir = path.resolve(webappDir, "../docs/build");
const docsIndex = path.join(docsBuildDir, "index.html");
const docsOutDir = path.join(webappDir, "dist/docs");

try {
  await access(docsIndex);
} catch {
  console.error(
    [
      `Missing Docusaurus build output at ${docsBuildDir}.`,
      "Run `npm run rush -- build --to webapp` so Rush builds docs-site before webapp.",
    ].join(" "),
  );
  process.exit(1);
}

await rm(docsOutDir, { recursive: true, force: true });
await cp(docsBuildDir, docsOutDir, { recursive: true });

console.log(`Copied Docusaurus build to ${docsOutDir}`);
