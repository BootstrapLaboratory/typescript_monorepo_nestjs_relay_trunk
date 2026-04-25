import { Directory, ExistsType } from "@dagger.io/dagger";

import {
  type MetadataContractRepository,
  type MetadataContractValidationResult,
  validateMetadataContractRepository,
} from "./metadata-contract.ts";

class DaggerMetadataContractRepository implements MetadataContractRepository {
  private readonly repo: Directory;

  constructor(repo: Directory) {
    this.repo = repo;
  }

  async entries(path: string): Promise<string[]> {
    return this.repo.directory(path).entries();
  }

  async exists(
    path: string,
    expectedType: "directory" | "file",
  ): Promise<boolean> {
    return this.repo.exists(path, {
      expectedType:
        expectedType === "file"
          ? ExistsType.RegularType
          : ExistsType.DirectoryType,
    });
  }

  async readTextFile(path: string): Promise<string> {
    return this.repo.file(path).contents();
  }
}

export async function validateMetadataContract(
  repo: Directory,
): Promise<MetadataContractValidationResult> {
  return validateMetadataContractRepository(
    new DaggerMetadataContractRepository(repo),
  );
}

export async function assertMetadataContract(repo: Directory): Promise<void> {
  await validateMetadataContract(repo);
}
