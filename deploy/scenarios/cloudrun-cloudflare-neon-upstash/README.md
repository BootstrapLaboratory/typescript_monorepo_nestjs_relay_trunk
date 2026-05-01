# Cloud Run + Cloudflare Pages + Neon + Upstash Scenario

This is the first production setup scenario skeleton. It currently collects a
Google Cloud project name, generates and persists a project ID when one is not
provided, executes Cloud Run backend bootstrap through `deploy-provider-cloudrun`,
then collects Neon database URLs as transient secrets.

Cloudflare Pages, Upstash, and Cloud Run Secret Manager sync steps are
intentionally not wired yet. Add them as small provider actions after this
entrypoint stays readable.

## Run

Build the Cloud Run provider first:

```sh
npm --prefix deploy/providers/cloudrun run build
```

Authenticate Google SDK calls with Application Default Credentials. Use
`--disable-quota-project` so Google does not copy the current `gcloud` project
into ADC as a local quota project. The scenario manages the deployment target
project itself.

```sh
gcloud auth application-default login --disable-quota-project
```

If ADC already points at a deleted or stale quota project, recreate it:

```sh
gcloud auth application-default revoke
gcloud auth application-default login --disable-quota-project
```

Run the scenario:

```sh
npm --prefix deploy/scenario-engine run cloudrun-cloudflare-neon-upstash
```

Run non-interactively:

```sh
npm --prefix deploy/scenario-engine run cloudrun-cloudflare-neon-upstash -- \
  --var PROJECT_NAME="Your GCP project name" \
  --var GITHUB_REPOSITORY=owner/repository \
  --var DATABASE_URL="postgres://..." \
  --var DATABASE_URL_DIRECT="postgres://..."
```

Pass `--var PROJECT_ID=your-exact-project-id` only when you need to choose the
immutable Google Cloud project ID yourself. Otherwise the scenario generates a
valid ID from `PROJECT_NAME` and persists it for resume.

Pass `--var BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX` when the scenario should
link a newly created project to a billing account. The scenario does not prompt
for Google tokens; Google SDK calls use Application Default Credentials.

If Google reports that billing is not enabled, the scenario pauses, asks you to
enable billing for the project manually, and retries Cloud Run bootstrap after
you press Enter.

The Neon database URL inputs are secrets. They are validated and stay available
to later steps in the same run, but are not printed in CLI summaries or written
to the scenario state file.

When Cloud Run bootstrap finishes, the CLI prints a Cloud Run backend handoff
section with the GitHub repository variables required by the backend deploy
workflow:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`

Use `--fresh` to ignore saved progress, and `--state <path>` to choose a
specific JSON state file. By default, state is stored at
`~/.config/beltapp/deploy-scenarios/cloudrun-cloudflare-neon-upstash.json`.
