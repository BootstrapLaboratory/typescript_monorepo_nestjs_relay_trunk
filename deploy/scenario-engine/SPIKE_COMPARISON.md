# Scenario Engine Spike Comparison

This spike uses the same project-owned scenario DSL for both implementations.
Scenario authors do not write XState machine config directly.

## Shared Scenario Shape

The test fixture in `test/fixtures.mjs` defines one tiny two-step scenario:

1. collect `PROJECT_ID` and secret `ADMIN_TOKEN`
2. return `PROJECT_NUMBER`
3. collect missing `REGION`
4. return `SERVICE_URL`

Both runners consume that same scenario definition.

## Plain ESM Runner

- File: `src/plain-runner.mjs`
- Shape: simple `for ... of scenario.steps`
- Best property: easiest to read and debug
- Weak spot: lifecycle features such as pause/resume, branching, retries, and
  cancellation would need to be designed by this repository
- Current code size: intentionally tiny

## XState-Backed Runner

- File: `src/xstate-runner.mjs`
- Shape: compile scenario steps into an XState machine with one state per step
- Best property: lifecycle and persistence can build on a mature actor runtime
- Weak spot: more vocabulary and more moving pieces inside the compiler
- Boundary rule: XState stays hidden behind `compileScenarioToXState`; scenario
  and provider files should keep using the project-owned DSL

## Decision Notes

Use the plain runner if the production flow stays mostly linear and CLI-first.

Use the XState-backed runner if pause/resume, branching, retries, cancellation,
or a browser wizard become first-class requirements soon enough to justify the
extra machinery.
