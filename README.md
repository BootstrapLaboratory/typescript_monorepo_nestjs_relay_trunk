# Anonymous Chat

This repository contains a full-stack chat application built with:

- **Client**: Vite, React, Relay
- **Server**: NestJS, GraphQL (Apollo), TypeORM
- **Database**: PostgreSQL
- **Dev tooling**: Relay Compiler, Docker Compose (Postgres), Dockerfile for production, Trunk.io for code quality, Apollo Sandbox for GraphQL development/testing

You’ll run the server exposing a GraphQL API at `/graphql` (`/api/graphql` on production) and a WebSocket endpoint for subscriptions, and the client will fetch data and subscribe to real-time updates.

---

## Technologies

- **Vite** – lightning-fast frontend build tool
- **React 19** – modern UI library
- **React Relay 19** – GraphQL client with data masking & subscriptions
- **NestJS** – opinionated Node.js framework for GraphQL & REST APIs
- **Apollo Server** – GraphQL execution engine with subscriptions support
- **TypeORM** – Type-safe database ORM
- **PostgreSQL** – relational database
- **graphql-ws** – WebSocket GraphQL transport
- **Docker** / **Docker Compose** – containerized local development
- **Microsoft Rush** – monorepo dependency + version management (change-file driven releases)
- **Nx** – task runner & build cache for fast, “affected-only” dev/CI workflows
- **Trunk.io** - DevEx platform (autonomous AI code-quality checks)

---

## Prerequisites

- **Node.js** v18+
- **npm** or **yarn**
- **Docker** & **Docker Compose** (for PostgreSQL)
- **Watchman** (optional, for Relay watch mode)

---

## Repository Structure

```plain
/
├─ apps/
│  ├─ client/                # Vite + React + Relay app
│  │  ├─ src/
│  │  ├─ .env.development
│  │  ├─ .env.production
│  │  ├─ relay.config.json
│  │  └─ package.json
│  └─ server/                # NestJS GraphQL server
│     ├─ src/
│     ├─ .env.development
│     ├─ .env.production
│     └─ package.json
├─ docker-compose.yml        # Local Postgres for both client & server
└─ README.md                 # ← you are here
```

---

## Local Development

### 1. Start PostgreSQL

Use Docker Compose to spin up Postgres:

```bash
docker compose up -d postgres
```

By default this creates:

- Database: `chatdb`
- User: `chatuser` / Password: `chatpass`

---

### 2. Environment Variables

`.env.development` in both `apps/client/` and `apps/server/`:

```ini
DATABASE_HOST=localhost
```

```ini
VITE_GRAPHQL_HTTP=http://localhost:3000/graphql
VITE_GRAPHQL_WS=ws://localhost:3000/graphql
```

---

### 3. Install dependencies

At the **repo root**, run:

```bash
npm i
```

This will invoke the `postinstall` hook (which runs `rush install`) and set up all project dependencies.

---

### 4. Run everything in one command

From the **repo root**, run:

```bash
npm run dev
```

This calls NX to run all `start:dev` targets in parallel and launches the NX Dev UI, where you can monitor logs, see build-caching metrics, and more.

Once the servers are up:

- **GraphQL API & WS Subscriptions** → <http://localhost:3000/graphql>
- **React UI** → <http://localhost:5173>

---

## Code Quality

We are using Trunk.io to automate Code Quality checks.

```bash
trunk --help
trunk check --help
trunk check -a
trunk check -a -y
```

---

## Scripts

### Server (`apps/server/package.json`)

| Script      | Description                                |
| ----------- | ------------------------------------------ |
| `start:dev` | `nest start --watch` (live reload)         |
| `start`     | `nest start` (production build in `dist/`) |

### Client (`apps/client/package.json`)

| Script      | Description                                           |
| ----------- | ----------------------------------------------------- |
| `dev`       | `vite` (start dev server)                             |
| `dev:relay` | `relay-compiler --watch` (auto-regenerate artifacts)  |
| `relay`     | `relay-compiler` (one-off generation)                 |
| `build`     | `tsc -b && vite build` (production bundle in `dist/`) |
| `preview`   | `vite preview`                                        |

---

## Production Build

Both client and server have Dockerfile:

- **Server**: multi-stage build → Node dist → run `node dist/main.js`
- **Client**: multi-stage build → Nginx static serve of `dist/`

Adjust ports and environment variables as needed for your deployment environment.

---

## Tips

- Ensure **Watchman** is installed for Relay’s watch mode on macOS/Linux.
- If you change GraphQL schema in the server app, re-run `npm run relay` in client app so the client’s type definitions stay in sync (this happens automatically, if you start dev environment using 'npm run dev' in project's root).
- To reset the database, stop Postgres and remove the volume:

  ```bash
  docker-compose down
  docker volume rm client_postgres_data
  docker-compose up -d
  ```

Happy coding! 🤘💪🤣😍❤
