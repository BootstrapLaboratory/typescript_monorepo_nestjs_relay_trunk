import {
  CLOUDRUN_CLOUDFLARE_NEON_UPSTASH_SCENARIO_ID,
  createCloudRunCloudflareNeonUpstashScenario,
} from "deploy-scenario-cloudrun-cloudflare-neon-upstash/scenario.mjs";

export const scenarios = {
  [CLOUDRUN_CLOUDFLARE_NEON_UPSTASH_SCENARIO_ID]:
    createCloudRunCloudflareNeonUpstashScenario,
};
