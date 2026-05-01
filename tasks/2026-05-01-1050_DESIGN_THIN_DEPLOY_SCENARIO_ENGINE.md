# Design Thin Deploy Scenario Engine

## Goal

Create a small, readable deployment scenario layer that can run the same
scenario definitions from different interfaces: first CLI, later a web wizard.

The scenario layer should make provider orchestration easy to read. A scenario
should look like a runbook made of typed steps, not like a large deployment
framework.

## Problem

Current deploy helpers are mostly shell scripts under provider-specific
directories. They work, but the full production preparation flow requires a
human to move values between scripts and providers manually.

The desired improvement is not a large TypeScript rewrite. The desired
improvement is a thin orchestration layer that:

- knows which inputs a step needs from the user
- shows guidance for the current step
- calls one provider function
- captures provider outputs
- passes outputs into later steps
- can use different UI adapters for CLI or web

## Design Principles

- Keep scenarios readable first. A reviewer should understand the deploy flow
  by opening one scenario file.
- Keep provider functions focused on one provider. Cloud Run code should not
  know about Cloudflare, Neon, or Upstash orchestration.
- Keep UI separate from scenario definitions. CLI prompts and future web forms
  should consume the same scenario model.
- Preserve existing shell scripts initially. Provider functions may wrap them
  before any behavior is converted to TypeScript.
- Keep secrets redacted by default in logs, summaries, persisted state, and UI.
- Prefer explicit input/output names over clever inference.
- Add abstractions only when at least two scenario steps or UIs need them.
- Avoid a generic provider interface that hides provider-specific behavior.
  Providers can expose different functions; scenarios decide how to compose
  them.

## Non-Goals

- Do not replace Rush Delivery deployment executors in the first phase.
- Do not move all deploy directories at once.
- Do not introduce a heavy workflow engine unless the thin runner is proven
  insufficient.
- Do not implement a web UI in the first phase. Design for it, but build CLI
  first.
- Do not store secret values in generated scenario state.

## Target Shape

Possible directory shape:

```text
deploy/
  scenario-engine/
    define.ts
    runner.ts
    stores/
      env-file-store.ts
    ui/
      cli-ui.ts

  providers/
    cloudrun/
      actions.ts
    cloudflare-pages/
      actions.ts
    neon/
      actions.ts
    upstash/
      actions.ts

  scenarios/
    cloudrun-cloudflare-neon-upstash/
      scenario.ts
```

Compatibility wrappers may keep old script paths working while this shape is
introduced incrementally.

## Core Interfaces

The exact implementation can change, but the first implementation should stay
close to this shape.

### Input Definitions

```ts
type InputDefinition =
  | { kind: "text"; name: string; label?: string; optional?: boolean }
  | { kind: "secret"; name: string; label?: string; optional?: boolean };
```

Input definitions are for humans and UI adapters. In CLI, each input becomes a
prompt. In web, each input becomes a form field.

### Provider Functions

```ts
type ProviderFunction<Input, Output> = (input: Input) => Promise<Output>;
```

Provider functions are normal TypeScript functions. They can wrap existing
shell scripts at first:

```ts
export async function syncSecrets(input: {
  PROJECT_ID: string;
  DATABASE_URL: string;
  DATABASE_URL_DIRECT: string;
  REDIS_URL: string;
}): Promise<{
  syncedSecrets: string[];
}> {
  return runShell("deploy/cloudrun/scripts/sync-secrets.sh", {
    env: input,
    redact: ["DATABASE_URL", "DATABASE_URL_DIRECT", "REDIS_URL"],
  });
}
```

### Scenario Steps

```ts
const syncBackendSecrets = step({
  id: "cloudrun.sync-secrets",
  title: "Sync backend runtime secrets",
  guide: `
