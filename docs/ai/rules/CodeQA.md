# Local Code QA Convention

- Local code QA in this repository is run with Trunk.
- Use the absolute Trunk launcher path
  `/root/.cache/trunk/launcher/trunk`; do not assume `trunk` is available on
  `PATH`.
- Before running local code QA, verify that
  `/root/.cache/trunk/launcher/trunk` exists and is executable.
- If `/root/.cache/trunk/launcher/trunk` is missing or is not executable, stop
  the task and report an error instead of using another lint, format, security,
  or QA command as a substitute.
- When running full local QA, use
  `/root/.cache/trunk/launcher/trunk check -a -y`.
