import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compileScenarioToXState,
  runScenarioXState,
  startScenarioXState,
} from "../src/xstate-runner.mjs";
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

  it("resumes from a persisted snapshot without re-running completed steps", async () => {
    const calls = [];
    const scenario = createTinyScenario({
      onRun: (stepId) => calls.push(stepId),
    });
    const store = createMemoryStore();
    const firstUi = createScriptedUi({
      ADMIN_TOKEN: "secret-token",
      PROJECT_ID: "demo",
    });
    const originalCollectInputs = firstUi.collectInputs;
    firstUi.collectInputs = async (request) => {
      if (request.inputs.some((input) => input.name === "REGION")) {
        return await new Promise(() => {});
      }

      return originalCollectInputs(request);
    };

    const execution = await startScenarioXState(scenario, {
      store,
      ui: firstUi,
    });

    await waitFor(() => JSON.stringify(store.snapshot).includes("step_1"));
    execution.stop();

    assert.deepEqual(calls, ["cloud.bootstrap"]);
    assert.notEqual(store.snapshot, undefined);
    assert.doesNotMatch(JSON.stringify(store.snapshot), /secret-token/);

    const secondUi = createScriptedUi({
      REGION: "europe-west4",
    });
    const result = await runScenarioXState(scenario, {
      store,
      ui: secondUi,
    });

    assert.deepEqual(calls, ["cloud.bootstrap", "cloud.service"]);
    assert.equal(
      result.values.SERVICE_URL,
      "https://demo-123.europe-west4.example.test",
    );
    assert.equal(store.snapshot, undefined);
  });

  it("can ignore a persisted snapshot and start fresh", async () => {
    const calls = [];
    const scenario = createTinyScenario({
      onRun: (stepId) => calls.push(stepId),
    });
    const store = createMemoryStore();
    const firstUi = createScriptedUi({
      ADMIN_TOKEN: "secret-token",
      PROJECT_ID: "demo",
    });
    const originalCollectInputs = firstUi.collectInputs;
    firstUi.collectInputs = async (request) => {
      if (request.inputs.some((input) => input.name === "REGION")) {
        return await new Promise(() => {});
      }

      return originalCollectInputs(request);
    };

    const execution = await startScenarioXState(scenario, {
      store,
      ui: firstUi,
    });

    await waitFor(() => JSON.stringify(store.snapshot).includes("step_1"));
    execution.stop();

    assert.notEqual(store.snapshot, undefined);

    const result = await runScenarioXState(scenario, {
      fresh: true,
      store,
      ui: createScriptedUi({
        ADMIN_TOKEN: "second-secret-token",
        PROJECT_ID: "demo",
        REGION: "europe-west4",
      }),
    });

    assert.deepEqual(calls, [
      "cloud.bootstrap",
      "cloud.bootstrap",
      "cloud.service",
    ]);
    assert.equal(
      result.values.SERVICE_URL,
      "https://demo-123.europe-west4.example.test",
    );
  });

  it("does not reuse stored values during a fresh run", async () => {
    const store = createMemoryStore({
      PROJECT_ID: "stored",
      PROJECT_NUMBER: "stored-123",
      REGION: "stored-region",
    });
    const ui = createScriptedUi({
      ADMIN_TOKEN: "secret-token",
      PROJECT_ID: "fresh",
      REGION: "fresh-region",
    });

    const result = await runScenarioXState(createTinyScenario(), {
      fresh: true,
      store,
      ui,
    });

    assert.deepEqual(
      ui.prompted.map((input) => input.name),
      ["ADMIN_TOKEN", "PROJECT_ID", "REGION"],
    );
    assert.equal(
      result.values.SERVICE_URL,
      "https://fresh-123.fresh-region.example.test",
    );
  });
});

async function waitFor(predicate) {
  const timeoutAt = Date.now() + 1000;

  while (Date.now() < timeoutAt) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
  }

  throw new Error("Timed out waiting for condition.");
}