Paste Neon and Upstash connection strings. They will be written to Google
Secret Manager.
`,
  inputs: {
    PROJECT_ID: text(),
    DATABASE_URL: secret(),
    DATABASE_URL_DIRECT: secret(),
    REDIS_URL: secret(),
  },
  run: cloudrun.syncSecrets,
  outputs: ["syncedSecrets"],
});
```

### Scenario Definition

```ts
export const cloudrunCloudflareNeonUpstash = scenario({
  id: "cloudrun-cloudflare-neon-upstash",
  title: "Cloud Run + Cloudflare Pages + Neon + Upstash",
  steps: [
    step({
      id: "cloudrun.bootstrap",
      title: "Bootstrap Google Cloud",
      guide: `
Create or select the Google Cloud project and prepare Cloud Run infrastructure.
`,
      inputs: {
        PROJECT_ID: text(),
        GITHUB_REPOSITORY: text(),
        BILLING_ACCOUNT_ID: text().optional(),
      },
      run: cloudrun.bootstrap,
      outputs: [
        "PROJECT_NUMBER",
        "GCP_SERVICE_ACCOUNT",
        "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT",
      ],
    }),

    syncBackendSecrets,

    step({
      id: "cloudflare.pages",
      title: "Prepare Cloudflare Pages",
      guide: `
Create or configure the Pages project for GitHub Actions direct upload.
`,
      inputs: {
        CLOUDFLARE_ACCOUNT_ID: text(),
        CLOUDFLARE_API_TOKEN: secret(),
        CLOUDFLARE_PAGES_PROJECT_NAME: text(),
      },
      run: cloudflarePages.prepareProject,
      outputs: ["WEBAPP_URL"],
    }),
  ],
});
```

### Runner

```ts
await runScenario(cloudrunCloudflareNeonUpstash, {
  ui: cliUi(),
  store: envFileStore("deploy/scenarios/cloudrun-cloudflare-neon-upstash/state.env"),
});
```

Future web usage should be possible without rewriting the scenario:

```tsx
<ScenarioWizard scenario={cloudrunCloudflareNeonUpstash} store={browserStore} />
```

## Phase 1: Thin Design Spike

- [ ] Decide whether to implement the engine in plain TypeScript plus a small
      prompt library, or to compile the scenario DSL into XState while keeping
      XState hidden behind the project-owned interfaces.
- [x] Keep the project-owned `scenario`, `step`, `text`, `secret`, provider
      function, UI adapter, and state store interfaces as the authoring API in
      both prototypes.
- [x] Prototype one tiny scenario with a plain ESM runner.
- [x] Prototype the same tiny scenario with the project-owned DSL compiled to
      XState.
- [x] Compare the two prototypes side by side for scenario readability, engine
      code size, testability, CLI/web portability, persistence/resume support,
      branching/retry support, and how much XState vocabulary leaks into
      provider or scenario files.
- [x] Decide to use the XState-backed runner by default because
      persistence/resume, previewable flow, retries, branching, and future web
      wizard behavior are worth the small extra engine cost. Retain the plain
      runner as a fallback/reference implementation.
- [ ] Decide whether input schemas should use a dependency such as Zod or a
      tiny first-party schema.
- [ ] Define the minimal `scenario`, `step`, `text`, `secret`, `runScenario`,
      UI adapter, and state store interfaces.
- [x] Write one small example scenario in a test or fixture before touching
      real provider scripts.

### Phase 1 Progress

- [x] Added `deploy/scenario-engine` as a small Rush project for the design
      spike.
- [x] Added a shared project-owned DSL in `deploy/scenario-engine/src/define.mjs`.
- [x] Added a plain linear ESM runner in
      `deploy/scenario-engine/src/plain-runner.mjs`.
- [x] Added an XState-backed runner in
      `deploy/scenario-engine/src/xstate-runner.mjs` that compiles the same DSL
      to a machine while keeping XState behind the compiler boundary.
- [x] Added one tiny fake scenario fixture and tests for both runners before
      touching real provider scripts.
