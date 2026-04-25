# syntax=docker/dockerfile:1

# trunk-ignore-all(checkov/CKV_DOCKER_2)
# trunk-ignore-all(checkov/CKV_DOCKER_3)

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY . /app/

WORKDIR /app/apps/server
EXPOSE 3000

CMD ["node", "dist/main.js"]
