# Rush Delivery

Rush Delivery is a Dagger module for Rush-based release workflows. It owns the
release path from source acquisition through detect, validate, build, package,
and deploy while keeping project-specific behavior in metadata.

Start here:

- [Documentation index](docs/README.md)
- [Public Dagger API](docs/api.md)
- [Entrypoints reference](docs/entrypoints.md)
- [Workflow guide](docs/workflows.md)
- [Metadata contracts](docs/metadata.md)
- [Provider adapters](docs/providers.md)
- [AI architecture notes](docs/ai/architecture.md)

Common local checks:

```sh
dagger call self-check --repo=..
```

```sh
dagger call workflow \
  --repo=.. \
  --git-sha="$(git -C .. rev-parse HEAD)" \
  --event-name=workflow_call \
  --force-targets-json='["server","webapp"]' \
  --dry-run=true \
  --toolchain-image-provider=off \
  --rush-cache-provider=off \
  --source-mode=local_copy
```
