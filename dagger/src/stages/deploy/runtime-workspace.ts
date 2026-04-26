import type { Container, Directory } from "@dagger.io/dagger";

import type { DeployWorkspaceSpec } from "../../model/deploy-target.ts";

const WORKSPACE_PATH = "/workspace";

export type RuntimeWorkspacePlan =
  | {
      mode: "full";
    }
  | {
      dirs: string[];
      files: string[];
      mode: "partial";
    };

export function buildRuntimeWorkspacePlan(
  workspace: DeployWorkspaceSpec,
): RuntimeWorkspacePlan {
  if (workspace.mode === "full") {
    return { mode: "full" };
  }

  return {
    dirs: workspace.dirs,
    files: workspace.files,
    mode: "partial",
  };
}

export function applyRuntimeWorkspace(
  container: Container,
  repo: Directory,
  workspace: DeployWorkspaceSpec,
): Container {
  const plan = buildRuntimeWorkspacePlan(workspace);

  if (plan.mode === "full") {
    return container.withDirectory(WORKSPACE_PATH, repo);
  }

  let nextContainer = container;

  for (const directoryPath of plan.dirs) {
    nextContainer = nextContainer.withDirectory(
      `${WORKSPACE_PATH}/${directoryPath}`,
      repo.directory(directoryPath),
    );
  }

  for (const filePath of plan.files) {
    nextContainer = nextContainer.withFile(
      `${WORKSPACE_PATH}/${filePath}`,
      repo.file(filePath),
    );
  }

  return nextContainer;
}
