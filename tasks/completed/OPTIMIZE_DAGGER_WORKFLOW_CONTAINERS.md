# Optimize Dagger Workflow Containers

## Goal

Reduce CI time by sharing one prepared Dagger container for the repository/Rush
part of the composed workflow:

```text
detect -> build -> package
```

Deploy target execution remains isolated per target, because deploy containers
carry provider-specific tools, credentials, and runtime mounts.

## Architecture Decision

This is a physical execution optimization, not a logical stage redesign.

Keep the logical stage boundaries:

- `detect`
- `build`
- `package`
- `deploy`

Use a shared container only inside the composed `workflow` entrypoint for the
repo/Rush stages. The focused public entrypoints remain available for debugging
and isolated local calls.

## Why This Is Safe

`detect`, `build`, and `package` all operate on the repository workspace and
Rush metadata. Sharing one Node/git/Rush environment avoids repeated package
installation and `rush install` work without mixing provider-specific deploy
credentials or Docker socket access into the build/package stage.

Deploy stays isolated:

- each deploy target still uses its own runtime image
- target env pass-through remains constrained by target YAML
- file mounts and Docker socket access only happen during deploy execution

## Checklist

- [x] Add an internal workflow build/package runner.
- [x] Run detect once inside the shared workflow container.
- [x] Run Rush install once for build/package, after detect selects deploy
      targets.
- [x] Mount Dagger-native Rush caches for Rush home, `install-run`, and
      `pnpm-store`.
- [x] Avoid mounting `common/temp/node_modules` directly because Rush renames it
      during install cleanup.
- [x] Use generic framework cache names instead of project-specific names.
- [x] Reuse existing build-stage command planning logic.
- [x] Reuse existing package-stage metadata and action planning logic.
- [x] Keep public focused Dagger entrypoints unchanged.
- [x] Run Dagger unit tests.
- [x] Run TypeScript typecheck.
- [x] Run script-side CI planning tests.
- [x] Validate in real GitHub CI and compare runtime.
