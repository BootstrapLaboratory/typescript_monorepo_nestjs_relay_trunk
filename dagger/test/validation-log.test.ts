import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatValidationSection,
  formatValidationTargetHeader,
} from "../src/validate/validation-log.ts";

test("formats validation section headers", () => {
  assert.equal(
    formatValidationSection("Rush validation"),
    [
      "========================================================================",
      "= Rush validation",
      "========================================================================",
    ].join("\n"),
  );
});

test("formats validation target headers", () => {
  assert.equal(
    formatValidationTargetHeader("server"),
    [
      "------------------------------------------------------------------------",
      "- Validation target: server",
      "------------------------------------------------------------------------",
    ].join("\n"),
  );
});
