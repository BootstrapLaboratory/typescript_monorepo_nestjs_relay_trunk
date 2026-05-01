import {
  collectStepInputs,
  persistStepOutput,
  pickStepInput,
} from "./runtime.mjs";

export async function runScenarioPlain(scenario, options) {
  const storeValues = await options.store.load?.() ?? {};
  let values = {
    ...storeValues,
    ...(options.values ?? {}),
  };
  const events = [];

  for (const step of scenario.steps) {
    events.push(`plain:${step.id}:collect`);
    values = await collectStepInputs({
      step,
      ui: options.ui,
      values,
    });

    events.push(`plain:${step.id}:run`);
    const output = await step.run(pickStepInput(step, values));
    const persistedOutput = await persistStepOutput({
      output,
      step,
      store: options.store,
    });

    values = {
      ...values,
      ...persistedOutput,
    };
    events.push(`plain:${step.id}:done`);
  }

  return {
    engine: "plain",
    events,
    values,
  };
}
