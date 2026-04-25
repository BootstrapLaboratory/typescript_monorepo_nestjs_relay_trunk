import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatLogSection,
  formatLogSubsection,
} from "../src/logging/sections.ts";

test("formats stage section headers", () => {
  assert.equal(
    formatLogSection("Rush validation"),
    [
      "========================================================================",
      "= Rush validation",
      "========================================================================",
    ].join("\n"),
  );
});

test("formats nested stage subsection headers", () => {
  assert.equal(
    formatLogSubsection("Validation target: server"),
    [
      "------------------------------------------------------------------------",
      "- Validation target: server",
      "------------------------------------------------------------------------",
    ].join("\n"),
  );
});
