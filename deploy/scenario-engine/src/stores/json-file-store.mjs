import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function createJsonFileStore(filePath) {
  let pendingWrite = Promise.resolve();

  const updateState = (updater) => {
    pendingWrite = pendingWrite.then(async () => {
      const state = await readState(filePath);
      await writeState(filePath, updater(state));
    });

    return pendingWrite;
  };

  return {
    async clearSnapshot() {
      await updateState((state) => {
        delete state.snapshot;
        return state;
      });
    },
    async loadSnapshot() {
      await pendingWrite;
      const state = await readState(filePath);
      return state.snapshot;
    },
    async loadValues() {
      await pendingWrite;
      const state = await readState(filePath);
      return { ...state.values };
    },
    async saveOutputs(output) {
      await updateState((state) => ({
        ...state,
        values: {
          ...state.values,
          ...output,
        },
      }));
    },
    async saveSnapshot(snapshot) {
      await updateState((state) => ({
        ...state,
        snapshot,
      }));
    },
  };
}

async function readState(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      values: parsed.values ?? {},
      ...(parsed.snapshot === undefined ? {} : { snapshot: parsed.snapshot }),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { values: {} };
    }

    throw error;
  }
}

async function writeState(filePath, state) {
  await mkdir(dirname(filePath), { recursive: true });

  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporaryPath, filePath);
}
