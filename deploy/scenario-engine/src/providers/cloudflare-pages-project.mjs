import { secret, step, text } from "../define.mjs";

export const CLOUDFLARE_PAGES_PROJECT_OUTPUTS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS",
  "CLOUDFLARE_PAGES_PRODUCTION_BRANCH",
  "CLOUDFLARE_PAGES_PROJECT_NAME",
  "CLOUDFLARE_PAGES_PROJECT_READY",
  "WEBAPP_URL",
];

export function createCloudflarePagesProjectStep(options = {}) {
  return step({
    guide:
      options.guide ??
      [
        "Prepare the Cloudflare Pages project for GitHub Actions direct upload.",
        "The API token is used only for this step and is not stored in scenario state.",
      ].join("\n"),
    id: options.id ?? "cloudflare-pages.project",
    inputs: {
      CLOUDFLARE_ACCOUNT_ID: text({
        label: "Cloudflare account ID",
      }),
      CLOUDFLARE_API_TOKEN: secret({
        label: "Cloudflare API token",
      }),
      CLOUDFLARE_PAGES_PRODUCTION_BRANCH: text({
        label: "Cloudflare Pages production branch (optional, default main)",
      }).optional(),
      CLOUDFLARE_PAGES_PROJECT_NAME: text({
        label: "Cloudflare Pages project name",
      }),
    },
    outputs: CLOUDFLARE_PAGES_PROJECT_OUTPUTS,
    title: options.title ?? "Prepare Cloudflare Pages project",
    run: async (input) => {
      const provider = options.provider ?? (await loadDefaultProvider());
      const deps =
        options.deps ??
        provider.createCloudflarePagesProviderDeps({
          apiToken: input.CLOUDFLARE_API_TOKEN,
        });

      return await provider.prepareCloudflarePagesProject(input, deps);
    },
  });
}

async function loadDefaultProvider() {
  try {
    return await import("deploy-provider-cloudflare-pages");
  } catch (error) {
    throw new Error(
      [
        "Unable to load deploy-provider-cloudflare-pages.",
        "Build it with `npm --prefix deploy/providers/cloudflare-pages run build` before running this action, or inject provider functions in tests.",
        `Cause: ${error.message}`,
      ].join(" "),
    );
  }
}
