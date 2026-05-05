#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/paths.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/load-env.sh"

require_env() {
	local name="$1"
	if [[ -z ${!name-} ]]; then
		echo "Missing required environment variable: ${name}" >&2
		exit 1
	fi
}

upsert_secret() {
	local name="$1"
	local value="$2"

	if gcloud secrets describe "${name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
		printf '%s' "${value}" | gcloud secrets versions add "${name}" \
			--project="${PROJECT_ID}" \
			--data-file=-
	else
		printf '%s' "${value}" | gcloud secrets create "${name}" \
			--project="${PROJECT_ID}" \
			--replication-policy="automatic" \
			--data-file=-
	fi
}

secret_exists() {
	local name="$1"

	gcloud secrets describe "${name}" --project="${PROJECT_ID}" >/dev/null 2>&1
}

generate_auth_access_token_secret() {
	openssl rand -hex 48
}

validate_auth_access_token_secret() {
	local value="$1"

	if ((${#value} < 32)); then
		echo "AUTH_ACCESS_TOKEN_SECRET must be configured with at least 32 characters" >&2
		exit 1
	fi
}

should_rotate_auth_access_token_secret() {
	local answer

	case "${AUTH_ACCESS_TOKEN_SECRET_ROTATE-}" in
	1 | true | TRUE | yes | YES | y | Y | rotate | ROTATE)
		return 0
		;;
	0 | false | FALSE | no | NO | n | N | preserve | PRESERVE)
		return 1
		;;
	"") ;;
	*)
		echo "AUTH_ACCESS_TOKEN_SECRET_ROTATE must be yes/no, true/false, 1/0, rotate, or preserve." >&2
		exit 1
		;;
	esac

	if [[ -t 0 ]]; then
		read -r -p "AUTH_ACCESS_TOKEN_SECRET already exists. Regenerate it? This invalidates active access tokens. [y/N] " answer
		case "${answer}" in
		y | Y | yes | YES)
			return 0
			;;
		*) ;;
		esac
	fi

	return 1
}

sync_auth_access_token_secret() {
	local auth_secret_exists_status
	local rotate_status
	local value="${AUTH_ACCESS_TOKEN_SECRET-}"

	set +e
	secret_exists "AUTH_ACCESS_TOKEN_SECRET"
	auth_secret_exists_status=$?
	set -e

	if ((auth_secret_exists_status == 0)); then
		set +e
		should_rotate_auth_access_token_secret
		rotate_status=$?
		set -e

		if ((rotate_status != 0)); then
			echo "Preserved existing AUTH_ACCESS_TOKEN_SECRET."
			return
		fi

		if [[ -z ${value} ]]; then
			value="$(generate_auth_access_token_secret)"
		fi

		validate_auth_access_token_secret "${value}"
		upsert_secret "AUTH_ACCESS_TOKEN_SECRET" "${value}"
		echo "Rotated AUTH_ACCESS_TOKEN_SECRET."
		return
	fi

	if [[ -z ${value} ]]; then
		value="$(generate_auth_access_token_secret)"
	fi

	validate_auth_access_token_secret "${value}"
	upsert_secret "AUTH_ACCESS_TOKEN_SECRET" "${value}"
	echo "Created AUTH_ACCESS_TOKEN_SECRET."
}

grant_secret_accessor() {
	local secret_name="$1"
	local member="$2"

	gcloud secrets add-iam-policy-binding "${secret_name}" \
		--project="${PROJECT_ID}" \
		--member="${member}" \
		--role="roles/secretmanager.secretAccessor" >/dev/null
}

require_env PROJECT_ID
require_env DATABASE_URL
require_env DATABASE_URL_DIRECT
require_env REDIS_URL

DEPLOYER_SERVICE_ACCOUNT_EMAIL="${DEPLOYER_SERVICE_ACCOUNT_EMAIL:-${DEPLOYER_SERVICE_ACCOUNT_ID:-github-actions-deployer}@${PROJECT_ID}.iam.gserviceaccount.com}"
RUNTIME_SERVICE_ACCOUNT_EMAIL="${RUNTIME_SERVICE_ACCOUNT_EMAIL:-${RUNTIME_SERVICE_ACCOUNT_ID:-cloud-run-runtime}@${PROJECT_ID}.iam.gserviceaccount.com}"

upsert_secret "DATABASE_URL" "${DATABASE_URL}"
upsert_secret "DATABASE_URL_DIRECT" "${DATABASE_URL_DIRECT}"
upsert_secret "REDIS_URL" "${REDIS_URL}"
sync_auth_access_token_secret

for secret_name in DATABASE_URL DATABASE_URL_DIRECT REDIS_URL AUTH_ACCESS_TOKEN_SECRET; do
	grant_secret_accessor "${secret_name}" "serviceAccount:${DEPLOYER_SERVICE_ACCOUNT_EMAIL}"
done

for secret_name in DATABASE_URL REDIS_URL AUTH_ACCESS_TOKEN_SECRET; do
	grant_secret_accessor "${secret_name}" "serviceAccount:${RUNTIME_SERVICE_ACCOUNT_EMAIL}"
done

cat <<EOF
Secret Manager sync complete.

Created or updated:
  DATABASE_URL
  DATABASE_URL_DIRECT
  REDIS_URL
  AUTH_ACCESS_TOKEN_SECRET

Access granted to:
  deployer: ${DEPLOYER_SERVICE_ACCOUNT_EMAIL}
  runtime:  ${RUNTIME_SERVICE_ACCOUNT_EMAIL}

Next:
  1. Set GitHub repository variables.
  2. Trigger deploy-server.
EOF
