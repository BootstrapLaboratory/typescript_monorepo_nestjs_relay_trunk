# Scenario Store Contract

The XState-backed runner uses a small store boundary so the same scenario can
resume in CLI or web environments.

## Methods

```ts
type ScenarioStore = {
  loadValues(): Promise<Record<string, string>>;
  saveOutputs(output: Record<string, unknown>, metadata: { step: ScenarioStep }): Promise<void>;

  loadSnapshot(): Promise<unknown | undefined>;
  saveSnapshot(snapshot: unknown, metadata: { scenario: Scenario }): Promise<void>;
  clearSnapshot(metadata: { scenario: Scenario }): Promise<void>;
};
```

## Semantics

- `loadValues` returns previously known non-secret values and generated
  outputs.
- `saveOutputs` persists non-secret provider outputs after a step succeeds.
- `loadSnapshot` returns the previous XState actor snapshot when resuming.
- `saveSnapshot` persists a sanitized actor snapshot after active state
  changes.
- `clearSnapshot` removes saved progress after the scenario completes or when
  the caller requests a fresh run.
- `fresh: true` makes the runner ignore both stored snapshots and stored values
  for the current run. The store may still keep the old file on disk; the run
  starts from an empty in-memory value set plus explicit caller-provided values.

## JSON File Store

`src/stores/json-file-store.mjs` provides the first local CLI store. It writes a
single JSON document:

```json
{
  "values": {
    "PROJECT_NUMBER": "demo-123"
  },
  "snapshot": {
    "status": "active"
  }
}
```

Writes are serialized inside the store because active snapshot saves and
provider output saves can happen close together.

## Secret Handling

Persisted snapshots are sanitized by the runner before they reach the store.
Any input whose definition uses `secret()` is removed from every `values`
object found inside the persisted snapshot.

If a future scenario needs to resume before a secret-consuming step has
completed, the UI should prompt for the secret again. Secrets must not be
stored as generated scenario state.
