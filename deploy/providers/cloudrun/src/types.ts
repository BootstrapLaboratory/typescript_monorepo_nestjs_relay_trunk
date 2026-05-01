export type BootstrapCloudRunInput = {
  ARTIFACT_REGISTRY_REPOSITORY?: string;
  BILLING_ACCOUNT_ID?: string;
  CLOUD_RUN_REGION?: string;
  CLOUD_RUN_SERVICE?: string;
  DEPLOYER_SERVICE_ACCOUNT_ID?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPOSITORY: string;
  PROJECT_ID: string;
  PROJECT_NAME?: string;
  RUNTIME_SERVICE_ACCOUNT_ID?: string;
  WIF_POOL_ID?: string;
  WIF_PROVIDER_ID?: string;
};

export type ResolvedBootstrapCloudRunInput = {
  ARTIFACT_REGISTRY_REPOSITORY: string;
  BILLING_ACCOUNT_ID?: string;
  CLOUD_RUN_REGION: string;
  CLOUD_RUN_SERVICE: string;
  DEPLOYER_SERVICE_ACCOUNT_ID: string;
  GITHUB_OWNER: string;
  GITHUB_REPOSITORY: string;
  PROJECT_ID: string;
  PROJECT_NAME: string;
  RUNTIME_SERVICE_ACCOUNT_ID: string;
  WIF_POOL_ID: string;
  WIF_PROVIDER_ID: string;
};

export type BootstrapCloudRunOutput = {
  CLOUD_RUN_REGION: string;
  CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: string;
  CLOUD_RUN_SERVICE: string;
  GCP_ARTIFACT_REGISTRY_REPOSITORY: string;
  GCP_PROJECT_ID: string;
  GCP_SERVICE_ACCOUNT: string;
  GCP_WORKLOAD_IDENTITY_PROVIDER: string;
  PROJECT_ID: string;
  PROJECT_NUMBER: string;
};

export type GithubOidcProviderOutput = {
  poolName: string;
  providerName: string;
};

export type CloudRunProviderDeps = {
  artifactRegistry: {
    ensureDockerRepository(input: {
      description: string;
      projectId: string;
      region: string;
      repository: string;
    }): Promise<void>;
    ensureRepositoryIamBinding(input: {
      member: string;
      projectId: string;
      region: string;
      repository: string;
      role: string;
    }): Promise<void>;
  };
  billing: {
    linkProject(input: {
      billingAccountId: string;
      projectId: string;
    }): Promise<void>;
  };
  iam: {
    ensureProjectIamBinding(input: {
      member: string;
      projectId: string;
      role: string;
    }): Promise<void>;
    ensureServiceAccount(input: {
      accountId: string;
      displayName: string;
      projectId: string;
    }): Promise<void>;
    ensureServiceAccountIamBinding(input: {
      member: string;
      projectId: string;
      role: string;
      serviceAccountEmail: string;
    }): Promise<void>;
  };
  projects: {
    ensureProject(input: {
      displayName: string;
      projectId: string;
    }): Promise<void>;
    getProjectNumber(projectId: string): Promise<string>;
  };
  services: {
    enableServices(input: {
      projectId: string;
      projectNumber: string;
      services: string[];
    }): Promise<void>;
  };
  workloadIdentity: {
    ensureGithubOidcProvider(input: {
      attributeCondition: string;
      attributeMapping: Record<string, string>;
      displayName: string;
      issuerUri: string;
      location: string;
      poolId: string;
      projectId: string;
      projectNumber: string;
      providerId: string;
    }): Promise<GithubOidcProviderOutput>;
  };
};
