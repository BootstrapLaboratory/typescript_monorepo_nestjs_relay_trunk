# trunk-ignore-all(checkov/CKV_DOCKER_2)
# trunk-ignore-all(checkov/CKV_DOCKER_3)
FROM node:24-alpine AS builder

WORKDIR /app

COPY . .

RUN node common/scripts/install-run-rush.js install --max-install-attempts 1
RUN node common/scripts/install-run-rush.js build --to webapp

# 2. Production stage (nginx)
FROM nginx:alpine AS production

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy Vite build output
COPY --from=builder /app/apps/webapp/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
