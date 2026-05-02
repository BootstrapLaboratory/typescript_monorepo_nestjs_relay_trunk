import { scenario, secret, step, text } from "../define.mjs";

export function createTinyScenario() {
  return scenario({
    id: "tiny-cloud",
    title: "Tiny Cloud Scenario",
    steps: [
      step({
        guide:
          "Collect fake project details and return a generated project number.",
        id: "cloud.bootstrap",
        inputs: {
          ADMIN_TOKEN: secret({ label: "Admin token" }),
          PROJECT_ID: text({ label: "Project ID" }),
        },
        outputs: ["PROJECT_NUMBER"],
        title: "Bootstrap fake cloud",
        run: async (input) => ({
          PROJECT_NUMBER: `${input.PROJECT_ID}-123`,
        }),
      }),
      step({
        guide:
          "Use the generated project number plus a region to create a fake URL.",
        id: "cloud.service",
        inputs: {
          PROJECT_NUMBER: text(),
          REGION: text({ label: "Region" }),
        },
        outputs: ["SERVICE_URL"],
        title: "Create fake service",
        run: async (input) => ({
          SERVICE_URL: `https://${input.PROJECT_NUMBER}.${input.REGION}.example.test`,
        }),
      }),
    ],
  });
}
