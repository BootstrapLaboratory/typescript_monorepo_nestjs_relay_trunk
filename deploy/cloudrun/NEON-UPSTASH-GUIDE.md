# Neon + Upstash Guide

This guide covers the manual provider-side setup needed before
[GCP_GUIDE.md](GCP_GUIDE.md) Step 9 (`Create Secret Manager Secrets`).

It is scoped to the exact stack chosen for this repo:

- PostgreSQL: `Neon`
- shared pub/sub: `Redis`
- Redis provider: `Upstash`

For the full rollout order, also see:

- [PROVISIONING.md](PROVISIONING.md)
- [GCP_GUIDE.md](GCP_GUIDE.md)

## Automation Status

These provider resources are still manual.

- Neon project and connection strings: manual
- Upstash Redis database and credentials: manual

No repo script creates these provider-side resources yet. The existing scripts
start being useful after you copy the resulting values into [`.env`](.env).

## What You Need To Produce

At the end of this guide, you should have these values ready to place into
[.env](.env):

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `REDIS_URL`

## 1. Create Neon PostgreSQL

Neon is the production PostgreSQL provider chosen for this repo.

Recommended choices for this project:

- plan: `Free`
- region: `aws-eu-central-1` if Neon offers it in your account
- project name: anything recognizable, for example `poltapp-prod`
- branch: keep the default `production`
- database and role names: Neon defaults are fine unless you want custom names
- `Neon Auth`: leave it `off`

Why the defaults are fine:

- this repo connects by full connection string
- the code does not require a specific database name like `chatdb`
- the code does not require a specific role name like `chatapp`
- this repo does not currently have an application-auth integration that uses Neon Auth
- for this migration, Neon is only the managed PostgreSQL provider

### Console Steps

1. Open the Neon console and sign in.
2. Click `New Project` or complete the onboarding project creation flow.
3. Choose the `Free` plan if Neon shows multiple plans.
4. Pick region `aws-eu-central-1` if it is available.
5. Enter a project name.
6. Leave `Neon Auth` turned off.
7. Leave the default `production` branch in place.
8. Finish project creation.

Why keep `Neon Auth` off here:

- Neon Auth is an optional managed authentication feature for your application, not a requirement for creating or hosting the database itself.
- This repo currently has no auth module or Better Auth / Neon Auth integration in either the backend or frontend.
- Turning it on now would add another moving part we are not using in the current deployment plan.
- We can revisit it later if you decide to add real user authentication to the app.

### Copy The Two Connection Strings

From the Neon project dashboard:

1. Click `Connect`.
2. In the connection modal, select:
   - branch: `production`
   - database: your default or chosen database
   - role: your default or chosen role
3. Copy the pooled connection string and save it as `DATABASE_URL`.
4. Switch to the direct connection option in the same modal.
5. Copy the direct connection string and save it as `DATABASE_URL_DIRECT`.

Important:

- keep the full connection string exactly as Neon gives it to you
- do not strip query parameters such as `sslmode=require`
- the pooled hostname usually contains `-pooler`
- if the hostname does not contain `-pooler`, that string is the direct connection
- for this repo:
  - `DATABASE_URL` = pooled connection
  - `DATABASE_URL_DIRECT` = direct connection

Current Neon UI note:

- in some Neon onboarding screens, the first connection string shown is the direct connection
- if you see a hostname like `ep-...aws.neon.tech` without `-pooler`, put that value into `DATABASE_URL_DIRECT`
- then open the pooled / connection pooling version in the Neon `Connect` dialog and copy that into `DATABASE_URL`

Example shape:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require"
DATABASE_URL_DIRECT="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require"
```

## 2. Create Upstash Redis

Upstash is the chosen Redis provider for the first rollout.

Recommended choices for this project:

- product: `Redis`
- plan: `Free`
- primary region: the closest available EU region to Cloud Run `europe-west4`
- read regions: none for the first rollout
- `Eviction`: leave it `off`

Region note:

- Cloud Run is fixed to `europe-west4` for this migration
- Upstash region names can change over time
- pick the nearest available European primary region shown in the Upstash UI
- if Frankfurt or another nearby EU region is available, prefer that

### Console Steps

1. Open the Upstash console and sign in.
2. Click `+ Create Database`.
3. Choose `Redis`.
4. Enter a database name, for example `poltapp-prod`.
5. Pick the closest available EU `Primary Region`.
6. Do not add read regions for the first rollout.
7. Leave `Eviction` turned off.
8. Choose the `Free` plan unless you already know you need more.
9. Create the database.

Why keep `Eviction` off here:

- Upstash says eviction is mainly for cache-style workloads.
- This repo uses Redis only as a shared pub/sub event bus, not as a general cache or durable key store.
- With eviction off, hitting the storage limit fails loudly instead of silently deleting keys.
- For this app, that is the safer default.

Practical note:

- Redis pub/sub itself does not depend on keeping a large keyspace, so the free plan should be fine for hobby traffic.
- If you later repurpose this Redis instance for caching, we can revisit the eviction setting then.

### Copy The Redis TCP Credentials

After the database is created:

1. Open the database details page.
2. Go to the `Connect your database` section.
3. Copy these three values:
   - `Endpoint`
   - `Port`
   - `Password`
4. Construct `REDIS_URL` in this exact shape:

```dotenv
REDIS_URL="rediss://:PASSWORD@ENDPOINT:PORT"
```

Important:

- use the Redis TCP credentials, not the REST URL/token pair
- this repo uses `ioredis` and Redis pub/sub, so we need the TLS Redis endpoint
- Upstash enables TLS by default, which is why the URL must start with `rediss://`

## 3. Put The Values Into The Env File

Update [`.env`](.env):

```dotenv
DATABASE_URL="..."
DATABASE_URL_DIRECT="..."
REDIS_URL="rediss://:PASSWORD@ENDPOINT:PORT"
```

## 4. Next Step

After the values are in [`.env`](.env), continue with:

```bash
bash deploy/cloudrun/sync-secrets.sh
```

That will create or update the Google Secret Manager entries used by the Cloud
Run deployment workflow.

## Official Docs

- Neon basics and onboarding:
  [Learn the basics](https://neon.com/docs/get-started/signing-up)
- Neon project management:
  [Manage projects](https://neon.com/docs/manage/projects)
- Neon connection strings:
  [Connecting Neon to your stack](https://neon.com/docs/get-started-with-neon/connect-neon)
- Neon pricing:
  [Pricing](https://neon.com/pricing)
- Upstash Redis getting started:
  [Getting Started](https://upstash.com/docs/redis/overall/getstarted)
- Upstash Redis client connection details:
  [Connect Your Client](https://upstash.com/docs/redis/howto/connectclient)
- Upstash Redis pricing:
  [Pricing](https://upstash.com/pricing/redis)
