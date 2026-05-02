# How To Evolve The Project

This tutorial has described the architecture as it exists. This final chapter
is a playbook for changing it without losing the boundaries that make it
understandable.

The first question for any change should be:

```text
Which boundary owns this behavior?
```

Most mistakes come from putting behavior in a convenient place instead of the
owning place. A React component should not know about Cloudflare project setup.
A GitHub workflow should not become a hand-written build script. A provider
scenario should not publish production artifacts from a local working tree.

Use this chapter as a map for common changes.

## Start With Ownership

Before adding files, decide which layer owns the change.

| Change type              | Primary owner                                      |
| ------------------------ | -------------------------------------------------- |
| GraphQL API shape        | `apps/server` plus generated `libs/api/schema.gql` |
| Frontend data usage      | `apps/webapp` Relay operations                     |
| Backend runtime behavior | `apps/server` feature modules                      |
| Browser product UI       | `apps/webapp/src/features`                         |
| Shared browser policy    | `apps/webapp/src/shared`                           |
| Reusable visual control  | `apps/webapp/src/ui`                               |
| Deploy artifact shape    | Rush project scripts and `.dagger/package`         |
| Deploy execution         | `.dagger/deploy` and `deploy/<provider>/scripts`   |
| Provider setup API       | `deploy/providers/<provider>`                      |
| Guided setup flow        | `deploy/scenarios/<scenario>` and `deploy/wizard`  |

If a change touches more than one row, make each boundary explicit. Do not
hide a cross-boundary change in one layer.

## Adding A GraphQL Field

A GraphQL field starts on the server. The server owns the schema because it
implements the runtime behavior.

Typical path:

1. Add or update the resolver, service method, DTO model, input, scalar, or
   access-control decorator under `apps/server/src/modules`.
2. If the field depends on persistence, update the TypeORM entity and create a
   new migration.
3. If the resolver or type lives outside an already-listed schema manifest
   path, update `apps/server/src/graphql/schema-manifest.ts`.
4. Regenerate the committed schema:

   ```text
   npm --prefix apps/server run graphql:schema
   ```

5. Review the `libs/api/schema.gql` diff as an API contract change.
6. Update webapp Relay operations only when the browser needs the new field.
7. Regenerate Relay artifacts:

   ```text
   npm --prefix apps/webapp run relay
   ```

8. Run verification:

   ```text
   npm run rush -- verify
   npm run rush:build
   ```

The important consequence is that a schema diff is not noise. It is the public
contract between runtime processes. Code review should treat it like an API
change, even when the implementation diff is small.

## Adding A Server Module

A server module belongs under `apps/server/src/modules/<name>`.

Use the existing feature-module shape:

```text
resolver
service
DTOs and inputs
entities when persistence is needed
mapper/profile code when conversion is non-trivial
module wiring
tests near the behavior they protect
```

Register the module in the server application module only when it is runtime
behavior. Register resolvers and orphaned schema types in the schema manifest
when the GraphQL generator needs to see them.

If the module introduces database tables or columns, create a new migration.
Do not edit an already-committed migration that might have been applied.

If the module introduces protected operations, use the shared access-control
guards, decorators, and principal contract. Do not make a resolver depend on a
specific identity provider implementation.

If the module introduces subscriptions or cross-instance events, use the shared
pub/sub direction. Production and validation use Redis-backed pub/sub, so
module code should not assume in-memory process-local delivery is enough.

Checks to run depend on the blast radius:

```text
npm --prefix apps/server run test
npm --prefix apps/server run graphql:schema
npm run rush -- verify
npm run rush:build
```

For migration-heavy work, also run migration commands against the local
devcontainer database before relying on CI.

## Adding A Webapp Feature

A product feature belongs under `apps/webapp/src/features/<name>`.

The feature folder should own the product-facing pieces:

```text
pages/
components/
relay/
assets/
```

Only create the folders the feature needs. The pattern is consistency, not
ceremony.

