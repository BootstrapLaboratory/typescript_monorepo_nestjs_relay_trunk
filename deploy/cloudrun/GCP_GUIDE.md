# GCP Guide

This guide covers the manual Google Cloud Console steps for this repo when:

- your Google account already exists
- you want short "where to click" instructions
- you want the console-side setup to match the current repo automation

This guide is scoped to Google Cloud only.

For the full end-to-end rollout including Neon, Redis, and GitHub variables, also see:

- [deploy/cloudrun/PROVISIONING.md](PROVISIONING.md)

## Automation Status

Most of the resource creation in this guide is already automated.

- Sections `1` through `8` are normally handled by [bootstrap-gcp.sh](bootstrap-gcp.sh).
- Sections `9` and `10` are normally handled by [sync-secrets.sh](sync-secrets.sh).
- Section `11` is handled by the GitHub Actions deploy workflow.
- Section `12` is a manual verification step after CI deploys.

Use this guide when:

- you want to understand what the scripts are doing
- you prefer clicking through the Console once
- you need to inspect or repair a resource manually

## Values To Have Ready

Before clicking through the console, fill or review these values in:

- [deploy/cloudrun/.env](.env)

Important values:

- `PROJECT_ID`
- `PROJECT_NAME`
- `GITHUB_REPOSITORY`
- `BILLING_ACCOUNT_ID` if you plan to link billing manually
- `CLOUD_RUN_REGION`
- `ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `WIF_POOL_ID`
- `WIF_PROVIDER_ID`
- `DEPLOYER_SERVICE_ACCOUNT_ID`
- `RUNTIME_SERVICE_ACCOUNT_ID`

Repo defaults assume:

- region: `europe-west4`
- Artifact Registry repo: `cloud-run-backend`
- Cloud Run service: `api`
- WIF pool: `github-actions`
- WIF provider: `github`
- deployer service account: `github-actions-deployer`
- runtime service account: `cloud-run-runtime`

## 1. Select Or Create The Project

Automation status:

- usually handled by [bootstrap-gcp.sh](bootstrap-gcp.sh)
- keep this section as the manual fallback or verification path

Console path:

- top bar project picker
- `Select a project`
- either choose an existing project or click `New Project`

If creating a new project:

1. Open the project selector.
2. Click `New Project`.
3. Enter:
   - project name: use your `PROJECT_NAME`
   - project ID: use your `PROJECT_ID`
4. Choose the correct organization/folder if your account uses one.
5. Click `Create`.

Official docs:

- [Create projects](https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects)

## 2. Make Sure Billing Is Linked

Automation status:

- handled by [bootstrap-gcp.sh](bootstrap-gcp.sh) only if `BILLING_ACCOUNT_ID` is filled in `deploy/cloudrun/.env`
- otherwise this remains a manual Console step

Console path:

- left nav `Billing`
- `My Projects`

Steps:

1. Open `Billing` -> `My Projects`.
2. Find your project.
3. If billing is not linked, open the row action menu.
4. Click `Change billing`.
5. Select the billing account you want.
6. Click `Set account`.

Official docs:

- [Enable, disable, or change billing for a project](https://docs.cloud.google.com/billing/docs/how-to/modify-project)

## 3. Enable The Required APIs

Automation status:

- usually handled by [bootstrap-gcp.sh](bootstrap-gcp.sh)

You need these APIs enabled for the current repo setup:

- Cloud Run Admin API
- Artifact Registry API
- Secret Manager API
- IAM API
- Cloud Resource Manager API
- IAM Service Account Credentials API
- Security Token Service API

Console path:

- left nav `APIs & Services`
- `Library`

Steps:

1. Open `APIs & Services` -> `Library`.
2. Make sure the correct project is selected.
3. Search for each API listed above.
4. Open the API page.
5. Click `Enable`.

Official docs:

- [Enable and disable services](https://cloud.google.com/service-usage/docs/enable-disable)
- [Workload Identity Federation with deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)

## 4. Create The Artifact Registry Repository

Automation status:

- usually handled by [bootstrap-gcp.sh](bootstrap-gcp.sh)

Console path:

- left nav `Artifact Registry`
- `Repositories`
- `Create Repository`

Steps:

1. Open `Artifact Registry` -> `Repositories`.
2. Click `Create Repository`.
3. Fill:
   - name: `cloud-run-backend` or your `ARTIFACT_REGISTRY_REPOSITORY`
   - format: `Docker`
   - mode: `Standard`
   - location type: `Region`
   - region: `europe-west4`
4. Leave Google-managed encryption unless you already require CMEK.
5. Leave vulnerability scanning disabled for now unless you explicitly want it.
6. Click `Create`.

Official docs:

- [Create standard repositories](https://docs.cloud.google.com/artifact-registry/docs/repositories/create-repos)

## 5. Create The Two Service Accounts

Automation status:

- usually handled by [bootstrap-gcp.sh](bootstrap-gcp.sh)

You want two separate service accounts:

- deployer: used by GitHub Actions to deploy
- runtime: attached to the Cloud Run service at runtime

Console path:

- left nav `IAM & Admin`
- `Service Accounts`
- `Create Service Account`

### 5.1 Create The Deployer Service Account

Steps:

1. Open `IAM & Admin` -> `Service Accounts`.
2. Click `Create Service Account`.
3. Fill:
   - name: `github-actions-deployer`
   - ID: `github-actions-deployer`
   - description: something like `GitHub Actions deployer`
4. Click `Create and continue`.
5. Add project role:
   - `Cloud Run Admin`
6. Click `Continue`.
7. Do not add users in the optional access section.
8. Click `Done`.

### 5.2 Create The Runtime Service Account

Steps:

1. Click `Create Service Account` again.
2. Fill:
   - name: `cloud-run-runtime`
   - ID: `cloud-run-runtime`
   - description: something like `Cloud Run runtime`
3. Click `Create and continue`.
4. Do not add broad project roles unless you have a specific reason.
5. Click `Continue`.
6. Click `Done`.

Important:

- wait about a minute after creating service accounts before using them in other setup steps if the console seems slow to refresh

Official docs:

- [Create service accounts](https://docs.cloud.google.com/iam/docs/service-accounts-create)

## 6. Grant The Deployer Service Account The IAM It Needs

Automation status:

- usually handled by [bootstrap-gcp.sh](bootstrap-gcp.sh)

The deployer service account needs:

- project role: `Cloud Run Admin`
- repository role: `Artifact Registry Writer`
- permission to attach the runtime service account:
  - `Service Account User` on the runtime service account

### 6.1 Grant Artifact Registry Writer On The Repository

Console path:

- left nav `Artifact Registry`
- `Repositories`
- click your repository
- `Permissions`

Steps:

1. Open the repository.
2. Go to `Permissions`.
3. Click `Grant Access`.
4. Principal:
   - `github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com`
5. Role:
   - `Artifact Registry Writer`
6. Click `Save`.

### 6.2 Grant Service Account User On The Runtime Service Account

Console path:

- left nav `IAM & Admin`
- `Service Accounts`
- click the runtime service account
- `Permissions`

Steps:

1. Open the `cloud-run-runtime` service account.
2. Go to `Permissions`.
3. Click `Grant Access`.
4. Principal:
   - `github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com`
5. Role:
   - `Service Account User`
6. Click `Save`.

Official docs:

- [Manage access to projects, folders, and organizations](https://cloud.google.com/iam/docs/granting-changing-revoking-access)

## 7. Create The GitHub Workload Identity Pool And Provider

Automation status:

- usually handled by [bootstrap-gcp.sh](bootstrap-gcp.sh)

This is what lets GitHub Actions authenticate to Google Cloud without a long-lived JSON key.

Console path:

- left nav `IAM & Admin`
- `Workload Identity Federation`
- `Create Pool` or `New workload provider and pool`

Steps:

1. Open `IAM & Admin` -> `Workload Identity Federation`.
2. Click `Create pool` / `Create pool and provider`.
3. Under identity pool, fill:
   - name: `github-actions`
   - description: anything helpful
4. Click `Continue`.
5. Under provider settings, fill:
   - provider type: `OpenID Connect (OIDC)`
   - provider name: `GitHub`
   - provider ID: `github`
   - issuer URL: `https://token.actions.githubusercontent.com/`
   - audiences: `Default audience`
