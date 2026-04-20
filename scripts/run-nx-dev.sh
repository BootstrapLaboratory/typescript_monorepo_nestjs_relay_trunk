#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

NX_VERSION="22.6.5"
NX_INSTALL_DIR="${REPO_ROOT}/.nx/installation"
NX_BIN="${NX_INSTALL_DIR}/node_modules/nx/bin/nx.js"
NX_PACKAGE_JSON="${NX_INSTALL_DIR}/node_modules/nx/package.json"

installed_nx_version() {
  if [[ ! -f "${NX_PACKAGE_JSON}" ]]; then
    return 1
  fi

  node -p "require(process.argv[1]).version" "${NX_PACKAGE_JSON}"
}

ensure_nx() {
  local current_version=""

  if current_version="$(installed_nx_version 2>/dev/null)"; then
    if [[ "${current_version}" == "${NX_VERSION}" && -f "${NX_BIN}" ]]; then
      return 0
    fi
  fi

  mkdir -p "${NX_INSTALL_DIR}"

  npm install \
    --prefix "${NX_INSTALL_DIR}" \
    --no-save \
    --package-lock=false \
    --no-fund \
    --no-audit \
    "nx@${NX_VERSION}"
}

ensure_nx

cd "${REPO_ROOT}"
exec node "${NX_BIN}" run-many --target=start:dev --projects=api-contract,webapp,server "$@"
