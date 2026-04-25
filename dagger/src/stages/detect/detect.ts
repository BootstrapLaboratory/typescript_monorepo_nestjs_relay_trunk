import { Directory } from "@dagger.io/dagger";

import { formatCiPlan } from "../../ci-plan/parse-ci-plan.ts";
import { prepareRushContainer } from "../../rush/container.ts";
import { computeCiPlan } from "./compute-ci-plan.ts";

export async function detect(
  repo: Directory,
  eventName: string = "push",
  forceTargetsJson: string = "[]",
  prBaseSha: string = "",
  deployTagPrefix: string = "deploy/prod",
): Promise<string> {
  const container = await prepareRushContainer(repo);

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
