# syntax=docker/dockerfile:1

# trunk-ignore-all(checkov/CKV_DOCKER_2)
# trunk-ignore-all(checkov/CKV_DOCKER_3)

FROM node:24-bookworm-slim AS builder

ENV CI=1
WORKDIR /workspace

COPY . .

# Install the root Rush/Nx tooling, build the backend, then create a pruned
# deployment bundle for runtime without triggering the root postinstall.
RUN npm ci --ignore-scripts \
 && npx rush install --max-install-attempts 1 \
 && npx nx run server:build \
 && npx rush deploy -p server -s server -t /workspace/common/deploy/server --overwrite

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=builder /workspace/common/deploy/server/ /app/

WORKDIR /app/apps/server
EXPOSE 3000

CMD ["node", "dist/main.js"]
