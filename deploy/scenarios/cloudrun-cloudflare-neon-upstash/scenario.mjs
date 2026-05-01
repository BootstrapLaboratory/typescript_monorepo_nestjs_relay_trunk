import { randomBytes } from "node:crypto";

import { scenario, step, text } from "../../scenario-engine/src/define.mjs";
import { createCloudRunBootstrapStep } from "../../scenario-engine/src/providers/cloudrun-bootstrap.mjs";

export const CLOUDRUN_CLOUDFLARE_NEON_UPSTASH_SCENARIO_ID =
  "cloudrun-cloudflare-neon-upstash";

export function createCloudRunCloudflareNeonUpstashScenario(options = {}) {
  return scenario({
    id: CLOUDRUN_CLOUDFLARE_NEON_UPSTASH_SCENARIO_ID,
    steps: [
      createGoogleProjectStep(options.googleProject),
      createCloudRunBootstrapStep({
        ...(options.cloudRun ?? {}),
        guide: [
          "Prepare the Google Cloud project prerequisites for the Cloud Run backend.",
          "This first production scenario slice only runs Cloud Run bootstrap.",
          "Cloudflare Pages, Neon, and Upstash steps will be added as separate provider actions.",
        ].join("\n"),
        title: "Bootstrap Cloud Run backend",
      }),
    ],
    title: "Cloud Run + Cloudflare Pages + Neon + Upstash",
  });
}

export function createGoogleProjectStep(options = {}) {
  return step({
    guide: [
      "Enter a friendly Google Cloud project name.",
      "If PROJECT_ID is not provided with --var, the scenario generates a valid project ID and persists it for resume.",
    ].join("\n"),
    id: "google.project",
    inputs: {
      PROJECT_ID: text({
        label: "Google Cloud project ID (optional override)",
      }).optional(),
      PROJECT_NAME: text({ label: "Google Cloud project name" }),
    },
    outputs: ["PROJECT_NAME", "PROJECT_ID"],
    title: "Choose Google Cloud project",
    run: async (input) => ({
      PROJECT_ID:
        input.PROJECT_ID ??
        generateGoogleProjectId(input.PROJECT_NAME, {
          randomSuffix: options.randomSuffix,
        }),
      PROJECT_NAME: input.PROJECT_NAME,
    }),
  });
}

export function generateGoogleProjectId(projectName, options = {}) {
  const suffix = options.randomSuffix ?? randomBytes(3).toString("hex");
  const base = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-+/g, "-");
  const normalizedBase = /^[a-z]/.test(base) ? base : `project-${base}`;
  const trimmedBase = normalizedBase
    .slice(0, 30 - suffix.length - 1)
    .replace(/-+$/, "");

  return `${trimmedBase}-${suffix}`;
}
