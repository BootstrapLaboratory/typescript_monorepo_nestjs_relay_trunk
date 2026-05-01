import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileScenarioToXState, runScenarioXState } from "../src/xstate-runner.mjs";
import {
  createMemoryStore,
  createScriptedUi,
  createTinyScenario,
} from "./fixtures.mjs";

describe("XState-backed scenario runner spike", () => {
  it("runs the same tiny scenario through an XState machine", async () => {
    const store = createMemoryStore();
    const ui = createScriptedUi({
      ADMIN_TOKEN: "secret-token",
      PROJECT_ID: "demo",
      REGION: "europe-west4",
    });
    const result = await runScenarioXState(createTinyScenario(), {
      store,
      ui,
    });

    assert.equal(result.engine, "xstate");
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

  it("keeps XState vocabulary behind the compiler boundary", () => {
    const machine = compileScenarioToXState(createTinyScenario());

    assert.equal(machine.id, "tiny-cloud");
    assert.deepEqual(
      Object.keys(machine.states),
      ["step_0", "step_1", "complete"],
    );
  });
});
