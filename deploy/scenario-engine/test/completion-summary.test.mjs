import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCompletionSections } from "../src/completion-summary.mjs";

describe("completion summary", () => {
  it("renders variables and interpolates value references in guide text", () => {
    assert.equal(
      formatCompletionSections(
        {
          completionSections: [
            {
              guide: "Run gh workflow for ${GITHUB_REPOSITORY}.",
              lines: ["URL is ${WEBAPP_URL}.", "Missing stays ${MISSING}."],
              title: "Next",
              variables: ["WEBAPP_URL"],
            },
          ],
        },
        {
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          WEBAPP_URL: "https://demo-webapp.pages.dev",
        },
      ),
      [
        "Next:",
        "Run gh workflow for BeltOrg/beltapp.",
        "  WEBAPP_URL=https://demo-webapp.pages.dev",
        "  URL is https://demo-webapp.pages.dev.",
        "  Missing stays ${MISSING}.",
      ].join("\n"),
    );
  });
});
