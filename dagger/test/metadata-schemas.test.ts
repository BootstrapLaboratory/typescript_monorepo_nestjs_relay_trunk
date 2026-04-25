import { Ajv2020, type AnySchema, type ErrorObject } from "ajv/dist/2020.js";
import * as assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

type SchemaCase = {
  metadataPaths: string[];
  schemaPath: string;
};

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDirectory, "../..");

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function readYaml(relativePath: string): Promise<unknown> {
  return parseYaml(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function listYamlFiles(relativeDirectory: string): Promise<string[]> {
  const entries = await readdir(path.join(repoRoot, relativeDirectory));

  return entries
    .filter((entry) => entry.endsWith(".yaml"))
    .sort()
    .map((entry) => `${relativeDirectory}/${entry}`);
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined) {
  return (errors ?? [])
    .map((error) => {
      const pathPrefix = error.instancePath ? `${error.instancePath} ` : "";
      return `${pathPrefix}${error.message ?? "failed schema validation"}`;
    })
    .join("\n");
}

test("committed Dagger metadata files satisfy their JSON schemas", async () => {
  const schemaCases: SchemaCase[] = [
    {
      metadataPaths: [".dagger/deploy/services-mesh.yaml"],
      schemaPath: ".dagger/schemas/deploy-services-mesh.schema.json",
    },
    {
      metadataPaths: await listYamlFiles(".dagger/deploy/targets"),
      schemaPath: ".dagger/schemas/deploy-target.schema.json",
    },
    {
      metadataPaths: await listYamlFiles(".dagger/package/targets"),
      schemaPath: ".dagger/schemas/package-target.schema.json",
    },
    {
      metadataPaths: [".dagger/toolchain-images/providers.yaml"],
      schemaPath: ".dagger/schemas/toolchain-image-providers.schema.json",
    },
    {
      metadataPaths: [".dagger/rush-cache/providers.yaml"],
      schemaPath: ".dagger/schemas/rush-cache-providers.schema.json",
    },
    {
      metadataPaths: await listYamlFiles(".dagger/validate/targets"),
      schemaPath: ".dagger/schemas/validation-target.schema.json",
    },
  ];

  for (const schemaCase of schemaCases) {
    const ajv = new Ajv2020({ allErrors: true });
    const validate = ajv.compile(
      (await readJson(schemaCase.schemaPath)) as AnySchema,
    );

    for (const metadataPath of schemaCase.metadataPaths) {
      const valid = validate(await readYaml(metadataPath));

      assert.ok(
        valid,
        `${metadataPath} must satisfy ${schemaCase.schemaPath}\n${formatSchemaErrors(validate.errors)}`,
      );
    }
  }
});
