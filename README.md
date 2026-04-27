# Anonymous Chat

## Description

Anonymous Chat is a full-stack monorepo for a real-time chat application.

- `apps/webapp` contains the React + Vite + Relay frontend.
- `apps/server` contains the NestJS + GraphQL backend with WebSocket subscriptions.
- Local development is designed to run entirely inside the Dev Container.
- Production uses Google Cloud Run for the backend, Neon for PostgreSQL, Upstash for Redis, and Cloudflare Pages for the frontend.

## Local development

This repository is meant to be opened in a Dev Container.

1. Open the repository in VS Code.
2. Run `Dev Containers: Reopen in Container`.
3. Start the project with `npm run dev`.

Dependency upgrades: run `npm run deps:upgrade` from the repo root to update dependency ranges across the Rush-managed app packages. For a single package, use `npm run deps:upgrade:webapp` or `npm run deps:upgrade:server`. `npm run deps:upgrade:root` is retained as a compatibility no-op because the repo root is intentionally dependency-free.

Local URLs:

- Frontend: <http://localhost:5173>
- GraphQL API: <http://localhost:3000/graphql>

The Dev Container starts the local backing services for you and installs dependencies during container setup, so no cloud services are required for day-to-day development.

More context: [Dev Container notes](docs/notes/DevContainers.md)

GraphQL codegen ownership and clean-checkout build flow:
[GraphQL codegen notes](docs/notes/GraphqlCodegen.md)

## Deployment

Deployment is orchestrated by one GitHub Actions workflow and then fanned out
to the two runtime hosts:

- GitHub Actions runs the unified [main workflow](.github/workflows/main-workflow.yaml).
- The workflow uses the external
  [Rush Delivery](https://github.com/BootstrapLaboratory/rush-delivery)
  GitHub Action and the app-owned metadata under [.dagger](.dagger).
- The backend is built from this monorepo and deployed to Google Cloud Run.
- PostgreSQL is hosted on Neon.
- Redis pub/sub is hosted on Upstash.
- The frontend is built in GitHub Actions and uploaded to Cloudflare Pages with Wrangler, then connects to the Cloud Run API.

Step-by-step deployment docs live here:

- [Cloud Run backend deployment](deploy/cloudrun/README.md)
- [Cloudflare Pages frontend deployment](deploy/cloudflare-pages/README.md)

Happy coding!
🤘💪🤣😍❤
