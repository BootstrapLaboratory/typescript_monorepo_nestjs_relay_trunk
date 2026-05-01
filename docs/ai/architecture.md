# Project Architecture

This repository is a Rush-managed TypeScript monorepo. Rush is the source of
truth for project membership, dependency installation, dependency-aware build
ordering, and lockfile ownership.

## Repository Shape

- `apps/server`: NestJS backend deployed to Cloud Run.
- `apps/webapp`: React/Vite/Relay frontend deployed to Cloudflare Pages.
- `libs/api`: generated GraphQL schema contract consumed by the webapp.
- `.dagger`: app-owned Rush Delivery metadata for validation, package, deploy,
  toolchain images, and Rush install cache.
- `deploy`: provider-specific scripts for Cloud Run and Cloudflare Pages.
  `deploy/scenario-engine` is a small Rush project for the deployment scenario
  engine spike. It uses the XState-backed runner as the default execution
  engine behind the project-owned scenario DSL, keeps a plain runner as a
  fallback/reference implementation, persists sanitized XState snapshots for
  resume/fresh-run behavior, includes a local JSON store, CLI demo scenario,
  redacting shell helper for future provider wrappers, and a Cloud Run
  bootstrap action wrapper. The first production scenario skeleton lives under
  `deploy/scenarios/cloudrun-cloudflare-neon-upstash`; it collects a Google
  Cloud project name, generates and persists a project ID when one is not
  provided, executes the Cloud Run bootstrap step, prints a structured backend
  GitHub variable handoff, and collects Neon database URLs plus the Upstash
  Redis URL as transient secret inputs before syncing them into Google Secret
  Manager. The Cloud Run step can pause for manual billing enablement and retry
  when Google reports that billing is required. It is not a production deploy
  executor.
  `deploy/providers/cloudrun` is a TypeScript
  provider spike for Cloud Run bootstrap orchestration and runtime Secret
  Manager sync; it includes SDK-backed Resource Manager, Cloud Billing, Service
  Usage, Artifact Registry repository, Secret Manager, and Artifact Registry
  repository IAM dependencies plus IAM service account creation and
  service-account IAM binding through `@googleapis/iam`, Resource
  Manager-backed project IAM dependencies, and Workload Identity pool plus
  GitHub OIDC provider dependencies through `@googleapis/iam`. It exports a
  default Google-backed dependency factory for `bootstrapCloudRun` and
  `syncCloudRunRuntimeSecrets`, and the scenario engine has step wrappers that
  can lazy-load it. This does not replace `deploy/cloudrun` scripts.
  `deploy/providers/cloudflare-pages` is a TypeScript provider spike for
  Cloudflare Pages production provisioning. It uses Cloudflare's official
  TypeScript SDK to ensure a Pages project exists, set its production branch,
  and disable Cloudflare Git automatic deployments for Git-integrated Pages
  projects. It intentionally does not deploy static assets, configure GitHub
  repository values, or derive backend GraphQL endpoints.

## Rush Rules

- Add or remove Rush projects in `rush.json`.
- Keep Rush `packageName` values aligned with Rush Delivery target names.
- Deploy provider Rush projects may live under `deploy/providers/*`; the Rush
  project folder depth limit is set to allow that shape.
- Do not run ad-hoc package-manager installs in project folders.
- Use `npm run rush:install` for lockfile-faithful installs.
- Use `npm run rush:update` after changing dependencies.
- Use `npm run rush -- <rush-command>` for Rush commands without root
  `node_modules`.
- Use `npm run deps:upgrade`, `npm run deps:upgrade:server`, or
  `npm run deps:upgrade:webapp` for dependency range upgrades.
- The root `package.json` is intentionally only a command wrapper; project
  dependencies belong in each Rush project.

Rush custom bulk commands live in `common/config/rush/command-line.json`:
`verify`, `lint`, `test`, and `dev`. Rush Delivery uses these project scripts
instead of hardcoded per-project CI steps.

## CI And Release

GitHub Actions is the outer trigger and credentials adapter. Rush Delivery owns
the CI lifecycle:

- `.github/workflows/main-workflow.yaml` runs detect, build, package, and
  deploy for pushes to `main` and forced deploy wrappers.
- `.github/workflows/pr-validate.yaml` runs PR validation through Rush
  Delivery's `validate` entrypoint.
- `.github/workflows/force-deploy-server.yaml` and
  `.github/workflows/force-deploy-webapp.yaml`
  only force target selection; they do not own release logic.

Keep CI behavior in Rush project scripts, `.dagger` metadata, or provider
scripts. Do not reintroduce target-specific build/package/deploy logic into
GitHub workflow jobs.

## Metadata Boundaries

Rush Delivery metadata is project-specific but framework-generic:

- `.dagger/package/targets`: how deploy artifacts are materialized.
- `.dagger/deploy/targets`: how target deploy executors are prepared.
- `.dagger/deploy/services-mesh.yaml`: deploy ordering.
- `.dagger/validate/targets`: optional validation scenarios.

YAML files declare their schema with `# yaml-language-server: $schema=...`
comments. Do not add `$schema` as data fields.

## Local Development

`npm run dev` uses a small Nx wrapper only to run Rush project `start:dev`
targets together. Nx is not the build or dependency manager for this repo.

Prefer Rush commands for repo-wide checks and package scripts for project-local
behavior.
