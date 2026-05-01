import { assign, createActor, fromPromise, setup } from "xstate";

import {
  collectStepInputs,
  persistStepOutput,
  pickStepInput,
} from "./runtime.mjs";

export function compileScenarioToXState(scenario) {
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
              ui: context.ui,
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
              store: context.store,
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
        collectStepInputs(input),
      ),
      runStep: fromPromise(async ({ input }) => {
        const output = await input.step.run(
          pickStepInput(input.step, input.values),
        );

        return persistStepOutput({
          output,
          step: input.step,
          store: input.store,
        });
      }),
    },
  }).createMachine({
    id: scenario.id,
    context: ({ input }) => ({
      events: [],
      store: input.store,
      ui: input.ui,
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
  const storeValues = await options.store.load?.() ?? {};
  const actor = createActor(compileScenarioToXState(scenario), {
    input: {
      store: options.store,
      ui: options.ui,
      values: {
        ...storeValues,
        ...(options.values ?? {}),
      },
    },
  });

  return await new Promise((resolve, reject) => {
    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.status === "done") {
        subscription.unsubscribe();
        resolve(snapshot.output);
      }

      if (snapshot.status === "error") {
        subscription.unsubscribe();
        reject(snapshot.error);
      }
    });

    actor.start();
  });
}