- [x] Added `deploy/scenario-engine/SPIKE_COMPARISON.md` with the side-by-side
      comparison notes.
- [x] Chose the XState-backed runner as the default execution engine while
      keeping the plain runner as a fallback/reference implementation.

## Phase 2: Add Scenario Engine Skeleton

- [x] Add the smallest possible scenario engine module.
- [x] Add a CLI UI adapter that can prompt for missing text/secret inputs.
- [x] Add a local JSON state store that persists non-secret outputs and can load
      existing values.
- [x] Add a shell runner helper with redaction support.
- [x] Add unit tests for input collection, output handoff, secret redaction,
      and step ordering.

### Phase 2 Progress

- [x] Added a scenario store persistence/resume contract for the XState-backed
      runner: `loadValues`, `saveOutputs`, `loadSnapshot`, `saveSnapshot`, and
      `clearSnapshot`.
- [x] Updated the XState-backed runner to persist sanitized actor snapshots
      while active, restore from `loadSnapshot`, clear snapshots after
      completion, and support `fresh: true` for starting from scratch.
- [x] Added tests that simulate interruption after step 1, resume at step 2
      without re-running step 1, verify secret values are not present in the
      persisted snapshot, and verify fresh runs ignore saved progress.
- [x] Added a local JSON file store for CLI state with serialized writes for
      snapshot/output races.
- [x] Added a CLI UI adapter that prints step guidance, prompts for missing
      text/secret inputs, and hides secret input on TTY prompts.
- [x] Added a fake executable demo scenario with `--state`, `--fresh`, and
      `--var KEY=value` support.
- [x] Updated `fresh: true` to ignore stored values as well as stored
      snapshots for the current run.
- [x] Added tests for the JSON store, CLI non-interactive execution, fresh-run
      stored-value isolation, and secret redaction in CLI output.
- [x] Added a `runShell` helper that can wrap existing scripts, pass typed
      environment values, stream/capture redacted output, redact command args,
      and throw redacted `ShellCommandError` failures.
- [x] Added tests for successful shell execution, streamed log redaction,
      command-argument redaction, and failure stderr redaction.

## Phase 3: Wrap Existing Provider Scripts

- [x] Create a Cloud Run provider module with functions that replace or wrap
      existing Cloud Run setup scripts.
- [ ] Create a Cloudflare Pages provider module with functions that wrap
      existing Cloudflare setup scripts.
- [ ] Create Neon and Upstash provider modules for manual-input guidance first.
- [x] Add a Cloud Run provider action for syncing backend runtime secrets into
      Secret Manager.
- [x] Keep provider functions small and named after provider actions, not
      scenario steps.
- [ ] Do not change existing shell script behavior unless the change is needed
      for the wrapper and covered by a check.

### Phase 3 Progress

- [x] Added `deploy/providers/cloudrun` as a TypeScript Rush project for a
      Cloud Run provider design spike.
- [x] Added typed `bootstrapCloudRun(input, deps)` orchestration with
      bash-compatible defaults and an output object matching the current
      bootstrap script's useful values.
- [x] Added dependency interfaces for project, billing, service usage, Artifact
      Registry, IAM, and Workload Identity operations so concrete SDK clients
      can be added incrementally.
- [x] Added an SDK-first policy: prefer official Google Cloud Node clients,
      use Google's official `googleapis` generated clients where Cloud clients
      do not expose the needed IAM/WIF surface, and avoid custom REST unless
      no official Google client supports the operation.
- [x] Added fake-dependency tests for defaults, orchestration order, output
      shape, and optional billing behavior.
- [x] Added the first concrete SDK-backed dependency,
      `createGoogleProjectsDependency`, using `@google-cloud/resource-manager`
      for `ensureProject` and `getProjectNumber`.
- [x] Added fake `ProjectsClientLike` tests for existing projects, missing
      project creation, long-running operation awaiting, project-number
      parsing, and non-404 error propagation.
