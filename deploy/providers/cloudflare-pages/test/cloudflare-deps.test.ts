import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCloudflarePagesProviderDeps } from "../src/index.js";

describe("Cloudflare Pages provider deps", () => {
  it("composes the Pages dependency group", () => {
    const marker = {
      disableAutomaticDeployments: async () => ({ name: "demo-webapp" }),
      ensureProject: async () => ({ name: "demo-webapp" }),
    };

    assert.deepEqual(
      createCloudflarePagesProviderDeps({
        pages: () => marker,
      }),
      {
        pages: marker,
      },
    );
  });
});
