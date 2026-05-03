# Rush Monorepo Foundation

Rush is the foundation of the repository. It answers a simple question that
becomes difficult in a growing TypeScript system: which projects exist, how are
they related, and how should commands run across them?

The project uses Rush so that package management, project membership,
dependency-aware commands, and lockfile ownership are centralized. Individual
projects still own their code and dependencies, but Rush owns the workspace
shape.

## Project Identity

`rush.json` declares every Rush project. The important product projects are:

| Package        | Folder         | Role                          |
| -------------- | -------------- | ----------------------------- |
| `server`       | `apps/server`  | NestJS backend                |
| `webapp`       | `apps/webapp`  | React/Vite frontend           |
| `docs`         | `docs`         | Documentation content         |
| `docs-site`    | `apps/docsite` | Docusaurus documentation site |
| `api-contract` | `libs/api`     | Shared GraphQL schema package |

The deployment and setup tools are also Rush projects:

| Package                                            | Folder                                              | Role                                         |
| -------------------------------------------------- | --------------------------------------------------- | -------------------------------------------- |
| `deploy-scenario-engine`                           | `deploy/scenario-engine`                            | Generic scenario DSL and runner              |
| `deploy-scenario-cloudrun-cloudflare-neon-upstash` | `deploy/scenarios/cloudrun-cloudflare-neon-upstash` | Concrete production setup scenario           |
| `deploy-wizard`                                    | `deploy/wizard`                                     | CLI host for scenarios                       |
| `deploy-provider-cloudrun`                         | `deploy/providers/cloudrun`                         | Typed Cloud Run preparation functions        |
| `deploy-provider-cloudflare-pages`                 | `deploy/providers/cloudflare-pages`                 | Typed Cloudflare Pages preparation functions |
| `deploy-provider-github`                           | `deploy/providers/github`                           | GitHub repository configuration functions    |

That second group is important. Deployment preparation is code, and code needs
dependencies, tests, and ownership. Making provider and scenario packages Rush
projects keeps them inside the same dependency and verification model as the
apps.

## Dependency Ownership

Each project declares its own dependencies in its own `package.json`. The root
`package.json` is mostly a command wrapper.

This avoids a common monorepo failure mode: everything depends on a giant root
`node_modules`, and nobody can tell which package actually needs which
dependency.

The consequence is practical:

- backend dependencies belong in `apps/server/package.json`
- webapp dependencies belong in `apps/webapp/package.json`
- documentation content project identity belongs in `docs/package.json`
- Docusaurus dependencies belong in `apps/docsite/package.json`
- provider SDK dependencies belong in the matching `deploy/providers/*`
  package
- shared generated schema belongs in `libs/api`

When a dependency changes, the Rush lockfile is updated through Rush:

```sh
npm run rush:update
```

The repository does not use ad hoc package-manager installs inside project
folders. Rush is the source of truth for installation and lockfile changes.

## Bulk Commands

Rush custom commands live in `common/config/rush/command-line.json`. This
repository defines bulk commands such as:

- `verify`
- `lint`
- `test`
- `dev`

Those commands run project scripts from each selected project. For example,
`verify` runs `npm run verify --if-present` in the selected projects.

That design gives every project a local script surface while still allowing the
repository to run coordinated checks. The server can define GraphQL contract
verification. The webapp can define its own build and lint scripts. Provider
packages can run their own tests. Rush provides the outer orchestration.

## Why Rush Instead Of Plain Workspaces

Plain package-manager workspaces can install dependencies and link packages.
Rush adds a stricter project model around that:

- project membership is explicit in `rush.json`
- dependency-aware commands are part of the normal workflow
- lockfile updates go through one path
- deploy materialization can use Rush concepts
- CI can reason about selected projects and target ownership

That matters because this repository is not only a local development workspace.
It is also a deployable system with release metadata, provider tools, and
generated contracts.

## How Rush Connects To Rush Delivery

Rush Delivery builds on the Rush project graph. Rush tells the repository what
projects exist and how to run project commands. Rush Delivery uses that
foundation to detect affected deploy targets, run validation, build selected
projects, package artifacts, and execute deploy targets.

The split is clean:

- Rush owns project identity, dependency installation, and project commands.
- Rush Delivery owns release stages and deployment orchestration.
- `.dagger` metadata connects Rush projects to package and deploy targets.

This is why package names and deploy target names stay aligned. A target named
`webapp` is easy to reason about because it maps back to a Rush project with
the same name.

## Design Consequences

Adding a new app, provider, or tool is not just creating a folder. It usually
means deciding whether it is a Rush project.

Make it a Rush project when it has its own dependencies, build script, tests, or
release relevance. `docs` and `docs-site` show two sides of that rule: `docs`
is a lightweight content project so documentation edits are visible to release
detection, while `docs-site` owns the Docusaurus dependency set and must build
before the webapp artifact is complete. Keep files as ordinary files when they
are just static configuration owned by another project.

That rule keeps the monorepo from drifting into two extremes: too much global
state at the root, or too many tiny packages with no reason to exist.

## Navigation

Previous: [System Overview](01-system-overview.md)

Next: [GraphQL Contract Boundary](03-graphql-contract-boundary.md)
