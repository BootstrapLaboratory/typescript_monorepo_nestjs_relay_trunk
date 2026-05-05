#!/usr/bin/env bash

PATHS_SCRIPT_PATH="$(readlink -f -- "${BASH_SOURCE[0]}")"
PATHS_LIB_DIR="$(cd -- "$(dirname -- "${PATHS_SCRIPT_PATH}")" && pwd)"
SCRIPTS_DIR="$(cd -- "${PATHS_LIB_DIR}/.." && pwd)"
CLOUDFLARE_PAGES_DIR="$(cd -- "${SCRIPTS_DIR}/.." && pwd)"
# These variables are consumed by scripts that source this module.
# shellcheck disable=SC2034
{
	REPO_ROOT="$(cd -- "${CLOUDFLARE_PAGES_DIR}/../.." && pwd)"
	DOCS_DIR="${CLOUDFLARE_PAGES_DIR}/docs"
	TESTS_DIR="${CLOUDFLARE_PAGES_DIR}/tests"
	SHARED_DEPLOY_DIR="${CLOUDFLARE_PAGES_DIR}/../cloudrun"
	CONFIG_DIR="${SHARED_DEPLOY_DIR}/config"
}
