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

## Decision

Use the XState-backed runner as the default execution engine.

The extra engine code is acceptable because persistence/resume matters for CLI
interrupts and future web page reloads. The compiled machine also gives a
natural place for flow preview, retries, branching, cancellation, and more
complex provider setup paths.

Keep the plain runner as a fallback/reference implementation. It is useful as a
small executable definition of the scenario semantics, and it gives the project
a simple escape hatch if the XState compiler boundary starts to obscure the
scenario model.

## Persistence Contract

The XState-backed runner now supports `loadSnapshot`, `saveSnapshot`, and
`clearSnapshot` on the scenario store. It saves sanitized actor snapshots while
the scenario is active, clears the snapshot after successful completion, and
supports `fresh: true` to ignore saved progress and start from the beginning.

Secret inputs are removed from persisted snapshots before the store sees them.
If a run resumes before a secret-consuming step has completed, the UI must ask
for that secret again.
