import { auth, iam, type iam_v1 } from "@googleapis/iam";

import type { CloudRunProviderDeps } from "../types.js";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_OPERATION_MAX_POLL_ATTEMPTS = 300;
const DEFAULT_OPERATION_POLL_INTERVAL_MS = 1_000;
const GITHUB_POOL_DISPLAY_NAME = "GitHub Actions Pool";

type GoogleOperation = iam_v1.Schema$Operation;
type WorkloadIdentityPool = iam_v1.Schema$WorkloadIdentityPool;
type WorkloadIdentityPoolProvider =
  iam_v1.Schema$WorkloadIdentityPoolProvider;

type Response<T> = {
  data: T;
};

type GetOperationRequest = {
  name: string;
};

type GetPoolRequest = {
  name: string;
};

type CreatePoolRequest = {
  parent: string;
  requestBody: WorkloadIdentityPool;
  workloadIdentityPoolId: string;
};

type GetProviderRequest = {
  name: string;
};

type CreateProviderRequest = {
  parent: string;
  requestBody: WorkloadIdentityPoolProvider;
  workloadIdentityPoolProviderId: string;
};

export type WorkloadIdentityPoolOperationsClientLike = {
  get(request: GetOperationRequest): Promise<Response<GoogleOperation>>;
};

export type WorkloadIdentityPoolProvidersClientLike = {
  create(request: CreateProviderRequest): Promise<Response<GoogleOperation>>;
  get(request: GetProviderRequest): Promise<Response<WorkloadIdentityPoolProvider>>;
  operations: WorkloadIdentityPoolOperationsClientLike;
};

export type WorkloadIdentityPoolsClientLike = {
  create(request: CreatePoolRequest): Promise<Response<GoogleOperation>>;
  get(request: GetPoolRequest): Promise<Response<WorkloadIdentityPool>>;
  operations: WorkloadIdentityPoolOperationsClientLike;
  providers: WorkloadIdentityPoolProvidersClientLike;
};

export type WorkloadIdentityOperationOptions = {
  maxPollAttempts?: number;
  pollIntervalMs?: number;
};

export function createGoogleWorkloadIdentityDependency(
  pools: WorkloadIdentityPoolsClientLike =
    createDefaultWorkloadIdentityPoolsClient(),
  operationOptions: WorkloadIdentityOperationOptions = {},
): CloudRunProviderDeps["workloadIdentity"] {
  const waitOptions = resolveOperationOptions(operationOptions);

  return {
    async ensureGithubOidcProvider(input) {
      const poolName = workloadIdentityPoolResourceName({
        location: input.location,
        poolId: input.poolId,
        projectNumber: input.projectNumber,
      });
      const providerName = workloadIdentityProviderResourceName({
        location: input.location,
        poolId: input.poolId,
        projectNumber: input.projectNumber,
        providerId: input.providerId,
      });

      try {
        await pools.get({
          name: poolName,
        });
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }

        const { data: operation } = await pools.create({
          parent: workloadIdentityLocationParent({
            location: input.location,
            projectId: input.projectId,
          }),
          requestBody: {
            displayName: GITHUB_POOL_DISPLAY_NAME,
          },
          workloadIdentityPoolId: input.poolId,
        });
        await waitForOperation(operation, pools.operations, waitOptions);
      }

      try {
        await pools.providers.get({
          name: providerName,
        });
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }

        const { data: operation } = await pools.providers.create({
          parent: poolName,
          requestBody: {
            attributeCondition: input.attributeCondition,
            attributeMapping: input.attributeMapping,
            displayName: input.displayName,
            oidc: {
              issuerUri: input.issuerUri,
            },
          },
          workloadIdentityPoolProviderId: input.providerId,
        });
        await waitForOperation(
          operation,
          pools.providers.operations,
          waitOptions,
        );
      }

      return {
        poolName,
        providerName,
      };
    },
  };
}

export function workloadIdentityLocationParent(input: {
  location: string;
  projectId: string;
}): string {
  return `projects/${input.projectId}/locations/${input.location}`;
}

export function workloadIdentityPoolResourceName(input: {
  location: string;
  poolId: string;
  projectNumber: string;
}): string {
  return `${workloadIdentityProjectNumberLocationParent(input)}/workloadIdentityPools/${input.poolId}`;
}

export function workloadIdentityProviderResourceName(input: {
  location: string;
  poolId: string;
  projectNumber: string;
  providerId: string;
}): string {
  return `${workloadIdentityPoolResourceName(input)}/providers/${input.providerId}`;
}

function createDefaultWorkloadIdentityPoolsClient(): WorkloadIdentityPoolsClientLike {
  const googleAuth = new auth.GoogleAuth({
    scopes: [CLOUD_PLATFORM_SCOPE],
  });

  return iam({
    auth: googleAuth,
    version: "v1",
  }).projects.locations.workloadIdentityPools as WorkloadIdentityPoolsClientLike;
}

function workloadIdentityProjectNumberLocationParent(input: {
  location: string;
  projectNumber: string;
}): string {
  return `projects/${input.projectNumber}/locations/${input.location}`;
}

function resolveOperationOptions(
  options: WorkloadIdentityOperationOptions,
): Required<WorkloadIdentityOperationOptions> {
  return {
    maxPollAttempts:
      options.maxPollAttempts ?? DEFAULT_OPERATION_MAX_POLL_ATTEMPTS,
    pollIntervalMs:
      options.pollIntervalMs ?? DEFAULT_OPERATION_POLL_INTERVAL_MS,
  };
}

async function waitForOperation(
  operation: GoogleOperation,
  operations: WorkloadIdentityPoolOperationsClientLike,
  options: Required<WorkloadIdentityOperationOptions>,
): Promise<void> {
  let current = operation;

  for (let attempt = 0; attempt <= options.maxPollAttempts; attempt += 1) {
    throwIfOperationFailed(current);

    if (current.done === true) {
      return;
    }

    const operationName = current.name;

    if (operationName === undefined || operationName === null) {
      throw new Error(
        "Google IAM returned a pending operation without an operation name.",
      );
    }

    if (attempt === options.maxPollAttempts) {
      throw new Error(
        `Google IAM operation ${operationName} did not finish after ${options.maxPollAttempts} poll attempts.`,
      );
    }

    await delay(options.pollIntervalMs);

    const { data } = await operations.get({
      name: operationName,
    });
    current = data;
  }
}

function throwIfOperationFailed(operation: GoogleOperation): void {
  const status = operation.error;

  if (status === undefined || status === null) {
    return;
  }

  const code = status.code === undefined ? "" : ` with code ${status.code}`;
  const message = status.message ?? "unknown error";
  throw new Error(
    `Google IAM operation ${operation.name ?? "<unnamed>"} failed${code}: ${message}`,
  );
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as {
    code?: unknown;
    response?: {
      status?: unknown;
    };
    status?: unknown;
  };

  return (
    maybeError.code === 404 ||
    maybeError.status === 404 ||
    maybeError.response?.status === 404
  );
}