6. Click `Continue`.
7. Under attribute mappings, add at least the mappings used by this repo:

```text
google.subject=assertion.sub
attribute.actor=assertion.actor
attribute.repository=assertion.repository
attribute.repository_owner=assertion.repository_owner
attribute.ref=assertion.ref
```

8. Under attribute condition, use a strict repo-specific condition that matches the current repo automation:

```text
assertion.repository == 'OWNER/REPO'
```

Replace `OWNER/REPO` with the real value from `GITHUB_REPOSITORY`.

9. Click `Save`.

Notes:

- Google’s docs recommend using an attribute condition to restrict who can use the provider.
- The docs also note that numeric `*_id` claims are safer than name-based claims. This repo currently uses `repository` and `repository_owner` string claims for simplicity and to match the existing scripts.

Official docs:

- [Configure Workload Identity Federation with deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)

## 8. Allow The Provider To Impersonate The Deployer Service Account

Automation status:

- usually handled by [bootstrap-gcp.sh](bootstrap-gcp.sh)

Console path:

- left nav `IAM & Admin`
- `Workload Identity Federation`

Steps:

1. Open `IAM & Admin` -> `Workload Identity Federation`.
2. Click `Grant access`.
3. Choose `Grant access using Service Account impersonation`.
4. Select the deployer service account:
   - `github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com`
