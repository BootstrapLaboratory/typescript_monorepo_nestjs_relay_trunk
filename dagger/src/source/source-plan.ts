import type {
  GitCommandPlan,
  GitSourcePlan,
  SourceMode,
  SourcePlan,
} from "../model/source.ts";

export const DEFAULT_MOUNTED_SOURCE_PATH = "/workspace";
export const DEFAULT_GIT_SOURCE_WORKDIR = "/rush-delivery/source";
export const DEFAULT_LOCAL_COPY_SOURCE_WORKDIR = "/rush-delivery/source";
export const DEFAULT_DEPLOY_TAG_PREFIX = "deploy/prod";
export const DEFAULT_LOCAL_COPY_CLEANUP_PATHS = [
  "common/temp",
  ".dagger/runtime",
];

const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const FULL_GIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;

export type BuildSourcePlanInput = {
  authTokenEnv?: string;
  cleanupPaths?: string[];
  commitSha?: string;
  deployTagPrefix?: string;
  localSourcePath?: string;
  mode?: string;
  prBaseSha?: string;
  ref?: string;
  repositoryUrl?: string;
  workdir?: string;
};

function requireNonEmpty(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value;
}

function rejectShellUnsafe(value: string, name: string): string {
  if (/[\u0000-\u001f\u007f\s]/u.test(value)) {
    throw new Error(`${name} must not contain whitespace or control characters.`);
  }

  if (value.startsWith("-")) {
    throw new Error(`${name} must not start with "-".`);
  }

  return value;
}

function parseAbsolutePath(value: string, name: string): string {
  rejectShellUnsafe(value, name);

  if (!value.startsWith("/") || value === "/") {
    throw new Error(`${name} must be a specific absolute path.`);
  }

  if (value.split("/").some((segment) => segment === "..")) {
    throw new Error(`${name} must not contain parent segments.`);
  }

  return value.replace(/\/+$/u, "");
}

function parseRepoRelativePath(value: string, name: string): string {
  rejectShellUnsafe(value, name);

  if (value.startsWith("/") || value === "." || value.length === 0) {
    throw new Error(`${name} must be a repository-relative path.`);
  }

  if (value.split("/").some((segment) => segment === "..")) {
    throw new Error(`${name} must stay inside the repository.`);
  }

  return value.replace(/^\.\/+/u, "").replace(/\/+$/u, "");
}

function parseRepoRelativePaths(
  values: string[] | undefined,
  name: string,
): string[] {
  return (values ?? DEFAULT_LOCAL_COPY_CLEANUP_PATHS).map((path, index) =>
    parseRepoRelativePath(path, `${name}[${index}]`),
  );
}

function parseFullGitSha(value: string | undefined, name: string): string {
  const gitSha = rejectShellUnsafe(requireNonEmpty(value, name), name);

  if (!FULL_GIT_SHA_PATTERN.test(gitSha)) {
    throw new Error(`${name} must be a full 40-character Git SHA.`);
  }

  return gitSha.toLowerCase();
}

function parseOptionalFullGitSha(
  value: string | undefined,
  name: string,
): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  return parseFullGitSha(value, name);
}

function parseGitRef(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  const ref = rejectShellUnsafe(value, "Git source ref");

  if (ref.includes("..") || ref.endsWith(".lock")) {
    throw new Error("Git source ref is not a safe Git ref.");
  }

  return ref;
}

function parseDeployTagPrefix(value: string | undefined): string {
  const prefix = rejectShellUnsafe(
    requireNonEmpty(value ?? DEFAULT_DEPLOY_TAG_PREFIX, "Deploy tag prefix"),
    "Deploy tag prefix",
  );

  if (
    prefix.startsWith("/") ||
    prefix.endsWith("/") ||
    prefix.includes("..")
  ) {
    throw new Error("Deploy tag prefix is not a safe tag prefix.");
  }

  return prefix;
}

function parseRepositoryUrl(value: string | undefined): string {
  const repositoryUrl = rejectShellUnsafe(
    requireNonEmpty(value, "Git source repository URL"),
    "Git source repository URL",
  );

  try {
    const parsedUrl = new URL(repositoryUrl);

    if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
      throw new Error(
        "Git source repository URL must not embed credentials; use authTokenEnv instead.",
      );
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return repositoryUrl;
    }

    throw error;
  }

  return repositoryUrl;
}

