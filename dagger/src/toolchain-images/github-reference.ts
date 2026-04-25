import type { ToolchainImageReference } from "../model/toolchain-image.ts";

const DEFAULT_GITHUB_REGISTRY = "ghcr.io";
const DEFAULT_TOOLCHAIN_IMAGE_NAMESPACE = "rush-delivery-toolchains";
const IMAGE_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export type GithubToolchainImageReferenceInput = {
  imageName: string;
  imageNamespace?: string;
  registry?: string;
  repository: string;
  tag: string;
};

function normalizePathSegment(value: string, name: string): string {
  const normalizedValue = value.trim().toLowerCase();

  if (!IMAGE_PATH_SEGMENT_PATTERN.test(normalizedValue)) {
    throw new Error(
      `${name} "${value}" must match ${IMAGE_PATH_SEGMENT_PATTERN}.`,
    );
  }

  return normalizedValue;
}

function normalizeRepository(repository: string): string {
  const parts = repository.split("/");

  if (parts.length !== 2) {
    throw new Error(
      `GitHub toolchain image repository "${repository}" must use owner/repo form.`,
    );
  }

  return parts
    .map((part, index) =>
      normalizePathSegment(
        part,
        index === 0
          ? "GitHub toolchain image owner"
          : "GitHub toolchain image repository name",
      ),
    )
    .join("/");
}

export function buildGithubToolchainImageReference(
  input: GithubToolchainImageReferenceInput,
): ToolchainImageReference {
  const registry = input.registry ?? DEFAULT_GITHUB_REGISTRY;
  const repository = normalizeRepository(input.repository);
  const imageNamespace = normalizePathSegment(
    input.imageNamespace ?? DEFAULT_TOOLCHAIN_IMAGE_NAMESPACE,
    "GitHub toolchain image namespace",
  );
  const imageName = normalizePathSegment(
    input.imageName,
    "GitHub toolchain image name",
  );
  const imagePath = `${repository}/${imageNamespace}/${imageName}`;
  const tag = input.tag;

  return {
    imagePath,
    reference: `${registry}/${imagePath}:${tag}`,
    registry,
    repository,
    tag,
  };
}