Use route files as adapters. Add or update the route in `src/app/router.tsx`
and `src/routes`, but keep page composition, feature assets, styles, and Relay
documents in the feature folder.

If the feature needs server data:

1. Put GraphQL documents in the feature `relay` folder.
2. Use Relay hooks or preloaded queries.
3. Keep transport policy in `src/shared/relay`.
4. Use `src/shared/realtime` for subscriptions instead of creating a new
   websocket client.
5. Regenerate Relay artifacts:

   ```text
   npm --prefix apps/webapp run relay
   ```

If the feature needs shared browser behavior, put that behavior in
`src/shared` only when more than one feature or the app shell needs it. Keep
feature-specific state inside the feature.

If the feature needs reusable controls, prefer adding or extending `src/ui`
components instead of styling one-off controls inside the feature.

Useful checks:

```text
npm --prefix apps/webapp run relay
npm --prefix apps/webapp run build
npm --prefix apps/webapp run lint
```

For visual component work, add or update Storybook stories for plain views and
reusable UI pieces.

## Adding A Deploy Target

A deploy target is more than a script. It is a Rush project plus release
metadata.

The target name should match the Rush `packageName`. That is what lets Rush
Delivery stay generic.

Typical path:

1. Add or identify the Rush project in `rush.json`.
2. Give the project package scripts for `build`, and when useful, `verify`,
   `lint`, and `test`.
3. Add package metadata under `.dagger/package/targets/<target>.yaml`.
4. Add deploy metadata under `.dagger/deploy/targets/<target>.yaml`.
5. Add the target to `.dagger/deploy/services-mesh.yaml`.
6. Add validation metadata under `.dagger/validate/targets` only when generic
   project scripts are not enough.
7. Put provider deploy behavior under `deploy/<provider>/scripts`, not inside
   application modules.
8. Wire any required GitHub repository variables or secrets through the
   pre-deploy setup path.

Package metadata answers:

```text
What artifact should be deployed?
```

Deploy metadata answers:

```text
How should the artifact be deployed, and with which runtime permissions?
```

Service mesh metadata answers:

```text
When may this target deploy relative to other targets?
```

After editing metadata, run the Rush Delivery metadata contract validator:

```text
dagger -m github.com/BootstrapLaboratory/rush-delivery@v0.5.0 call validate-metadata-contract --repo=.
```

Then run local QA and Rush verification:

```text
trunk check -a -y
npm run rush -- verify
npm run rush:build
```

The design consequence is that adding a target should not require teaching
GitHub Actions a new mini-release system. GitHub Actions remains the trigger
and credential adapter. Target behavior belongs in metadata and provider
scripts.

## Adding A Provider Function

Provider functions belong under:

```text
deploy/providers/<provider>
```

They should express provider operations as typed functions with injectable
dependencies. That is what makes them testable without calling the live cloud
provider in verification.

Use the existing provider packages as the pattern:

- Cloud Run provider functions wrap Google SDK-backed bootstrap and Secret
  Manager work.
- Cloudflare Pages provider functions wrap Pages project provisioning.
- GitHub provider functions wrap repository variables and secrets through
  `gh`, sending secrets through stdin.

When adding a provider function:

1. Define input and output types.
2. Keep provider SDK or CLI calls behind dependency interfaces.
3. Add a default dependency factory for real runs.
4. Export the function and types from the provider package entrypoint.
5. Add tests with fake dependencies.
6. Update the provider README when the package's scope changes.
7. Build the provider before using it from a scenario.

Checks usually look like:

```text
npm --prefix deploy/providers/<provider> run test
npm run rush -- verify
```

Keep deploy and setup separate. If the function publishes a built artifact,
it probably belongs in a provider deploy script called by Rush Delivery. If it
creates or configures resources before release, it belongs in a provider
package.

## Adding A Scenario Step

Scenario steps belong with the concrete scenario:

```text
deploy/scenarios/<scenario>/steps
```

The generic engine should not import provider packages. The step adapter is the
bridge between the generic scenario DSL and provider-specific functions.

When adding a step:

