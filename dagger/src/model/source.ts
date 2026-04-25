export type SourceMode = "local_copy" | "git";

export type SourceAuth = {
  tokenEnv: string;
  username: string;
};

export type GitCommandPlan = {
  args: string[];
  command: "git";
  name:
    | "checkout"
    | "clone"
    | "fetch_commit"
    | "fetch_deploy_tags"
    | "fetch_pr_base"
    | "fetch_ref";
};

export type LocalCopySourcePlan = {
  cleanupPaths: string[];
  mode: "local_copy";
  removeNodeModules: boolean;
  sourcePath: string;
  workdir: string;
};

export type GitSourcePlan = {
  auth?: SourceAuth;
  commands: GitCommandPlan[];
  commitSha: string;
  deployTagPrefix: string;
  mode: "git";
  prBaseSha?: string;
  ref?: string;
  repositoryUrl: string;
  workdir: string;
};

export type SourcePlan = GitSourcePlan | LocalCopySourcePlan;
