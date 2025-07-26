# trunk-ignore-all(checkov/CKV_DOCKER_2)
# trunk-ignore-all(checkov/CKV_DOCKER_3)
# 1. Build stage
FROM node:22-alpine AS builder

# Install build dependencies
WORKDIR /app/client
COPY client/package.json client/package-lock.json client/tsconfig.json client/relay.config.json ./
RUN npm ci

WORKDIR /app
# Copy rest of source
COPY . .
RUN ls -l
WORKDIR /app/client

# Generate Relay artifacts
# Build the client (TypeScript + Vite)
RUN npm run relay && npm run build

# 2. Production stage (nginx)
FROM nginx:alpine AS production

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy Vite build output
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
