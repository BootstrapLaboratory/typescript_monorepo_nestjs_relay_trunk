export type CiPlan = {
  affected_projects_by_deploy_target: Record<string, string[]>;
  deploy_targets: string[];
  mode: "pull_request" | "release";
  pr_base_sha: string;
  validate_targets: string[];
};
