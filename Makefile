SHELL := bash

RUSH := node common/scripts/install-run-rush.js
SERVER_SMOKE_LOG ?= /tmp/server-smoke.log
SERVER_PID_FILE ?= /tmp/server-smoke.pid
SERVER_DEPLOY_ARCHIVE ?= server-deploy.tgz
GRAPHQL_SCHEMA ?= libs/api/schema.gql

.PHONY: \
	ci-check-graphql-drift \
	ci-validate-lint-affected \
	ci-validate-test-affected \
	ci-validate-build-affected \
	ci-validate-server-migrations \
	ci-validate-start-server \
	ci-validate-server-smoke \
	ci-validate-show-server-logs \
	ci-validate-stop-server \
	ci-package-server-bundle \
	ci-validate-build-server-container \
	ci-package-release-targets \
	ci-package-archive-server-bundle \
	ci-deploy-server-extract-artifact \
	ci-deploy-server-check-gcp-config \
	ci-deploy-server-check-secrets \
	ci-deploy-server-load-direct-db-url \
	ci-deploy-server-migrations \
	ci-deploy-server-configure-docker \
	ci-deploy-server-build-push-image \
	ci-deploy-server-smoke \
	ci-deploy-server-update-tag \
	ci-deploy-webapp-check-config \
	ci-deploy-webapp-validate-routes \
	ci-deploy-webapp-update-tag

ci-check-graphql-drift:
	@FAILURE_MODE="$(FAILURE_MODE)" bash scripts/ci/check-graphql-drift.sh

ci-validate-lint-affected:
	@test -n "$(FROM_SHA)" || (echo "FROM_SHA is required" >&2; exit 1)
	@$(RUSH) lint --from "git:$(FROM_SHA)"

ci-validate-test-affected:
	@test -n "$(FROM_SHA)" || (echo "FROM_SHA is required" >&2; exit 1)
	@$(RUSH) test --from "git:$(FROM_SHA)"

ci-validate-build-affected:
	@test -n "$(FROM_SHA)" || (echo "FROM_SHA is required" >&2; exit 1)
	@$(RUSH) build --from "git:$(FROM_SHA)"

ci-validate-server-migrations:
	@bash scripts/ci/run-server-migrations.sh

ci-validate-start-server:
	@SERVER_SMOKE_LOG="$(SERVER_SMOKE_LOG)" SERVER_PID_FILE="$(SERVER_PID_FILE)" bash scripts/ci/start-local-server.sh

ci-validate-server-smoke:
	@test -n "$(SERVICE_URL)" || (echo "SERVICE_URL is required" >&2; exit 1)
	@SERVICE_URL="$(SERVICE_URL)" bash deploy/cloudrun/tests/validate-post-deploy-smoke.sh

ci-validate-show-server-logs:
	@cat "$(SERVER_SMOKE_LOG)"

ci-validate-stop-server:
	@SERVER_PID="$${SERVER_PID:-}"; \
	if [[ -z "$$SERVER_PID" && -f "$(SERVER_PID_FILE)" ]]; then \
		SERVER_PID="$$(cat "$(SERVER_PID_FILE)")"; \
	fi; \
	if [[ -n "$$SERVER_PID" ]]; then \
		kill "$$SERVER_PID" || true; \
		wait "$$SERVER_PID" || true; \
	fi; \
	rm -f "$(SERVER_PID_FILE)"

ci-package-server-bundle:
	@$(RUSH) deploy -p server -s server -t common/deploy/server --overwrite

ci-validate-build-server-container:
	@test -n "$(IMAGE_TAG)" || (echo "IMAGE_TAG is required" >&2; exit 1)
	@docker build --pull -f apps/server/Dockerfile -t "$(IMAGE_TAG)" .

ci-package-release-targets:
	@DEPLOY_SERVER="$(DEPLOY_SERVER)" DEPLOY_WEBAPP="$(DEPLOY_WEBAPP)" bash scripts/ci/run-release-targets.sh

ci-package-archive-server-bundle:
	@tar -czf "$(SERVER_DEPLOY_ARCHIVE)" -C common/deploy server

ci-deploy-server-extract-artifact:
	@mkdir -p common/deploy
	@tar -xzf "$(SERVER_DEPLOY_ARCHIVE)" -C common/deploy

ci-deploy-server-check-gcp-config:
	@MISSING_PREFIX="Missing required GitHub Actions variable:" bash scripts/ci/require-envs.sh \
		GCP_PROJECT_ID \
		GCP_WORKLOAD_IDENTITY_PROVIDER \
		GCP_SERVICE_ACCOUNT \
		GCP_ARTIFACT_REGISTRY_REPOSITORY \
		CLOUD_RUN_SERVICE \
		CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT \
		CLOUD_RUN_CORS_ORIGIN

ci-deploy-server-check-secrets:
	@test -n "$${GCP_PROJECT_ID:-}" || (echo "GCP_PROJECT_ID is required" >&2; exit 1)
	@for secret_name in DATABASE_URL DATABASE_URL_DIRECT REDIS_URL; do \
		gcloud secrets versions access latest \
			--secret "$$secret_name" \
			--project "$$GCP_PROJECT_ID" \
			> /dev/null; \
	done

ci-deploy-server-load-direct-db-url:
	@bash scripts/ci/load-direct-db-url.sh

ci-deploy-server-migrations:
	@bash scripts/ci/run-dist-server-migrations.sh

ci-deploy-server-configure-docker:
	@test -n "$${CLOUD_RUN_REGION:-}" || (echo "CLOUD_RUN_REGION is required" >&2; exit 1)
	@gcloud auth configure-docker "$${CLOUD_RUN_REGION}-docker.pkg.dev" --quiet

ci-deploy-server-build-push-image:
	@bash scripts/ci/build-push-server-image.sh

ci-deploy-server-smoke:
	@test -n "$(SERVICE_URL)" || (echo "SERVICE_URL is required" >&2; exit 1)
	@SERVICE_URL="$(SERVICE_URL)" bash deploy/cloudrun/tests/validate-post-deploy-smoke.sh

ci-deploy-server-update-tag:
	@test -n "$(TAG_NAME)" || (echo "TAG_NAME is required" >&2; exit 1)
	@test -n "$(GIT_SHA)" || (echo "GIT_SHA is required" >&2; exit 1)
	@TAG_NAME="$(TAG_NAME)" GIT_SHA="$(GIT_SHA)" bash scripts/ci/update-deploy-tag.sh

ci-deploy-webapp-check-config:
	@MISSING_PREFIX="Missing required Cloudflare GitHub configuration:" bash scripts/ci/require-envs.sh \
		CLOUDFLARE_API_TOKEN \
		CLOUDFLARE_ACCOUNT_ID \
		CLOUDFLARE_PAGES_PROJECT_NAME \
		WEBAPP_VITE_GRAPHQL_HTTP \
		WEBAPP_VITE_GRAPHQL_WS

ci-deploy-webapp-validate-routes:
	@bash scripts/ci/validate-webapp-routes.sh

ci-deploy-webapp-update-tag:
	@test -n "$(TAG_NAME)" || (echo "TAG_NAME is required" >&2; exit 1)
	@test -n "$(GIT_SHA)" || (echo "GIT_SHA is required" >&2; exit 1)
	@TAG_NAME="$(TAG_NAME)" GIT_SHA="$(GIT_SHA)" bash scripts/ci/update-deploy-tag.sh
