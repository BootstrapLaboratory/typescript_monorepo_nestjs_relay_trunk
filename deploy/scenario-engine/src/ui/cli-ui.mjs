import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export function createCliUi(options = {}) {
  const input = options.input ?? stdin;
  const output = options.output ?? stdout;

  return {
    async showStep(step) {
      output.write(`\n== ${step.title ?? step.id} ==\n`);

      if (step.guide !== undefined && step.guide.trim() !== "") {
        output.write(`${step.guide.trim()}\n`);
      }
    },
    async collectInputs({ inputs }) {
      const values = {};

      for (const inputDefinition of inputs) {
        const label = inputDefinition.label ?? inputDefinition.name;
        values[inputDefinition.name] =
          inputDefinition.kind === "secret"
            ? await askSecret({ input, output, prompt: `${label}:` })
            : await askText({ input, output, prompt: `${label}:` });
      }

      return values;
    },
  };
}

async function askText({ input, output, prompt }) {
  if (input.isTTY !== true) {
    throw new Error(`Missing non-interactive value for ${prompt}`);
  }

  const reader = createInterface({ input, output });

  try {
    return await reader.question(`${prompt} `);
  } finally {
    reader.close();
  }
}

async function askSecret({ input, output, prompt }) {
  if (input.isTTY !== true || output.isTTY !== true) {
    return await askText({ input, output, prompt });
  }

  return await new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = input.isRaw;

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
    };

    const finish = () => {
      cleanup();
      output.write("\n");
      resolve(value);
    };

    const fail = (error) => {
      cleanup();
      output.write("\n");
      reject(error);
    };

    const onData = (buffer) => {
      for (const byte of buffer) {
        if (byte === 3) {
          fail(new Error("Interrupted."));
          return;
        }

        if (byte === 13 || byte === 10) {
          finish();
          return;
        }

        if (byte === 8 || byte === 127) {
          value = value.slice(0, -1);
          continue;
        }

        value += String.fromCharCode(byte);
      }
    };

    output.write(`${prompt} `);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}
