export function pickStepInput(step, values) {
  const input = {};

  for (const name of Object.keys(step.inputs)) {
    const value = values[name];

    if (value !== undefined && value !== "") {
      input[name] = value;
    }
  }

  return input;
}

export function missingStepInputs(step, values) {
  return Object.entries(step.inputs)
    .filter(([name, definition]) => {
      if (definition.optional === true) {
        return false;
      }

      const value = values[name];
      return value === undefined || value === "";
    })
    .map(([name, definition]) => ({
      ...definition,
      name,
    }));
}

export function hasMissingStepInputs(step, values) {
  return missingStepInputs(step, values).length > 0;
}

export function hasStepOutputs(step, values) {
  return (
    step.outputs.length > 0 &&
    step.outputs.every((name) => {
      const value = values[name];
      return value !== undefined && value !== "";
    })
  );
}

export async function collectStepInputs({ step, ui, values }) {
  await ui.showStep?.(step);

  const missing = missingStepInputs(step, values);

  if (missing.length === 0) {
    return values;
  }

  const prompted = await ui.collectInputs({
    inputs: missing,
    step,
    values,
  });

  return {
    ...values,
    ...prompted,
  };
}

export async function persistStepOutput({ output, step, store }) {
  if (output === undefined || output === null) {
    return {};
  }

  const outputObject = { ...output };
  await store.saveOutputs?.(outputObject, { step });
  return outputObject;
}

export async function loadStoreValues(store) {
  return await store.loadValues?.() ?? await store.load?.() ?? {};
}

export function collectSecretInputNames(scenario) {
  return new Set(
    scenario.steps.flatMap((step) =>
      Object.entries(step.inputs)
        .filter(([, definition]) => definition.kind === "secret")
        .map(([name]) => name),
    ),
  );
}

export function redactScenarioValues(scenario, values) {
  const secretNames = collectSecretInputNames(scenario);
  const redacted = {};

  for (const [name, value] of Object.entries(values)) {
    if (secretNames.has(name)) {
      continue;
    }

    redacted[name] = value;
  }

  return redacted;
}
