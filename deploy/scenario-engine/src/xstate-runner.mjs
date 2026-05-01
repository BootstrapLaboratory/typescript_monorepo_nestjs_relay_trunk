import { assign, createActor, fromPromise, setup } from "xstate";

import {
  collectSecretInputNames,
  collectStepInputs,
  hasMissingStepInputs,
  hasStepOutputs,
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
      initial: "checking",
      states: {
        checking: {
          always: [
            {
              actions: assign({
                events: ({ context }) => [
                  ...context.events,
                  `xstate:${scenarioStep.id}:skip`,
                  `xstate:${scenarioStep.id}:done`,
                ],
              }),
              guard: ({ context }) => hasStepOutputs(scenarioStep, context.values),
              target: "done",
            },
            {
              target: "collecting",
            },
          ],
        },
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
          {
            store: runtime.store,
            step: input.step,
            ui: runtime.ui,
            values: input.values,
          },
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
  const storeValues =
    options.fresh === true ? {} : await loadStoreValues(options.store);
  const loadedSnapshot =
    options.fresh === true ? undefined : await options.store.loadSnapshot?.();
  const restoredSnapshot =
    options.fresh === true
      ? undefined
      : normalizeRestoredSnapshot(loadedSnapshot, scenario);

  if (options.fresh === true) {
    if (options.store.clear !== undefined) {
      await options.store.clear({ scenario });
    } else {
      await options.store.clearSnapshot?.({ scenario });
    }
  } else if (loadedSnapshot !== undefined && restoredSnapshot === undefined) {
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

    const persistedSnapshot = createSerializableSnapshot(actor, scenario);

    if (!isRestorableSnapshot(persistedSnapshot, scenario)) {
      return;
    }

    pendingSnapshotSave = pendingSnapshotSave.then(() =>
      options.store.saveSnapshot?.(persistedSnapshot, {
        scenario,
      }),
    );
  };

  const done = new Promise((resolve, reject) => {
    const rejectWithError = (error) => {
      subscription?.unsubscribe();
      pendingSnapshotSave.then(() => reject(error), reject);
    };

    subscription = actor.subscribe({
      error(error) {
        rejectWithError(error);
      },
      next(snapshot) {
        saveSnapshot(snapshot);

        if (snapshot.status === "done") {
          subscription.unsubscribe();
          pendingSnapshotSave
            .then(() => options.store.clearSnapshot?.({ scenario }))
            .then(() => resolve(snapshot.output), reject);
        }

        if (snapshot.status === "error") {
          rejectWithError(snapshot.error);
        }
      },
    });

    try {
      actor.start();
    } catch (error) {
      rejectWithError(error);
    }
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

function normalizeRestoredSnapshot(snapshot, scenario) {
  if (snapshot === undefined) {
    return undefined;
  }

  return isRestorableSnapshot(snapshot, scenario) ? snapshot : undefined;
}

function isRestorableSnapshot(snapshot, scenario) {
  if (snapshot?.status !== "active") {
    return false;
  }

  const runningStepIndex = getRunningStepIndex(snapshot);

  if (runningStepIndex === undefined) {
    return true;
  }

  const runningStep = scenario.steps[runningStepIndex];

  if (runningStep === undefined) {
    return false;
  }

  return !hasMissingStepInputs(runningStep, snapshot.context?.values ?? {});
}

function getRunningStepIndex(snapshot) {
  const value = snapshot.value;

  if (typeof value === "string") {
    return undefined;
  }

  if (value === null || typeof value !== "object") {
    return undefined;
  }

  for (const [stateName, childValue] of Object.entries(value)) {
    const match = stateName.match(/^step_(?<index>\d+)$/);

    if (match?.groups?.index === undefined) {
      continue;
    }

    if (childValue === "running") {
      return Number(match.groups.index);
    }
  }

  return undefined;
}

function redactSecretValues(value, secretNames) {
  if (Array.isArray(value)) {
    value.forEach((item) => redactSecretValues(item, secretNames));
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  if (isRecord(value.values)) {
    for (const secretName of secretNames) {
      delete value.values[secretName];
    }
  }

  for (const childValue of Object.values(value)) {
    redactSecretValues(childValue, secretNames);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
