import { scenario, secret, step, text } from "../src/define.mjs";

export function createTinyScenario(options = {}) {
  return scenario({
    id: "tiny-cloud",
    title: "Tiny Cloud Scenario",
    steps: [
      step({
        guide: "Collect project details and return a generated project number.",
        id: "cloud.bootstrap",
        inputs: {
          ADMIN_TOKEN: secret(),
          PROJECT_ID: text(),
        },
        outputs: ["PROJECT_NUMBER"],
        title: "Bootstrap fake cloud",
        run: async (input) => {
          options.onRun?.("cloud.bootstrap", input);

          return {
            PROJECT_NUMBER: `${input.PROJECT_ID}-123`,
          };
        },
      }),
      step({
        guide: "Use generated project number plus a region to create a URL.",
        id: "cloud.service",
        inputs: {
          PROJECT_NUMBER: text(),
          REGION: text(),
        },
        outputs: ["SERVICE_URL"],
        title: "Create fake service",
        run: async (input) => {
          options.onRun?.("cloud.service", input);

          return {
            SERVICE_URL: `https://${input.PROJECT_NUMBER}.${input.REGION}.example.test`,
          };
        },
      }),
    ],
  });
}

export function createMemoryStore(initialValues = {}) {
  const saved = [];
  const snapshots = [];
  let snapshot;
  let values = { ...initialValues };

  return {
    get snapshot() {
      return snapshot;
    },
    saved,
    snapshots,
    async clear() {
      snapshot = undefined;
      values = {};
    },
    async clearSnapshot() {
      snapshot = undefined;
    },
    async loadValues() {
      return values;
    },
    async loadSnapshot() {
      return snapshot;
    },
    async saveSnapshot(nextSnapshot) {
      snapshot = nextSnapshot;
      snapshots.push(nextSnapshot);
    },
    async saveOutputs(output, metadata) {
      values = {
        ...values,
        ...output,
      };
      saved.push({
        output,
        stepId: metadata.step.id,
      });
    },
  };
}

export function createScriptedUi(values) {
  const continued = [];
  const prompted = [];
  const shownSteps = [];

  return {
    continued,
    prompted,
    shownSteps,
    async showStep(step) {
      shownSteps.push(step.id);
    },
    async collectInputs({ inputs }) {
      const collected = {};

      for (const input of inputs) {
        prompted.push({
          kind: input.kind,
          name: input.name,
        });
        collected[input.name] = values[input.name];
      }

      return collected;
    },
    async waitForContinue(request) {
      continued.push(request);
    },
  };
}
