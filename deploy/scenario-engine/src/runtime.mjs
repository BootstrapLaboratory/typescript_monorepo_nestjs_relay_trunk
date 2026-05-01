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
