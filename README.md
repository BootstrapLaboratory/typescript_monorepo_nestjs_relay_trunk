# Anonymous Chat

## Description

Anonymous Chat is a full-stack monorepo for a real-time chat application.

- `apps/client` contains the React + Vite + Relay frontend.
- `apps/server` contains the NestJS + GraphQL backend with WebSocket subscriptions.
- Local development is designed to run entirely inside the Dev Container.
- Production uses Google Cloud Run for the backend, Neon for PostgreSQL, Upstash for Redis, and Cloudflare Pages for the frontend.

## Local development

This repository is meant to be opened in a Dev Container.

1. Open the repository in VS Code.
2. Run `Dev Containers: Reopen in Container`.
3. Start the project with `npm run dev`.

Local URLs:

- Frontend: <http://localhost:5173>
- GraphQL API: <http://localhost:3000/graphql>

The Dev Container starts the local backing services for you and installs dependencies during container setup, so no cloud services are required for day-to-day development.

More context: [Dev Container notes](docs/notes/DevContainers.md)

## Deployment

Deployment is split by application boundary:

- The backend is built from this monorepo and deployed to Google Cloud Run.
- PostgreSQL is hosted on Neon.
- Redis pub/sub is hosted on Upstash.
- The frontend is deployed separately to Cloudflare Pages and connects to the Cloud Run API.

Step-by-step deployment docs live here:

- [Cloud Run backend deployment](deploy/cloudrun/README.md)
- [Cloudflare Pages frontend deployment](deploy/cloudflare-pages/README.md)
