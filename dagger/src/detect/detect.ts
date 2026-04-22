import { dag, Directory } from "@dagger.io/dagger";

const DETECT_WORKDIR = "/workspace";
const DETECT_OUTPUT_PATH = "/tmp/ci-plan.json";
const DETECT_IMAGE = "node:24-bookworm-slim";
const DETECT_INSTALL_COMMAND =
  "apt-get update && apt-get install -y git";

export async function detect(
  repo: Directory,
  eventName: string = "push",
  forceTargetsJson: string = "[]",
  prBaseSha: string = "",
  deployTagPrefix: string = "deploy/prod",
): Promise<string> {
  const container = dag
    .container()
    .from(DETECT_IMAGE)
    .withMountedDirectory(DETECT_WORKDIR, repo)
    .withWorkdir(DETECT_WORKDIR)
    .withExec(["bash", "-lc", DETECT_INSTALL_COMMAND])
    .withEnvVariable("GITHUB_EVENT_NAME", eventName)
    .withEnvVariable("FORCE_TARGETS_JSON", forceTargetsJson)
    .withEnvVariable("PR_BASE_SHA", prBaseSha)
    .withEnvVariable("DEPLOY_TAG_PREFIX", deployTagPrefix)
    .withEnvVariable("CI_PLAN_PATH", DETECT_OUTPUT_PATH)
    .withExec(["node", "scripts/ci/compute-ci-plan.mjs"]);

  return await container.file(DETECT_OUTPUT_PATH).contents();
}
