# Move Source Checkout To Dagger

## Context

The GitHub release workflow still prepares the source tree outside Dagger:

```yaml
- name: Checkout source code
  uses: actions/checkout@v5
  with:
    fetch-depth: 0

- name: Fetch remote tags
  run: git fetch --force --tags origin
```

That works, but it means Dagger receives a host-mounted repository directory as
the workflow source. This is one reason Rush install cache behavior differs from
the old GitHub cache action: restored files may cross Dagger mount/layer
boundaries when Rush recycles `node_modules`.

The longer-term framework shape should let Dagger own source acquisition. CI can
still perform small provider-specific setup steps, but detect, build, package,
deploy, and their source checkout/fetch requirements should live inside Dagger.

## Decision

Create a Dagger-owned source acquisition layer before changing Rush cache
semantics again.

The implementation should stop running workflow stages directly from the
host-mounted `repo: Directory`. Local/dev runs should copy the mounted directory
into a Dagger-owned filesystem first. CI runs should use Git source mode, which
clones/fetches the workflow source into a Dagger-owned container filesystem,
including the tags needed by deploy detection.

When this Dagger framework later moves to a dedicated repository, GitHub
Actions should be able to call the framework module and pass the application
repository URL/ref/SHA instead of checking out the full application source just
to run the workflow.

## Design Notes

- Keep `repo: Directory` only as the local/dev input to `local_copy` mode. Do not
  keep a direct mounted-workspace execution mode.
- Use `local_copy` for local/dev workflows that should not need Git credentials.
  The copied source should remove transient Rush/Dagger state and `node_modules`
  so later stages run from a clean Dagger-owned filesystem.
- Use `git` for CI workflows.
- Treat source acquisition as a provider-independent framework concern.
- GitHub should provide source coordinates through environment variables or
  explicit Dagger parameters, not custom GitHub-only code paths.
- Required source inputs likely include remote URL, ref name, commit SHA, event
  name, PR base SHA, and an optional token/credential secret.
- Fetch deploy tags inside Dagger because release detection depends on deploy
  tag state.
- Fetch PR base commits inside Dagger because Rush validation uses
  `rush list --from git:<base-sha>`.
- Do not re-enable `node_modules` caching as part of this task. After source
  acquisition is Dagger-owned, create a separate validation task to prove whether
  `node_modules` can be safely cached without `EXDEV`.
- Phase 1 public API decision: keep the existing `repo: Directory` parameter as
  local/dev input for `local_copy`. Add Git source inputs later when the runner
  is ready, instead of mixing unproven source parameters into the public workflow
  entrypoint first.
- Phase 4 GitHub decision: keep `actions/checkout` only while the Dagger module
  lives in this repository. The workflow source itself is fetched inside Dagger
  with Git source mode. When the framework moves to a dedicated repository, CI
  can call the module from there and stop checking out the application source
  before `dagger call workflow`.

## Implementation Checklist

### Phase 1: Source Model

- [x] Add a source acquisition model for `local_copy` and `git`.
- [x] Define provider-neutral source inputs and defaults.
- [x] Decide the public Dagger API shape for source mode without breaking local
  `--repo=..` workflows.
- [x] Add tests for source input validation and normalized source plans.

### Phase 2: Git Checkout Runner

- [x] Implement a Dagger Git checkout container that clones or fetches the
  configured repository.
- [x] Checkout the exact requested commit SHA before running detect/build/package.
- [x] Fetch deploy tags, or at minimum tags matching `DEPLOY_TAG_PREFIX`.
- [x] Fetch PR base SHA/ref when validation requires `rush list --from`.
- [x] Keep token handling secret-safe and avoid printing credentials in logs.
- [x] Add tests for generated Git command plans.

### Phase 3: Workflow Integration

- [x] Make `workflow` resolve the source directory before metadata contract,
  detect, build, package, and deploy stages.
- [x] Keep the existing `repo: Directory` input working through `local_copy` for
  local development and incremental rollout.
- [x] Update build/package/deploy code to consume the resolved source directory
  rather than assuming the caller-provided directory is the workflow source.
- [x] Confirm deploy file mounts and credentials still work when source is
  internally cloned.

### Phase 4: GitHub CI Adapter

- [x] Update `.github/workflows/ci-release.yaml` to pass source coordinates into
  Dagger.
- [x] Remove host-side `git fetch --force --tags origin` after Dagger fetches
  deploy tags itself.
- [x] Decide whether GitHub still needs a minimal checkout while the Dagger
  module lives inside this repository.
- [x] Document the future dedicated-framework-repository path where even the
  module checkout can disappear.

### Phase 5: Cache Follow-Up

- [x] Re-test Rush install cache with Dagger-owned source checkout.
- [x] Decide whether `node_modules` can be safely cached inside the
  Dagger-owned filesystem.
- [x] If `node_modules` is safe, add it back in a separate cache metadata
  version and prove both cache miss and cache hit in real CI.
- [x] If `node_modules` is still unsafe, document that the stable cache payload
  is `install-run` plus `pnpm-store`.
  Not applicable after the Dagger-owned source checkout validation:
  `node_modules` is safe in the current Dagger-owned source/cache flow, and the
  cache payload is `common/temp/node_modules` plus `common/temp/pnpm-store`.

### Phase 6: Validation

- [x] Run Dagger unit tests.
- [x] Run `dagger call self-check --repo=..`.
- [x] Run local workflow dry-run with local-copy source mode.
- [x] Run local workflow dry-run with Git source mode.
- [x] Run real GitHub CI for a PR validation path.
  User confirmed the real PR validation CI path is green.
- [x] Run real GitHub CI for a release/deploy path with Git source acquisition
  and source-acquisition toolchain image optimization.

## Non-Goals

- Do not run release workflow stages directly from a host-mounted source tree.
- Do not make GitHub Actions the only source provider.
- Do not solve package registry releases here.
- Do not rework deploy toolchain images here.