function parseAuthTokenEnv(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  const tokenEnv = requireNonEmpty(value, "Git source auth token env");

  if (!ENV_NAME_PATTERN.test(tokenEnv)) {
    throw new Error(
      `Git source auth token env "${tokenEnv}" must match ${ENV_NAME_PATTERN}.`,
    );
  }

  return tokenEnv;
}

export function parseSourceMode(value: string = "local_copy"): SourceMode {
  switch (value) {
    case "local_copy":
    case "git":
      return value;
    default:
      throw new Error(`Unsupported source mode "${value}".`);
  }
}

export function deployTagFetchRefspec(deployTagPrefix: string): string {
  const prefix = parseDeployTagPrefix(deployTagPrefix);

  return `+refs/tags/${prefix}/*:refs/tags/${prefix}/*`;
}

function buildGitCommandPlan(input: {
  commitSha: string;
  deployTagPrefix: string;
  prBaseSha?: string;
  ref?: string;
  repositoryUrl: string;
  workdir: string;
}): GitCommandPlan[] {
  const commands: GitCommandPlan[] = [
    {
      args: ["clone", "--no-checkout", input.repositoryUrl, input.workdir],
      command: "git",
      name: "clone",
    },
  ];

  if (input.ref !== undefined) {
    commands.push({
      args: ["-C", input.workdir, "fetch", "--force", "origin", input.ref],
      command: "git",
      name: "fetch_ref",
    });
  } else {
    commands.push({
      args: [
        "-C",
        input.workdir,
        "fetch",
        "--force",
        "origin",
        input.commitSha,
      ],
      command: "git",
      name: "fetch_commit",
    });
  }

  commands.push({
    args: [
      "-C",
      input.workdir,
      "fetch",
      "--force",
      "origin",
      deployTagFetchRefspec(input.deployTagPrefix),
    ],
    command: "git",
    name: "fetch_deploy_tags",
  });

  if (input.prBaseSha !== undefined) {
    commands.push({
      args: ["-C", input.workdir, "fetch", "--force", "origin", input.prBaseSha],
      command: "git",
      name: "fetch_pr_base",
    });
  }

  commands.push({
    args: ["-C", input.workdir, "checkout", "--force", input.commitSha],
    command: "git",
    name: "checkout",
  });

  return commands;
}

export function buildSourcePlan(input: BuildSourcePlanInput = {}): SourcePlan {
  const mode = parseSourceMode(input.mode);

  if (mode === "local_copy") {
    return {
      cleanupPaths: parseRepoRelativePaths(
        input.cleanupPaths,
        "Local copy cleanup paths",
      ),
      mode,
      sourcePath: parseAbsolutePath(
        input.localSourcePath ?? DEFAULT_MOUNTED_SOURCE_PATH,
        "Local copy source path",
      ),
      workdir: parseAbsolutePath(
        input.workdir ?? DEFAULT_LOCAL_COPY_SOURCE_WORKDIR,
        "Local copy workdir",
      ),
    };
  }

  const repositoryUrl = parseRepositoryUrl(input.repositoryUrl);
  const commitSha = parseFullGitSha(input.commitSha, "Git source commit SHA");
  const ref = parseGitRef(input.ref);
  const prBaseSha = parseOptionalFullGitSha(
    input.prBaseSha,
    "Git source PR base SHA",
  );
  const deployTagPrefix = parseDeployTagPrefix(input.deployTagPrefix);
  const workdir = parseAbsolutePath(
    input.workdir ?? DEFAULT_GIT_SOURCE_WORKDIR,
    "Git source workdir",
  );
  const authTokenEnv = parseAuthTokenEnv(input.authTokenEnv);
  const plan: GitSourcePlan = {
    commands: buildGitCommandPlan({
      commitSha,
      deployTagPrefix,
      prBaseSha,
      ref,
      repositoryUrl,
      workdir,
    }),
    commitSha,
    deployTagPrefix,
    mode,
    repositoryUrl,
    workdir,
  };

  if (authTokenEnv !== undefined) {
    plan.auth = { tokenEnv: authTokenEnv };
  }

  if (ref !== undefined) {
    plan.ref = ref;
  }

  if (prBaseSha !== undefined) {
    plan.prBaseSha = prBaseSha;
  }

  return plan;
}
