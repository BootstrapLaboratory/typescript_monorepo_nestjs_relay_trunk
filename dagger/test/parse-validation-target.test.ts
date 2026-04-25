import * as assert from "node:assert/strict";
import { test } from "node:test";

import { parseValidationTarget } from "../src/validate/parse-validation-target.ts";

test("parses validation target metadata", () => {
  const definition = parseValidationTarget(`
name: server

services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: chatdb
    ports:
      - 5432
      - 5432

steps:
  - name: migrations
    command: npm
    args: ["--prefix", "apps/server", "run", "ci:migration:run"]
    env:
      DATABASE_HOST: postgres

  - name: server
    service:
      command: npm
      args: ["--prefix", "apps/server", "run", "start:prod"]
      ports:
        - 3100
      env:
        PORT: "3100"
`);

  assert.deepEqual(definition, {
    name: "server",
    services: {
      postgres: {
        env: {
          POSTGRES_DB: "chatdb",
        },
        image: "postgres:16-alpine",
        ports: [5432],
      },
    },
    steps: [
      {
        args: ["--prefix", "apps/server", "run", "ci:migration:run"],
        command: "npm",
        env: {
          DATABASE_HOST: "postgres",
        },
        kind: "command",
        name: "migrations",
      },
      {
        kind: "service",
        name: "server",
        service: {
          args: ["--prefix", "apps/server", "run", "start:prod"],
          command: "npm",
          env: {
            PORT: "3100",
          },
          ports: [3100],
        },
      },
    ],
  });
});

test("fails when validation target name is invalid", () => {
  assert.throws(
    () =>
      parseValidationTarget(`
name: Server
`),
    /Validation target name "Server" must match/,
  );
});

test("fails when service image is missing", () => {
  assert.throws(
    () =>
      parseValidationTarget(`
name: server
services:
  postgres: {}
`),
    /Validation target service "postgres" image must be a non-empty string\./,
  );
});

test("fails when service port is invalid", () => {
  assert.throws(
    () =>
      parseValidationTarget(`
name: server
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - 99999
`),
    /Validation target service "postgres" ports entries must be port numbers from 1 to 65535\./,
  );
});

test("fails when a step defines both command and service", () => {
  assert.throws(
    () =>
      parseValidationTarget(`
name: server
steps:
  - name: mixed
    command: npm
    service:
      command: npm
`),
    /Validation target step "mixed" must define either command or service, not both\./,
  );
});

test("fails when a step has no executable shape", () => {
  assert.throws(
    () =>
      parseValidationTarget(`
name: server
steps:
  - name: noop
`),
    /Validation target step "noop" must define command or service\./,
  );
});

test("fails when step names are duplicated", () => {
  assert.throws(
    () =>
      parseValidationTarget(`
name: server
steps:
  - name: smoke
    command: bash
  - name: smoke
    command: bash
`),
    /Duplicate validation target step "smoke"\./,
  );
});
