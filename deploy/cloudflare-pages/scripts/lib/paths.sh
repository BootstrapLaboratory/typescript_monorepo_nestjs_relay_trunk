#!/usr/bin/env bash

PATHS_SCRIPT_PATH="$(readlink -f -- "${BASH_SOURCE[0]}")"
PATHS_LIB_DIR="$(cd -- "$(dirname -- "${PATHS_SCRIPT_PATH}")" && pwd)"
SCRIPTS_DIR="$(cd -- "${PATHS_LIB_DIR}/.." && pwd)"
CLOUDFLARE_PAGES_DIR="$(cd -- "${SCRIPTS_DIR}/.." && pwd)"
REPO_ROOT="$(cd -- "${CLOUDFLARE_PAGES_DIR}/../.." && pwd)"
DOCS_DIR="${CLOUDFLARE_PAGES_DIR}/docs"
TESTS_DIR="${CLOUDFLARE_PAGES_DIR}/tests"

# Cloudflare Pages currently reuses the shared deploy config that still lives
# under deploy/cloudrun/config. If that config moves higher in the repo later,
# only this path helper should need to change.
SHARED_DEPLOY_DIR="$(cd -- "${CLOUDFLARE_PAGES_DIR}/../cloudrun" && pwd)"
CONFIG_DIR="${SHARED_DEPLOY_DIR}/config"
