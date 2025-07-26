# Anonymous Chat

This repository contains a full-stack chat application built with:

- **Client**: Vite, React, Relay
- **Server**: NestJS, GraphQL (Apollo), TypeORM
- **Database**: PostgreSQL
- **Dev tooling**: Relay Compiler, Docker Compose (Postgres), Dockerfiles for production, Trunk.io for code quality, Apollo Sandbox for GraphQL development/testing

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
- **Trunk.io** - DevEx (Developer Experience) platform that uses autonomous, agentic AI to help you detect and root cause problems – before they block your team.

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

### 2. Environment Variables

`.env.development` in both `apps/client/` and `apps/server/`:

`apps/server/.env.development`

```ini
DATABASE_HOST=localhost
```

`apps/client/.env.development`

```ini
VITE_GRAPHQL_HTTP=http://localhost:3000/graphql
VITE_GRAPHQL_WS=ws://localhost:3000/graphql
```

### 3. Run the Server

```bash
cd apps/server
npm ci --legacy-peer-deps
npm run start:dev   # or `nest start --watch`
```

- GraphQL API: `http://localhost:3000/graphql`
- Subscriptions WS: `ws://localhost:3000/graphql`
- Apollo Sandbox: Browse to `http://localhost:3000/graphql` for sandboxing

### 4. Generate Relay Artifacts

In a separate terminal:

```bash
cd apps/client
npm ci
npm run relay        # one-off generation
# or for watch mode (IMPORTANT!!!: for me watchman breaks relay on Windows. only uninstalling watchman will fix project. try it out. If watchman does not work only manual relay run will work):
npm run dev:relay
```

### 5. Run the Client

```bash
cd apps/client
npm run dev
```

Browse to `http://localhost:5173`. You should see the chat UI.

---

## Code Quality

We are using Trunk.io to automate Code Quality checkings.

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

Both client and server have Dockerfiles:

- **Server**: multi-stage build → Node dist → run `node dist/main.js`
- **Client**: multi-stage build → Nginx static serve of `dist/`

Adjust ports and environment variables as needed for your deployment environment.

---

## Tips

- Ensure **Watchman** is installed for Relay’s watch mode on macOS/Linux.
- If you change GraphQL schema on the server, re-run `npm run relay` so the client’s type definitions stay in sync.
- To reset the database, stop Postgres and remove the volume:

  ```bash
  docker-compose down
  ```

docker volume rm client_postgres_data
docker-compose up -d

Happy coding!
