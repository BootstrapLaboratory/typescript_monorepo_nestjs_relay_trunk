#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_TARGETS_JSON="${DEPLOY_TARGETS_JSON:-[]}"
targets=()

while IFS= read -r target; do
  targets+=(--to "${target}")
done < <(
  DEPLOY_TARGETS_JSON="${DEPLOY_TARGETS_JSON}" node --input-type=module <<'EOF'
const raw = process.env.DEPLOY_TARGETS_JSON ?? '[]';
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed)) {
  throw new Error('DEPLOY_TARGETS_JSON must be a JSON array.');
}

for (const target of parsed) {
  if (typeof target !== 'string' || target.length === 0) {
    throw new Error('DEPLOY_TARGETS_JSON entries must be non-empty strings.');
  }

  console.log(target);
}
EOF
)

if [[ "${#targets[@]}" == "0" ]]; then
  echo "No Rush release targets were selected." >&2
  exit 1
fi

cd "${REPO_ROOT}"

node common/scripts/install-run-rush.js lint "${targets[@]}"
node common/scripts/install-run-rush.js test "${targets[@]}"
node common/scripts/install-run-rush.js build "${targets[@]}"
