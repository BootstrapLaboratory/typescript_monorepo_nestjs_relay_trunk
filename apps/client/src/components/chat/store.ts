import type { RecordSourceSelectorProxy } from "relay-runtime";

export function appendRootFieldRecordIfMissing(
  store: RecordSourceSelectorProxy,
  rootFieldName: string,
  listFieldName: string,
): void {
  const root = store.getRoot();
  const incoming = store.getRootField(rootFieldName);

  if (!incoming) {
    return;
  }

  const existing = root.getLinkedRecords(listFieldName) ?? [];
  const incomingDataId = incoming.getDataID();
  const alreadyPresent = existing.some(
    (record) => record?.getDataID() === incomingDataId,
  );

  if (alreadyPresent) {
    return;
  }

  root.setLinkedRecords([...existing, incoming], listFieldName);
}