- [x] Added `createGoogleServicesDependency` using
      `@google-cloud/service-usage` for `enableServices`.
- [x] Updated bootstrap orchestration to read `PROJECT_NUMBER` before enabling
      services, because Service Usage batch enable uses a `projects/{number}`
      parent.
- [x] Added fake `ServiceUsageClientLike` tests for batch enable, single-service
      enable, 20-service batch splitting, empty input no-op, and project parent
      formatting.
- [x] Added `createGoogleArtifactRegistryRepositoryDependency` using
      `@google-cloud/artifact-registry` for `ensureDockerRepository`.
- [x] Added fake `ArtifactRegistryClientLike` tests for existing repository
      no-op, missing Docker repository creation, long-running operation
      awaiting, non-404 error propagation, and Artifact Registry resource name
      formatting.
- [x] Added repository-scoped Artifact Registry IAM binding support through the
      same dependency, using `getIamPolicy` and `setIamPolicy`.
- [x] Added fake IAM policy tests for adding a member to an existing binding,
      adding a missing role binding, skipping an existing member, and keeping
      conditional bindings separate from unconditional bindings.
- [x] Added `createGoogleIamDependency` using Google's official
      `@googleapis/iam` IAM v1 client for `ensureServiceAccount`.
- [x] Added fake IAM service account tests for existing account no-op, missing
      account creation, non-404 error propagation, and IAM service account
      resource name formatting.
- [x] Added Resource Manager-backed project IAM binding support to
      `createGoogleIamDependency`, using project `getIamPolicy` and
      `setIamPolicy`.
- [x] Moved shared IAM binding mutation into a reusable helper and covered
      project IAM tests for existing binding append, missing role binding,
      existing member no-op, and conditional binding preservation.
- [x] Added service-account-scoped IAM binding support to
      `createGoogleIamDependency`, using `@googleapis/iam` service account
      `getIamPolicy` and `setIamPolicy`.
- [x] Reused the shared IAM binding mutation helper for service-account IAM and
      covered existing binding append, missing role binding, existing member
      no-op, requested policy version, and conditional binding preservation.
- [x] Added `createGoogleWorkloadIdentityDependency` using `@googleapis/iam`
      IAM v1 for Workload Identity pool creation and GitHub OIDC provider
      creation.
- [x] Added fake Workload Identity tests for existing resource no-op, missing
      pool/provider creation, long-running operation polling, non-404 error
      propagation, failed operation surfacing, and resource name formatting.
- [x] Added `createGoogleBillingDependency` using `@google-cloud/billing` for
      optional project billing-account links.
- [x] Added fake Cloud Billing tests for already-linked no-op, missing link,
      account switch, disabled billing re-link, error propagation, and billing
      resource name formatting.
- [x] Added `createGoogleCloudRunProviderDeps` as the default composition
      factory for all real Google-backed Cloud Run bootstrap dependencies.
- [x] Added a composition test with injected lightweight factory outputs so
      verification does not initialize real Google clients.
- [x] Added `deploy-provider-cloudrun` as a scenario-engine dependency and
      introduced `createCloudRunBootstrapStep` as the first real scenario
      action wrapper.
- [x] Added a scenario-engine action test that injects fake Cloud Run provider
      functions, verifies input mapping, and persists generated bootstrap
      outputs without initializing Google clients.
- [x] Added Cloud Run bootstrap resume and error handling improvements:
      missing ADC guidance, quota-project guidance for fresh-project flows,
      billing-required pause/retry, and exact project details in the manual
      billing prompt.
- [x] Added `syncCloudRunRuntimeSecrets(input, deps)` and an SDK-backed
      Secret Manager dependency using `@google-cloud/secret-manager`.
- [x] Matched the existing `sync-secrets.sh` behavior: create/update
      `DATABASE_URL`, `DATABASE_URL_DIRECT`, and `REDIS_URL`; grant deployer
      access to all three; grant runtime access to `DATABASE_URL` and
      `REDIS_URL`.

