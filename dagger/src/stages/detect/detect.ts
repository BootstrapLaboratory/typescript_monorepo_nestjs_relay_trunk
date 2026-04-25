import { dag, Directory } from "@dagger.io/dagger";

import { formatCiPlan } from "../../ci-plan/parse-ci-plan.ts";
import { computeCiPlan } from "./compute-ci-plan.ts";

const DETECT_WORKDIR = "/workspace";
const DETECT_IMAGE = "node:24-bookworm-slim";
const DETECT_INSTALL_COMMAND = "apt-get update && apt-get install -y git";

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
    .withExec(["bash", "-lc", DETECT_INSTALL_COMMAND]);

  return formatCiPlan(
    await computeCiPlan(
      repo,
      container,
      eventName,
      forceTargetsJson,
      prBaseSha,
      deployTagPrefix,
    ),
  );
}
