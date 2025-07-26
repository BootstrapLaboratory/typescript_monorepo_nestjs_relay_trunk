# trunk-ignore-all(checkov/CKV_DOCKER_2)
# trunk-ignore-all(checkov/CKV_DOCKER_3)
# ------------------------------------------------------
# Multi-stage Dockerfile for NestJS production build
# ------------------------------------------------------

# 1. Build stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package manifests
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy the rest of the source code
COPY . .

# Build the NestJS application
RUN npm run build


# 2. Production stage
FROM node:22-alpine AS production

# Set working directory
WORKDIR /usr/src/app

# Copy package manifests (only production deps)
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev --legacy-peer-deps

# Copy compiled output from build stage
COPY --from=builder /usr/src/app/dist ./dist

# (Optional) Copy any static assets if needed
# COPY --from=builder /usr/src/app/public ./public

# Expose the application port (adjust if different)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production
ENV DATABASE_HOST=postgres

# Start the application
CMD ["node", "dist/main.js"]
