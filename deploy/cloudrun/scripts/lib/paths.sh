#!/usr/bin/env bash

PATHS_SCRIPT_PATH="$(readlink -f -- "${BASH_SOURCE[0]}")"
PATHS_LIB_DIR="$(cd -- "$(dirname -- "${PATHS_SCRIPT_PATH}")" && pwd)"
SCRIPTS_DIR="$(cd -- "${PATHS_LIB_DIR}/.." && pwd)"
CLOUDRUN_DIR="$(cd -- "${SCRIPTS_DIR}/.." && pwd)"
# These variables are consumed by scripts that source this module.
# shellcheck disable=SC2034
{
	REPO_ROOT="$(cd -- "${CLOUDRUN_DIR}/../.." && pwd)"
	CONFIG_DIR="${CLOUDRUN_DIR}/config"
	DOCS_DIR="${CLOUDRUN_DIR}/docs"
	TESTS_DIR="${CLOUDRUN_DIR}/tests"
}
