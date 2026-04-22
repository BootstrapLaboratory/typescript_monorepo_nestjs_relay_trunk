# Dagger Integration Summary

The Dagger release integration is complete.

Current GitHub Actions release graph:

1. `detect`
2. `package`
3. `deploy`

Current source of truth:

- release graph and target ordering:
  [../.dagger/deploy/services-mesh.yaml](../.dagger/deploy/services-mesh.yaml)
- per-target deploy metadata and runtime rules:
  [../.dagger/deploy/targets](../.dagger/deploy/targets)
- release workflow entrypoint:
  [../.github/workflows/ci-release.yaml](../.github/workflows/ci-release.yaml)
- Dagger API surface:
  [../dagger/src/index.ts](../dagger/src/index.ts)

Current runtime model:

- GitHub and other CI wrappers package artifacts outside Dagger
- CI writes one flat `dagger-deploy.env` file
- `deploy-release` computes waves from the selected targets and the service
  mesh internally, logs the plan, and then executes it through one generic
  target runtime path
- portable target scripts remain under [../scripts/ci](../scripts/ci)

Current documentation:

- release flow notes:
  [../docs/notes/ReleaseFlow.md](../docs/notes/ReleaseFlow.md)
- GitLab wrapper example:
  [../docs/notes/GitLabReleaseExample.md](../docs/notes/GitLabReleaseExample.md)
  and
  [../examples/gitlab/ci-release.gitlab-ci.yml](../examples/gitlab/ci-release.gitlab-ci.yml)

The current interface and remaining hardening work are tracked in
[REFORM_DAGGER_RELEASE_INTERFACE.md](./REFORM_DAGGER_RELEASE_INTERFACE.md).
