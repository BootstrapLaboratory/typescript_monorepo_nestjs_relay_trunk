# Dagger Module Refactor Summary

This refactor track is complete.

The Dagger module is now split into focused areas under
[../dagger/src](../dagger/src):

- [../dagger/src/index.ts](../dagger/src/index.ts) for the Dagger API surface
- [../dagger/src/model](../dagger/src/model) for shared types
- [../dagger/src/planning](../dagger/src/planning) for release-target parsing,
  service-mesh parsing, and wave construction
- [../dagger/src/stages/deploy](../dagger/src/stages/deploy) for deploy orchestration and
  runtime helpers

The final design no longer uses the intermediate target-specific TypeScript
executor architecture that this refactor originally introduced.

Current source of truth:

- release graph and ordering:
  [../.dagger/deploy/services-mesh.yaml](../.dagger/deploy/services-mesh.yaml)
- per-target deploy metadata and runtime rules:
  [../.dagger/deploy/targets](../.dagger/deploy/targets)

The current interface and follow-up work are tracked in
[REFORM_DAGGER_RELEASE_INTERFACE.md](./REFORM_DAGGER_RELEASE_INTERFACE.md).
