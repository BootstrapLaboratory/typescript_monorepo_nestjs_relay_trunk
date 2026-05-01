import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createJsonFileStore } from "../src/stores/json-file-store.mjs";

describe("JSON file scenario store", () => {
  it("persists values and snapshots in one local state file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scenario-store-"));
    const statePath = join(directory, "state.json");

    try {
      const store = createJsonFileStore(statePath);

      assert.deepEqual(await store.loadValues(), {});
      assert.equal(await store.loadSnapshot(), undefined);

      await store.saveOutputs({ PROJECT_NUMBER: "demo-123" });
      await store.saveSnapshot({ value: "step_1" });

      const restoredStore = createJsonFileStore(statePath);
      assert.deepEqual(await restoredStore.loadValues(), {
        PROJECT_NUMBER: "demo-123",
      });
      assert.deepEqual(await restoredStore.loadSnapshot(), {
        value: "step_1",
      });

      await restoredStore.clearSnapshot();
      assert.equal(await restoredStore.loadSnapshot(), undefined);
      assert.deepEqual(await restoredStore.loadValues(), {
        PROJECT_NUMBER: "demo-123",
      });

      const raw = await readFile(statePath, "utf8");
      assert.doesNotMatch(raw, /snapshot/);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serializes concurrent writes to keep the state file valid", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scenario-store-"));
    const statePath = join(directory, "state.json");

    try {
      const store = createJsonFileStore(statePath);

      await Promise.all([
        store.saveOutputs({ PROJECT_NUMBER: "demo-123" }),
        store.saveSnapshot({ value: "step_1" }),
        store.saveOutputs({ SERVICE_URL: "https://example.test" }),
      ]);

      assert.deepEqual(await store.loadValues(), {
        PROJECT_NUMBER: "demo-123",
        SERVICE_URL: "https://example.test",
      });
      assert.deepEqual(await store.loadSnapshot(), {
        value: "step_1",
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
