import { assign, createActor, fromPromise, setup } from "xstate";

import {
  collectStepInputs,
  loadStoreValues,
  persistStepOutput,
  pickStepInput,
} from "./runtime.mjs";

export function compileScenarioToXState(scenario, runtime = {}) {
  const states = {};

  scenario.steps.forEach((scenarioStep, index) => {
    const stepState = `step_${index}`;
    const nextState =
      index === scenario.steps.length - 1 ? "complete" : `step_${index + 1}`;

    states[stepState] = {
      initial: "collecting",
      states: {
        collecting: {
          invoke: {
            src: "collectInputs",
            input: ({ context }) => ({
              step: scenarioStep,
              values: context.values,
            }),
            onDone: {
              actions: assign({
                events: ({ context }) => [
                  ...context.events,
                  `xstate:${scenarioStep.id}:collect`,
                ],
                values: ({ context, event }) => ({
                  ...context.values,
                  ...event.output,
                }),
              }),
              target: "running",
            },
          },
        },
        running: {
          invoke: {
            src: "runStep",
            input: ({ context }) => ({
              step: scenarioStep,
              values: context.values,
            }),
            onDone: {
              actions: assign({
                events: ({ context }) => [
                  ...context.events,
                  `xstate:${scenarioStep.id}:run`,
                  `xstate:${scenarioStep.id}:done`,
                ],
                values: ({ context, event }) => ({
                  ...context.values,
                  ...event.output,
                }),
              }),
              target: "done",
            },
          },
        },
        done: {
          type: "final",
        },
      },
      onDone: nextState,
    };
  });

  return setup({
    actors: {
      collectInputs: fromPromise(async ({ input }) =>
        collectStepInputs({
          ...input,
          ui: runtime.ui,
        }),
      ),
      runStep: fromPromise(async ({ input }) => {
        const output = await input.step.run(
          pickStepInput(input.step, input.values),
        );

        return persistStepOutput({
          output,
          step: input.step,
          store: runtime.store,
        });
      }),
    },
  }).createMachine({
    id: scenario.id,
    context: ({ input }) => ({
      events: input.events ?? [],
      values: input.values,
    }),
    initial: scenario.steps.length === 0 ? "complete" : "step_0",
    output: ({ context }) => ({
      engine: "xstate",
      events: context.events,
      values: context.values,
    }),
    states: {
      ...states,
      complete: {
        type: "final",
      },
    },
  });
}

export async function runScenarioXState(scenario, options) {
  const execution = await startScenarioXState(scenario, options);
  return await execution.done;
}

export async function startScenarioXState(scenario, options) {
  const storeValues = await loadStoreValues(options.store);
  const restoredSnapshot =
    options.fresh === true ? undefined : await options.store.loadSnapshot?.();

  if (options.fresh === true) {
    await options.store.clearSnapshot?.({ scenario });
  }

  const actor = createActor(
    compileScenarioToXState(scenario, {
      store: options.store,
      ui: options.ui,
    }),
    {
      input: {
        values: {
          ...storeValues,
          ...(options.values ?? {}),
        },
      },
      ...(restoredSnapshot === undefined ? {} : { snapshot: restoredSnapshot }),
    },
  );

  let pendingSnapshotSave = Promise.resolve();
  let subscription;

  const saveSnapshot = (snapshot) => {
    if (snapshot.status !== "active") {
      return;
    }

    pendingSnapshotSave = pendingSnapshotSave.then(() =>
      options.store.saveSnapshot?.(createSerializableSnapshot(actor, scenario), {
        scenario,
      }),
    );
  };

  const done = new Promise((resolve, reject) => {
    subscription = actor.subscribe((snapshot) => {
      saveSnapshot(snapshot);

      if (snapshot.status === "done") {
        subscription.unsubscribe();
        pendingSnapshotSave
          .then(() => options.store.clearSnapshot?.({ scenario }))
          .then(() => resolve(snapshot.output), reject);
      }

      if (snapshot.status === "error") {
        subscription.unsubscribe();
        pendingSnapshotSave.then(() => reject(snapshot.error), reject);
      }
    });

    actor.start();
  });

  return {
    actor,
    done,
    stop() {
      subscription?.unsubscribe();
      actor.stop();
    },
  };
}

function createSerializableSnapshot(actor, scenario) {
  const snapshot = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
  const secretNames = collectSecretInputNames(scenario);

  redactSecretValues(snapshot, secretNames);

  return snapshot;
}

function collectSecretInputNames(scenario) {
  return new Set(
    scenario.steps.flatMap((step) =>
      Object.entries(step.inputs)
        .filter(([, definition]) => definition.kind === "secret")
        .map(([name]) => name),
    ),
  );
}

function redactSecretValues(value, secretNames) {
  if (Array.isArray(value)) {
    value.forEach((item) => redactSecretValues(item, secretNames));
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const key of Object.keys(value)) {
    if (secretNames.has(key)) {
      delete value[key];
      continue;
    }

    redactSecretValues(value[key], secretNames);
  }
}
