#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(readlink -f -- "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd -- "$(dirname -- "${SCRIPT_PATH}")" && pwd)"
REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/upgrade-package-json-deps.sh --target root
  bash scripts/upgrade-package-json-deps.sh --target docs-site
  bash scripts/upgrade-package-json-deps.sh --target webapp
  bash scripts/upgrade-package-json-deps.sh --target server
  bash scripts/upgrade-package-json-deps.sh --target all

Legacy positional form is also supported:
  bash scripts/upgrade-package-json-deps.sh root
EOF
}

run_ncu() {
  local project_dir="$1"
  local label="$2"

  if [[ ! -f "${project_dir}/package.json" ]]; then
    echo "package.json not found in ${project_dir}" >&2
    exit 1
  fi

  echo "Upgrading dependency ranges in ${label}..."
  (
    cd "${project_dir}"
    npx --yes npm-check-updates@latest --upgrade
  )
}

refresh_rush_lockfile() {
  echo "Refreshing Rush lockfile..."
  (
    cd "${REPO_DIR}"
    node common/scripts/install-run-rush.js update
  )
}

upgrade_root_wrapper() {
  echo "Root package.json is intentionally dependency-free; nothing to upgrade there."
}

parse_args() {
  local target=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --target)
        if [[ $# -lt 2 ]]; then
          echo "--target requires a value" >&2
          exit 1
        fi
        target="$2"
        shift 2
        ;;
      root | docs | docs-site | webapp | server | all)
        target="$1"
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  if [[ -z "${target}" ]]; then
    usage >&2
    exit 1
  fi

  printf '%s\n' "${target}"
}

main() {
  local target
  target="$(parse_args "$@")"

  case "${target}" in
    root)
      upgrade_root_wrapper
      ;;
    docs | docs-site)
      run_ncu "${REPO_DIR}/apps/docs" "apps/docs/package.json"
      refresh_rush_lockfile
      ;;
    webapp)
      run_ncu "${REPO_DIR}/apps/webapp" "apps/webapp/package.json"
      refresh_rush_lockfile
      ;;
    server)
      run_ncu "${REPO_DIR}/apps/server" "apps/server/package.json"
      refresh_rush_lockfile
      ;;
    all)
      upgrade_root_wrapper
      run_ncu "${REPO_DIR}/apps/docs" "apps/docs/package.json"
      run_ncu "${REPO_DIR}/apps/webapp" "apps/webapp/package.json"
      run_ncu "${REPO_DIR}/apps/server" "apps/server/package.json"
      refresh_rush_lockfile
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
