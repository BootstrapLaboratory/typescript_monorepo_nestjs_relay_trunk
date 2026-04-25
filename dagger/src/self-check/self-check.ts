import { dag, Directory } from "@dagger.io/dagger";

import { formatMetadataContractValidationResult } from "../metadata/metadata-contract.ts";
import { validateMetadataContract } from "../metadata/dagger-metadata-contract.ts";
import { logSection } from "../logging/sections.ts";

const WORKDIR = "/workspace";
const DAGGER_DIR = `${WORKDIR}/dagger`;
const SELF_CHECK_IMAGE = "node:24-bookworm-slim";
const SELF_CHECK_INSTALL_COMMAND =
  "apt-get update && apt-get install -y ca-certificates git";

export async function selfCheck(repo: Directory): Promise<string> {
  logSection("Rush delivery self-check");
  logSection("Dagger framework tests");

  const container = dag
    .container()
    .from(SELF_CHECK_IMAGE)
    .withDirectory(WORKDIR, repo)
    .withWorkdir(DAGGER_DIR)
    .withExec(["bash", "-lc", SELF_CHECK_INSTALL_COMMAND])
    .withExec(["yarn", "install", "--frozen-lockfile"], { expand: false })
    .withExec(["yarn", "typecheck"], { expand: false })
    .withExec(["yarn", "test"], { expand: false });

  await container.sync();

  logSection("Metadata contract");
  const metadataContract = await validateMetadataContract(repo);

  return [
    "rush-delivery self-check passed",
    "",
    "metadata contract:",
    formatMetadataContractValidationResult(metadataContract),
  ].join("\n");
}
