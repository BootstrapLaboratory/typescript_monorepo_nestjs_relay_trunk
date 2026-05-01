import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runScenarioPlain } from "../src/plain-runner.mjs";
import {
  createMemoryStore,
  createScriptedUi,
  createTinyScenario,
} from "./fixtures.mjs";

describe("plain scenario runner spike", () => {
  it("runs a tiny scenario through the project-owned DSL", async () => {
    const store = createMemoryStore();
    const ui = createScriptedUi({
      ADMIN_TOKEN: "secret-token",
      PROJECT_ID: "demo",
      REGION: "europe-west4",
    });
    const result = await runScenarioPlain(createTinyScenario(), {
      store,
      ui,
    });

    assert.equal(result.engine, "plain");
    assert.equal(
      result.values.SERVICE_URL,
      "https://demo-123.europe-west4.example.test",
    );
    assert.deepEqual(
      ui.prompted.map((input) => input.name),
      ["ADMIN_TOKEN", "PROJECT_ID", "REGION"],
    );
    assert.deepEqual(
      store.saved.map((entry) => entry.stepId),
      ["cloud.bootstrap", "cloud.service"],
    );
  });
});
