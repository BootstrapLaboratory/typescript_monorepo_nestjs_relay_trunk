# Local Code QA Convention

- Local code QA in this repository is run with Trunk.
- The devcontainer exposes Trunk on `PATH`; use the `trunk` command directly.
- Before running local code QA, verify that `command -v trunk` succeeds.
- If `trunk` is not available on `PATH`, stop the task and report an error
  instead of using another lint, format, security, or QA command as a
  substitute.
- When running full local QA, use `trunk check -a -y`.
