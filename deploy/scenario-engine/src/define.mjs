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
  return {
    ...options,
    kind,
    optional: options.optional === true,
    optional() {
      return {
        ...this,
        optional: true,
      };
    },
  };
}