## Phase 4: Add First Real Scenario

- [x] Add `cloudrun-cloudflare-neon-upstash` as the first scenario.
- [x] Keep the scenario file readable enough to serve as the production setup
      runbook.
- [x] Make the CLI runner execute one step at a time, showing the step guide
      and prompting only for missing inputs.
- [x] Persist generated non-secret outputs for later steps.
- [x] Ensure secret inputs are never persisted as generated state.

### Phase 4 Progress

- [x] Added `deploy/scenarios/cloudrun-cloudflare-neon-upstash/scenario.mjs`
      as the first production scenario skeleton.
- [x] Wired the scenario into `deploy-scenario-engine` CLI and package scripts
      while keeping the existing demo command intact.
- [x] Started the first scenario slice with one real provider action:
      `cloudrun.bootstrap`, then added small manual credential steps and a
      focused `cloudrun.runtime-secrets` action after the entrypoint stayed
      readable.
- [x] Added a scenario test that runs the skeleton through the XState runner
      with injected Cloud Run provider functions, avoiding real Google Cloud
      calls.
- [x] Added a local `google.project` scenario step that prompts for
      `PROJECT_NAME`, accepts optional `PROJECT_ID` overrides, and generates a
      valid persisted Google Cloud project ID when no override is supplied.
- [x] Added a manual billing enablement pause/retry path for Cloud Run
      bootstrap when Google reports that billing is required for service
      activation.
- [x] Added `completionSections` metadata and CLI rendering for structured
      handoff summaries, including the Cloud Run backend GitHub repository
      variables.
- [x] Persisted `GITHUB_REPOSITORY` as a non-secret Cloud Run bootstrap output
      so later scenario steps and summaries can reuse it.
- [x] Added a manual Neon database credentials step that validates
      `DATABASE_URL` and `DATABASE_URL_DIRECT` as PostgreSQL URLs while keeping
      them as transient secrets.
- [x] Added a manual Upstash Redis credentials step that validates `REDIS_URL`
      as a Redis/TLS Redis URL while keeping it as a transient secret.
- [x] Hardened interrupted/resumed secret prompts so failed snapshots are not
      restored, secret values are redacted without deleting input definitions,
      empty required input is rejected, and steps whose outputs already exist
      are skipped on resume.
- [x] Added a Cloud Run runtime secrets sync step that writes `DATABASE_URL`,
      `DATABASE_URL_DIRECT`, and `REDIS_URL` into Google Secret Manager without
      storing the secret values in scenario state.

## Phase 5: Documentation And Migration

- [x] Document how to run the scenario from CLI.
- [ ] Document how the same scenario model can be used by a future web wizard.
- [x] Update AI deployment guidance only after implemented behavior exists.
- [ ] Keep existing provider docs and scripts aligned during migration.
- [ ] Decide later whether old helper scripts remain public entrypoints or
      become compatibility wrappers.

## Acceptance Criteria

- [ ] A scenario file is easy to read as an ordered production setup flow.
- [ ] Provider functions remain focused and testable.
- [ ] The CLI runner and future web wizard can share the same scenario
      definition.
- [ ] Existing deploy scripts still work.
- [ ] Secret values are redacted and are not stored in generated scenario
      state.
- [ ] The implementation is meaningfully smaller and simpler than the previous
      typed orchestration attempt.

## Open Questions

- [ ] Should the schema layer use Zod, or is a tiny first-party schema enough?
- [ ] Should provider functions return plain output objects, or a richer result
      with logs/warnings/next actions?
- [x] Should the first CLI be interactive only, or also support non-interactive
      `--var KEY=value` execution?
- [ ] How should scenario state be named for multiple deployments of the same
      repository?
- [ ] How much markdown should be allowed in `guide` before it becomes a docs
      maintenance problem?
