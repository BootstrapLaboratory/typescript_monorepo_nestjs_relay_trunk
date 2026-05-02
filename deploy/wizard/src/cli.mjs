#!/usr/bin/env node
import { exit } from "node:process";

import { runScenarioCli } from "deploy-scenario-engine/src/cli-runtime.mjs";

import { scenarios } from "./scenarios.mjs";

exit(await runScenarioCli({ scenarios, usage: "node src/cli.mjs" }));
