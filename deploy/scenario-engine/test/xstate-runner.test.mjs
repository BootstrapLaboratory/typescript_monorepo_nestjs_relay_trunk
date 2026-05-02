import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compileScenarioToXState,
  runScenarioXState,
  startScenarioXState,
} from "../src/xstate-runner.mjs";
import { scenario, step } from "../src/define.mjs";
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
    assert.deepEqual(Object.keys(machine.states), [
      "step_0",
      "step_1",
      "complete",
    ]);
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
    assert.deepEqual(await store.loadValues(), {
      PROJECT_NUMBER: "fresh-123",
      SERVICE_URL: "https://fresh-123.fresh-region.example.test",
    });
  });

  it("skips steps whose outputs already exist in the state store", async () => {
    const calls = [];
    const scenario = createTinyScenario({
      onRun: (stepId) => calls.push(stepId),
    });
    const store = createMemoryStore({
      PROJECT_NUMBER: "demo-123",
    });
    const ui = createScriptedUi({
      REGION: "europe-west4",
    });

    const result = await runScenarioXState(scenario, {
      store,
      ui,
    });

    assert.deepEqual(calls, ["cloud.service"]);
    assert.deepEqual(
      ui.prompted.map((input) => input.name),
      ["REGION"],
    );
    assert.deepEqual(result.events, [
      "xstate:cloud.bootstrap:skip",
      "xstate:cloud.bootstrap:done",
      "xstate:cloud.service:collect",
      "xstate:cloud.service:run",
      "xstate:cloud.service:done",
    ]);
  });

  it("ignores failed snapshots and prompts for missing inputs again", async () => {
    const resumableScenario = scenario({
      id: "failed-snapshot-scenario",
      steps: [
        step({
          id: "cloud.bootstrap",
          outputs: ["PROJECT_NUMBER"],
          run: async () => ({
            PROJECT_NUMBER: "demo-123",
          }),
        }),
        step({
          id: "cloud.secret",
          inputs: {
            DATABASE_URL: {
              kind: "secret",
            },
          },
          outputs: ["READY"],
          run: async () => ({
            READY: "true",
          }),
        }),
      ],
    });
    const store = createMemoryStore({
      PROJECT_NUMBER: "demo-123",
    });
    await store.saveSnapshot({
      context: {
        events: ["xstate:cloud.bootstrap:done", "xstate:cloud.secret:collect"],
        values: {
          PROJECT_NUMBER: "demo-123",
        },
      },
      status: "error",
      value: {
        step_1: "running",
      },
    });
    const ui = createScriptedUi({
      DATABASE_URL: "postgres://app:secret@example.test/app",
    });

    const result = await runScenarioXState(resumableScenario, {
      store,
      ui,
    });

    assert.deepEqual(
      ui.prompted.map((input) => input.name),
      ["DATABASE_URL"],
    );
    assert.deepEqual(result.events.slice(0, 2), [
      "xstate:cloud.bootstrap:skip",
      "xstate:cloud.bootstrap:done",
    ]);
    assert.equal(result.values.READY, "true");
    assert.equal(store.snapshot, undefined);
  });

  it("resumes secret collection after interrupted input", async () => {
    const secretScenario = scenario({
      id: "interrupted-secret-scenario",
      steps: [
        step({
          id: "cloud.secret",
          inputs: {
            DATABASE_URL: {
              kind: "secret",
            },
          },
          outputs: ["READY"],
          run: async () => ({
            READY: "true",
          }),
        }),
      ],
    });
    const store = createMemoryStore();
    const interruptedUi = createScriptedUi({});
    interruptedUi.collectInputs = async () => {
      throw new Error("Interrupted.");
    };

    await assert.rejects(
      () =>
        runScenarioXState(secretScenario, {
          store,
          ui: interruptedUi,
        }),
      /Interrupted/,
    );
    assert.notEqual(store.snapshot?.status, "error");

    const ui = createScriptedUi({
      DATABASE_URL: "postgres://app:secret@example.test/app",
    });
    const result = await runScenarioXState(secretScenario, {
      store,
      ui,
    });

    assert.deepEqual(
      ui.prompted.map((input) => input.name),
      ["DATABASE_URL"],
    );
    assert.equal(result.values.READY, "true");
  });

  it("rejects when a step fails", async () => {
    const failingScenario = scenario({
      id: "failing-scenario",
      steps: [
        step({
          id: "failing.step",
          run: async () => {
            throw new Error("Step failed cleanly.");
          },
        }),
      ],
    });

    await assert.rejects(
      () =>
        runScenarioXState(failingScenario, {
          store: createMemoryStore(),
          ui: createScriptedUi({}),
        }),
      /Step failed cleanly/,
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
