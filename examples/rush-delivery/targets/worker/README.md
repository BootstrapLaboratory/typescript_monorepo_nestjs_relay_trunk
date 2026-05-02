# Rush Delivery Worker Target Example

This directory is a copyable example for adding a new deployable Rush project
to a repository that consumes the external Rush Delivery framework.

The example target is named `worker`. In a real project, replace `worker` with
the Rush `packageName` of the project you are adding.

## Files

- [rush-project.json](./rush-project.json) is the `rush.json` project entry to
  add under the top-level `projects` array.
- [services-mesh.snippet.yaml](./services-mesh.snippet.yaml) is the deploy graph
  entry to merge into `.dagger/deploy/services-mesh.yaml`.
- [package-target.yaml](./package-target.yaml) can be copied to
  `.dagger/package/targets/worker.yaml`.
- [deploy-target.yaml](./deploy-target.yaml) can be copied to
  `.dagger/deploy/targets/worker.yaml`.
- [validation-target.yaml](./validation-target.yaml) is optional and can be
  copied to `.dagger/validate/targets/worker.yaml` when the project needs
  metadata-driven validation beyond Rush `verify`, `lint`, `test`, and
  `build`.

## Checklist

1. Add the Rush project entry from [rush-project.json](./rush-project.json) to
   [rush.json](../../../../rush.json).
2. Add or merge the service entry from
   [services-mesh.snippet.yaml](./services-mesh.snippet.yaml) into
   `.dagger/deploy/services-mesh.yaml`.
3. Copy [package-target.yaml](./package-target.yaml) to
   `.dagger/package/targets/worker.yaml`.
4. Copy [deploy-target.yaml](./deploy-target.yaml) to
   `.dagger/deploy/targets/worker.yaml`.
5. Add the deploy script referenced by `deploy_script`.
6. Optionally copy [validation-target.yaml](./validation-target.yaml) to
   `.dagger/validate/targets/worker.yaml`.
7. Run the metadata validator from the repository root:

```bash
dagger -m github.com/BootstrapLaboratory/rush-delivery@v0.5.0 call validate-metadata-contract --repo=.
```

If validation passes, the new target should participate in Rush Delivery
detect, build, package, deploy, and optional validation without target-specific
framework changes.
