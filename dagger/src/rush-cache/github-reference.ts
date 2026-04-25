import type { RushCacheReference } from "../model/rush-cache.ts";

const DEFAULT_GITHUB_REGISTRY = "ghcr.io";
const DEFAULT_RUSH_CACHE_IMAGE_NAMESPACE = "rush-delivery-caches";
const IMAGE_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export type GithubRushCacheReferenceInput = {
  imageName?: string;
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
      `GitHub Rush cache repository "${repository}" must use owner/repo form.`,
    );
  }

  return parts
    .map((part, index) =>
      normalizePathSegment(
        part,
        index === 0
          ? "GitHub Rush cache owner"
          : "GitHub Rush cache repository name",
      ),
    )
    .join("/");
}

export function buildGithubRushCacheReference(
  input: GithubRushCacheReferenceInput,
): RushCacheReference {
  const registry = input.registry ?? DEFAULT_GITHUB_REGISTRY;
  const repository = normalizeRepository(input.repository);
  const imageNamespace = normalizePathSegment(
    input.imageNamespace ?? DEFAULT_RUSH_CACHE_IMAGE_NAMESPACE,
    "GitHub Rush cache namespace",
  );
  const imageName = normalizePathSegment(
    input.imageName ?? "rush-install",
    "GitHub Rush cache image name",
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
