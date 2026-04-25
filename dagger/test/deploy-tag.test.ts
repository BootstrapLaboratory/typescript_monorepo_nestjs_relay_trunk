import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDeployTargetCommand,
  buildUpdateDeployTagCommand,
  deployTagName,
  shellQuote,
} from "../src/deploy/deploy-tag.ts";

test("builds deploy tag names from environment and target", () => {
  assert.equal(deployTagName("prod", "server"), "deploy/prod/server");
  assert.equal(deployTagName("staging", "webapp"), "deploy/staging/webapp");
});

test("quotes shell values safely", () => {
  assert.equal(shellQuote("plain"), "'plain'");
  assert.equal(shellQuote("it's-live"), "'it'\"'\"'s-live'");
});

test("builds the generic deploy tag update command", () => {
  const command = buildUpdateDeployTagCommand(
    "prod",
    "server",
    "abc123",
  );

  assert.match(
    command,
    /printf '\[deploy-release\] update deploy tag %s -> %s\\n' 'deploy\/prod\/server' 'abc123'/,
  );
  assert.match(command, /git config user.name 'github-actions\[bot\]'/);
  assert.match(
    command,
    /git config user.email '41898282\+github-actions\[bot\]@users\.noreply\.github\.com'/,
  );
  assert.match(command, /git tag -f 'deploy\/prod\/server' 'abc123'/);
  assert.match(
    command,
    /git push origin 'refs\/tags\/deploy\/prod\/server' --force/,
  );
});

test("builds deploy target command with tag update after the target script", () => {
  const command = buildDeployTargetCommand(
    "deploy/cloudrun/scripts/deploy-server.sh",
    "prod",
    "server",
    "abc123",
  );

  assert.ok(
    command.startsWith("bash deploy/cloudrun/scripts/deploy-server.sh && "),
  );
  assert.match(command, /git tag -f 'deploy\/prod\/server' 'abc123'/);
});