1. Decide what safe outputs prove the step is complete.
2. Declare required `text()` and `secret()` inputs.
3. Keep guide text human-readable; it may be rendered by CLI or future UI.
4. Validate input shape before calling provider code.
5. Call the provider function through an injectable adapter or lazy-loaded
   built provider package.
6. Return only safe outputs that should be persisted.
7. Add the step to the scenario order.
8. Add or update completion sections when the step creates handoff values.
9. Add tests for the step and scenario flow.

Use `secret()` for values such as provider tokens, database URLs, Redis URLs,
private keys, or anything that should not be written to scenario state.

A scenario step should not deploy production artifacts. Its job is to prepare
the environment or repository configuration so the GitHub Actions release
workflow can deploy later.

Checks usually look like:

```text
npm --prefix deploy/scenarios/<scenario> run test
npm --prefix deploy/wizard run test
npm run rush -- verify
```

## Adding Provider Or Deployment Environment Values

New environment values need extra care because they often cross boundaries.

Ask where the value is needed:

- build-time webapp value
- server runtime value
- deploy script value
- provider setup value
- GitHub Actions variable or secret
- scenario input
- Rush Delivery metadata `pass_env`

Then update only the relevant layer.

For example, a new browser `VITE_*` value is a build-time input. It may need a
deployment-facing `WEBAPP_*` name, package metadata mapping, and webapp build
validation. It should not be treated as a runtime secret.

A new server runtime secret may need Secret Manager sync, Cloud Run deploy
script secret injection, scenario collection or provider setup, and GitHub
documentation. It should not be baked into the webapp bundle.

The rule is simple: environment values should cross only the boundaries that
actually need them.

## Updating Documentation

Architecture documentation should move with architectural changes.

Use the scoped docs as ownership mirrors:

- repository-wide boundary changes: `docs/ai/architecture.md`
- server behavior or schema generation: `apps/server/docs/ai/architecture.md`
- webapp behavior or deployment boundary: `apps/webapp/docs/ai/architecture.md`
- GraphQL contract behavior: `libs/api/docs/ai/architecture.md`
- deployment setup and workflow behavior: `docs/ai/deployment.md` and provider
  deployment docs

Do not update every document by reflex. Update the document that owns the
changed boundary.

For tutorial docs, keep explanations architectural. Prefer the decision,
reason, consequence, and failure mode over long pasted code blocks.

## Choosing Checks

Use checks that match the change.

| Change touches               | Useful checks                                      |
| ---------------------------- | -------------------------------------------------- |
| Markdown/docs                | `trunk check -a -y`                                |
| GraphQL server shape         | `graphql:schema`, `rush -- verify`, `rush:build`   |
| Relay operations             | `webapp relay`, `webapp build`                     |
| Server module                | server tests, schema check, migrations when needed |
| Database schema              | migration generation/run, server tests             |
| Webapp UI                    | webapp lint/build, Storybook when visual           |
| Deploy metadata              | Rush Delivery metadata contract, Rush verification |
| Provider package             | provider tests, Rush verification                  |
| Scenario step                | scenario tests, wizard tests, Rush verification    |
| Production package/container | production build helper or local image build       |

Not every change needs every check. The important habit is to choose checks by
ownership boundary instead of running random commands and hoping they overlap
the risk.

## A Final Mental Model

The project stays maintainable when each layer remains boring:

- server code owns backend runtime behavior
- `libs/api` owns the generated GraphQL contract
- webapp code owns browser behavior and static build output
- Rush owns the monorepo graph
- Rush Delivery owns release orchestration
- provider scripts own repeatable deploy execution
- provider packages own pre-deploy provider APIs
- scenarios own guided setup composition
- GitHub Actions owns credentials and triggers

When a future change feels confusing, it usually means the change crosses more
than one boundary. Split the work by owner, make the handoff explicit, and
then choose checks for each owner.

That is the whole design in miniature.

## Navigation

Previous: [CI Validation And Local Workflows](10-ci-validation-and-local-workflows.md)

Index: [Tutorial README](README.md)
