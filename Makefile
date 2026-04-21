SHELL := bash

RUSH := node common/scripts/install-run-rush.js
SERVER_SMOKE_LOG ?= /tmp/server-smoke.log
SERVER_PID_FILE ?= /tmp/server-smoke.pid
GRAPHQL_SCHEMA ?= libs/api/schema.gql
DEPLOY_ARTIFACT_PREFIX ?= deploy-target
DEPLOY_TAG_PREFIX ?= deploy/prod
TARGET ?=
DEPLOY_ARTIFACT_NAME ?= $(DEPLOY_ARTIFACT_PREFIX)-$(TARGET)
DEPLOY_ARTIFACT_ARCHIVE ?= $(DEPLOY_ARTIFACT_NAME).tgz

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
	ci-package-archive-target \
	ci-deploy-extract-target-artifact \
	ci-deploy-server-check-gcp-config \
	ci-deploy-webapp-check-config

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
	@RELEASE_TARGETS_JSON='$(RELEASE_TARGETS_JSON)' bash scripts/ci/run-release-targets.sh

ci-package-archive-target:
	@test -n "$(TARGET)" || (echo "TARGET is required" >&2; exit 1)
	@tar -czf "$(DEPLOY_ARTIFACT_ARCHIVE)" -C common/deploy "$(TARGET)"

ci-deploy-extract-target-artifact:
	@test -n "$(TARGET)" || (echo "TARGET is required" >&2; exit 1)
	@mkdir -p common/deploy
	@tar -xzf "$(DEPLOY_ARTIFACT_ARCHIVE)" -C common/deploy

ci-deploy-server-check-gcp-config:
	@MISSING_PREFIX="Missing required GitHub Actions variable:" bash scripts/ci/require-envs.sh \
		GCP_PROJECT_ID \
		GCP_WORKLOAD_IDENTITY_PROVIDER \
		GCP_SERVICE_ACCOUNT \
		GCP_ARTIFACT_REGISTRY_REPOSITORY \
		CLOUD_RUN_SERVICE \
		CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT \
		CLOUD_RUN_CORS_ORIGIN

ci-deploy-webapp-check-config:
	@MISSING_PREFIX="Missing required Cloudflare GitHub configuration:" bash scripts/ci/require-envs.sh \
		CLOUDFLARE_API_TOKEN \
		CLOUDFLARE_ACCOUNT_ID \
		CLOUDFLARE_PAGES_PROJECT_NAME \
		WEBAPP_VITE_GRAPHQL_HTTP \
		WEBAPP_VITE_GRAPHQL_WS
