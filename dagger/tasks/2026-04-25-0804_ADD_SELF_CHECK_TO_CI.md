# Add Self-Check To CI

## Context

The Dagger module now exposes `dagger call self-check --repo=..`, which runs
the framework typecheck, test suite, and metadata contract validation from one
entrypoint.

This should eventually become the standard automated health gate for the Dagger
framework itself. We are intentionally deferring the CI wiring because the
Dagger project may move to a dedicated repository, and the final workflow shape
should be decided there.

## Goal

Make `self-check` the canonical CI guard for the Dagger framework after the
module repository boundary is settled.

## Checklist

- [ ] Decide whether `self-check` runs in the current repository before the
      split, only in the future Dagger repository, or in both during transition.
- [ ] Add a CI job that runs `dagger call self-check --repo=..`.
- [ ] Ensure the job runs on Dagger source, schema, metadata, and task-file
      changes.
- [ ] Document `self-check` as the local and CI framework health command.
- [ ] Decide whether any older separate Dagger typecheck/test/metadata CI steps
      can be removed after `self-check` is wired.

## Validation

- [ ] Run the new CI path once and confirm `self-check` passes.
- [ ] Confirm the command still works locally with `dagger call self-check
      --repo=..`.
