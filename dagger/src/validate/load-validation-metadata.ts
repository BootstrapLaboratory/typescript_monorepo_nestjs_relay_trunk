import { Directory } from "@dagger.io/dagger";

import type { ValidationTargetDefinition } from "../model/validation-target.ts";
import { validationTargetDefinitionPath } from "./metadata-paths.ts";
import { parseValidationTarget } from "./parse-validation-target.ts";

export async function loadValidationTargetDefinition(
  repo: Directory,
  target: string,
): Promise<ValidationTargetDefinition> {
  const definition = parseValidationTarget(
    await repo.file(validationTargetDefinitionPath(target)).contents(),
  );

  if (definition.name !== target) {
    throw new Error(
      `Validation target definition "${validationTargetDefinitionPath(target)}" must declare name "${target}", got "${definition.name}".`,
    );
  }

  return definition;
}