5. Choose `Only identities matching the filter`.
6. Set:
   - Attribute name: `repository`
   - Attribute value: your exact `OWNER/REPO`
7. Save.

This is the console equivalent of granting `roles/iam.workloadIdentityUser` to the repo-scoped principal set.

Important:

- Google may immediately open a `Configure your application` dialog after you save.
- For this repo, that dialog is not required. Our GitHub Actions workflow uses `google-github-actions/auth` with the workload identity provider directly, so we do not need to download a credential config file or fill an `OIDC ID token path`.
- In that dialog, just click `Dismiss`.
- The dialog is meant for client applications that want Google to generate a local credential configuration file. That is a different flow from the GitHub Actions setup used in this repo.

Official docs:

- [Configure Workload Identity Federation with deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)

## 9. Create Secret Manager Secrets

Automation status:

- usually handled by [sync-secrets.sh](sync-secrets.sh)
- keep this section as the manual fallback path if you want to create the secrets yourself in the Console

You need these secrets:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `REDIS_URL`

Console path:

- left nav `Security`
- `Secret Manager`
- `Create secret`

Steps:

1. Open `Secret Manager`.
2. Click `Create secret`.
3. Before you paste values, create the Neon and Upstash resources described in:
   - [NEON-UPSTASH-GUIDE.md](NEON-UPSTASH-GUIDE.md)
4. Create one secret at a time:
   - name: `DATABASE_URL`
   - value: your Neon pooled connection string
5. Repeat for:
   - `DATABASE_URL_DIRECT`
   - `REDIS_URL`

Use automatic replication unless you have a specific regional requirement.

Official docs:

- [Create a secret](https://docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)

## 10. Grant Secret Access

Automation status:

- usually handled by [sync-secrets.sh](sync-secrets.sh)

The deployer service account needs access to:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `REDIS_URL`

The runtime service account needs access to:

- `DATABASE_URL`
- `REDIS_URL`

Console path:

- left nav `Security`
- `Secret Manager`
- click a secret
- `Permissions`

Steps for each secret:

1. Open the secret.
2. Open `Permissions`.
3. Click `Grant Access`.
4. Add principal and role:
   - principal: deployer service account
   - role: `Secret Manager Secret Accessor`
5. For `DATABASE_URL` and `REDIS_URL`, also add:
   - principal: runtime service account
   - role: `Secret Manager Secret Accessor`
6. Save.

Official docs:

- [Manage access to secrets](https://docs.cloud.google.com/secret-manager/docs/manage-access-to-secrets)

## 11. What You Do Not Need To Create Manually

Automation status:

- handled by GitHub Actions in [../../.github/workflows/deploy-cloud-run-backend.yaml](../../.github/workflows/deploy-cloud-run-backend.yaml)

You do **not** need to create the Cloud Run service manually for the normal path.

The repo’s GitHub Actions workflow creates or updates the Cloud Run service during deployment.

You also do not need to manually upload a container image if the GitHub deployment workflow is working.

## 12. First Deploy Check In Google Cloud

Automation status:

- the deploy itself is handled by GitHub Actions in [../../.github/workflows/deploy-cloud-run-backend.yaml](../../.github/workflows/deploy-cloud-run-backend.yaml)
- this section is manual verification only

After the first successful GitHub deploy, verify in the console:

### 12.1 Cloud Run Service Exists

Console path:

- left nav `Cloud Run`
- `Services`

Check:

- service name matches `api` or your `CLOUD_RUN_SERVICE`
- region is `europe-west4`
- latest revision is healthy

### 12.2 Public Access Is Enabled

The workflow deploys with `--no-invoker-iam-check`, so the service should be public.

Console path:

- `Cloud Run`
- click the service
- `Security`

Check:

- public access is enabled

Official docs:

- [Allowing public (unauthenticated) access](https://docs.cloud.google.com/run/docs/authenticating/public)

## 13. Manual GCP Checklist

Automation status:

- this checklist is mainly for verification after running [bootstrap-gcp.sh](bootstrap-gcp.sh) and [sync-secrets.sh](sync-secrets.sh)

You are done with the manual Google Cloud side when all of these are true:

- project exists and is selected
- billing is linked
- required APIs are enabled
- Docker Artifact Registry repository exists in `europe-west4`
- deployer and runtime service accounts exist
- Workload Identity pool and GitHub OIDC provider exist
- GitHub repo can impersonate the deployer service account
- three Secret Manager secrets exist
- deployer and runtime secret access is configured correctly

At that point, return to:

- [deploy/cloudrun/PROVISIONING.md](PROVISIONING.md)

and continue with:

- GitHub repository variables
- first backend deploy
- backend verification
