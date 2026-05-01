import { homedir } from "node:os";
import { resolve } from "node:path";
import { stderr, stdout } from "node:process";

import { formatCompletionSections } from "./completion-summary.mjs";
import { redactScenarioValues } from "./runtime.mjs";
import { createJsonFileStore } from "./stores/json-file-store.mjs";
import { createCliUi } from "./ui/cli-ui.mjs";
import { runScenarioXState } from "./xstate-runner.mjs";

export async function runScenarioCli(options) {
  const {
    argv = process.argv.slice(2),
    scenarios,
    stderr: errorOutput = stderr,
    stdout: output = stdout,
    usage = "node src/cli.mjs",
  } = options;

  try {
    const parsed = parseArguments(argv);

    if (parsed.help === true) {
      printHelp(output, { scenarios, usage });
      return 0;
    }

    const createScenario = scenarios[parsed.command];

    if (createScenario === undefined) {
      printHelp(output, { scenarios, usage });
      return 1;
    }

    const scenario = createScenario();
    const statePath =
      parsed.statePath ??
      resolve(
        homedir(),
        ".config",
        "beltapp",
        "deploy-scenarios",
        `${scenario.id}.json`,
      );

    const result = await runScenarioXState(scenario, {
      fresh: parsed.fresh,
      store: createJsonFileStore(statePath),
      ui: createCliUi(),
      values: parsed.values,
    });

    output.write("\nScenario complete.\n");
    output.write(`State: ${statePath}\n`);
    output.write("Known values:\n");

    for (const [name, value] of Object.entries(
      redactScenarioValues(scenario, result.values),
    ).sort(([left], [right]) => left.localeCompare(right))) {
      output.write(`  ${name}=${value}\n`);
    }

    const completionSummary = formatCompletionSections(
      scenario,
      redactScenarioValues(scenario, result.values),
    );

    if (completionSummary !== "") {
      output.write(`\n${completionSummary}\n`);
    }

    return 0;
  } catch (error) {
    errorOutput.write(`${error.message}\n`);
    return 1;
  }
}

function parseArguments(args) {
  const options = {
    command: undefined,
    fresh: false,
    help: false,
    statePath: undefined,
    values: {},
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--fresh") {
      options.fresh = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument === "--state") {
      options.statePath = resolve(requiredNextValue(args, index, argument));
      index += 1;
      continue;
    }

    if (argument === "--var") {
      const [name, value] = parseVariable(
        requiredNextValue(args, index, argument),
      );
      options.values[name] = value;
      index += 1;
      continue;
    }

    if (options.command === undefined) {
      options.command = argument;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function requiredNextValue(args, index, argument) {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${argument} requires a value.`);
  }

  return value;
}

function parseVariable(value) {
  const separatorIndex = value.indexOf("=");

  if (separatorIndex <= 0) {
    throw new Error("--var requires KEY=value.");
  }

  return [value.slice(0, separatorIndex), value.slice(separatorIndex + 1)];
}

function printHelp(output, { scenarios, usage }) {
  output.write(`Usage: ${usage} <scenario> [options]

Scenarios:
${Object.keys(scenarios)
  .sort()
  .map((name) => `  ${name}`)
  .join("\n")}

Options:
  --fresh              Ignore saved progress and start from the first step.
  --state <path>       Use a specific JSON state file.
  --var KEY=value      Provide an input value non-interactively.
  -h, --help           Show this help.
`);
}
