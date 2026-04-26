#!/usr/bin/env bash

PATHS_SCRIPT_PATH="$(readlink -f -- "${BASH_SOURCE[0]}")"
PATHS_LIB_DIR="$(cd -- "$(dirname -- "${PATHS_SCRIPT_PATH}")" && pwd)"
SCRIPTS_DIR="$(cd -- "${PATHS_LIB_DIR}/.." && pwd)"
CLOUDFLARE_PAGES_DIR="$(cd -- "${SCRIPTS_DIR}/.." && pwd)"
REPO_ROOT="$(cd -- "${CLOUDFLARE_PAGES_DIR}/../.." && pwd)"
DOCS_DIR="${CLOUDFLARE_PAGES_DIR}/docs"
TESTS_DIR="${CLOUDFLARE_PAGES_DIR}/tests"

# Cloudflare Pages currently reuses the shared deploy config that still lives
# under deploy/cloudrun/config. Keep this path lazy so minimal deploy workspaces
# do not need to mount the shared config unless a caller actually reads it.
SHARED_DEPLOY_DIR="${CLOUDFLARE_PAGES_DIR}/../cloudrun"
CONFIG_DIR="${SHARED_DEPLOY_DIR}/config"
