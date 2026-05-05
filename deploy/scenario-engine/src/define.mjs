export function text(options = {}) {
  return inputDefinition("text", options);
}

export function secret(options = {}) {
  return inputDefinition("secret", options);
}

export function step(definition) {
  return {
    ...definition,
    inputs: definition.inputs ?? {},
    outputs: definition.outputs ?? [],
  };
}

export function scenario(definition) {
  return {
    ...definition,
    steps: definition.steps ?? [],
  };
}

function inputDefinition(kind, options) {
  const definition = {
    ...options,
    kind,
  };

  if (options.optional === true) {
    return {
      ...definition,
      optional: true,
    };
  }

  return {
    ...definition,
    optional() {
      return {
        ...definition,
        optional: true,
      };
    },
  };
}
