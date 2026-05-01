#!/usr/bin/env node
import { exit } from "node:process";

import { runScenarioCli } from "./cli-runtime.mjs";
import { createTinyScenario } from "./demo/tiny-scenario.mjs";

const scenarios = {
  demo: createTinyScenario,
};

exit(await runScenarioCli({ scenarios }));
