#!/usr/bin/env node
import { exit } from "node:process";

import { runScenarioCli } from "deploy-scenario-engine/src/cli-runtime.mjs";
import {
  CLOUDRUN_CLOUDFLARE_NEON_UPSTASH_SCENARIO_ID,
  createCloudRunCloudflareNeonUpstashScenario,
} from "deploy-scenario-cloudrun-cloudflare-neon-upstash/scenario.mjs";

const scenarios = {
  [CLOUDRUN_CLOUDFLARE_NEON_UPSTASH_SCENARIO_ID]:
    createCloudRunCloudflareNeonUpstashScenario,
};

exit(await runScenarioCli({ scenarios, usage: "node src/cli.mjs" }));
