# syntax=docker/dockerfile:1

# trunk-ignore-all(checkov/CKV_DOCKER_2)
# trunk-ignore-all(checkov/CKV_DOCKER_3)

FROM node:24-bookworm-slim AS builder

ENV CI=1
WORKDIR /workspace

COPY . .

# Install git so Rush can validate the repo state in-container, then build the
# backend and create a pruned deployment bundle without relying on a root
# node_modules folder.
# trunk-ignore(hadolint/DL3008)
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/* \
 && node common/scripts/install-run-rush.js install --max-install-attempts 1 \
 && node common/scripts/install-run-rush.js build --to server \
 && node common/scripts/install-run-rush.js deploy -p server -s server -t /workspace/common/deploy/server --overwrite

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=builder /workspace/common/deploy/server/ /app/

WORKDIR /app/apps/server
EXPOSE 3000

CMD ["node", "dist/main.js"]
