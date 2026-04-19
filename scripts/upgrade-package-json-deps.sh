#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
	cat <<'EOF'
Usage:
  bash scripts/upgrade-package-json-deps.sh root
  bash scripts/upgrade-package-json-deps.sh client
  bash scripts/upgrade-package-json-deps.sh server
  bash scripts/upgrade-package-json-deps.sh all
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

refresh_root_package_lock() {
	echo "Refreshing root package-lock.json..."
	(
		cd "${REPO_DIR}"
		npm install --package-lock-only --ignore-scripts
	)
}

refresh_rush_lockfile() {
	echo "Refreshing Rush lockfile..."
	(
		cd "${REPO_DIR}"
		npx rush update
	)
}

main() {
	local target="${1:-}"

	case "${target}" in
	root)
		run_ncu "${REPO_DIR}" "package.json"
		refresh_root_package_lock
		;;
	client)
		run_ncu "${REPO_DIR}/apps/client" "apps/client/package.json"
		refresh_rush_lockfile
		;;
	server)
		run_ncu "${REPO_DIR}/apps/server" "apps/server/package.json"
		refresh_rush_lockfile
		;;
	all)
		run_ncu "${REPO_DIR}" "package.json"
		refresh_root_package_lock
		run_ncu "${REPO_DIR}/apps/client" "apps/client/package.json"
		run_ncu "${REPO_DIR}/apps/server" "apps/server/package.json"
		refresh_rush_lockfile
		;;
	-h | --help)
		usage
		;;
	*)
		usage >&2
		exit 1
		;;
	esac
}

main "$@"
