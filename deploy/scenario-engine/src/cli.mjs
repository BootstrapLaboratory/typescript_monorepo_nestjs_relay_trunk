#!/usr/bin/env node
import { homedir } from "node:os";
import { resolve } from "node:path";
import { exit, stdout } from "node:process";

import {
  createCloudRunCloudflareNeonUpstashScenario,
} from "../../scenarios/cloudrun-cloudflare-neon-upstash/scenario.mjs";
import { formatCompletionSections } from "./completion-summary.mjs";
import { createTinyScenario } from "./demo/tiny-scenario.mjs";
import { redactScenarioValues } from "./runtime.mjs";
import { createJsonFileStore } from "./stores/json-file-store.mjs";
import { createCliUi } from "./ui/cli-ui.mjs";
import { runScenarioXState } from "./xstate-runner.mjs";

const scenarios = {
  "cloudrun-cloudflare-neon-upstash":
    createCloudRunCloudflareNeonUpstashScenario,
  demo: createTinyScenario,
};

try {
  const options = parseArguments(process.argv.slice(2));

  if (options.help === true) {
    printHelp();
    exit(0);
  }

  const createScenario = scenarios[options.command];

  if (createScenario === undefined) {
    printHelp();
    exit(1);
  }

  const scenario = createScenario();
  const statePath =
    options.statePath ??
    resolve(
      homedir(),
      ".config",
      "beltapp",
      "deploy-scenarios",
      `${scenario.id}.json`,
    );

  const result = await runScenarioXState(scenario, {
    fresh: options.fresh,
    store: createJsonFileStore(statePath),
    ui: createCliUi(),
    values: options.values,
  });

  stdout.write("\nScenario complete.\n");
  stdout.write(`State: ${statePath}\n`);
  stdout.write("Known values:\n");

  for (const [name, value] of Object.entries(
    redactScenarioValues(scenario, result.values),
  ).sort(([left], [right]) => left.localeCompare(right))) {
    stdout.write(`  ${name}=${value}\n`);
  }

  const completionSummary = formatCompletionSections(
    scenario,
    redactScenarioValues(scenario, result.values),
  );

  if (completionSummary !== "") {
    stdout.write(`\n${completionSummary}\n`);
  }
} catch (error) {
  console.error(error.message);
  exit(1);
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

function printHelp() {
  stdout.write(`Usage: node src/cli.mjs <scenario> [options]

Scenarios:
  cloudrun-cloudflare-neon-upstash
  demo

Options:
  --fresh              Ignore saved progress and start from the first step.
  --state <path>       Use a specific JSON state file.
  --var KEY=value      Provide an input value non-interactively.
  -h, --help           Show this help.
`);
}
