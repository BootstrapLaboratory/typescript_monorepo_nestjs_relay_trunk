# AI Conventions

Use this file when modifying the Dagger framework or helping future agents
understand where a change belongs.

## Public Contract First

Start from the public contract:

- Dagger entrypoint parameters.
- `.dagger/` metadata schemas.
- Workflow stage inputs and outputs.
- Provider adapter boundaries.

Avoid changing source internals before checking whether the same outcome belongs
in metadata.

## Prefer Metadata Over Switches

Do not add target-specific `switch` or `if target === ...` logic when metadata
can describe the behavior. Target names should come from metadata and Rush, not
from hardcoded source lists.

## Keep Providers Optional

Provider `off` should keep working for local development. Provider-specific
credentials must be explicit and must not be required for dry-run paths unless a
selected target truly needs them.

## Preserve Stage Boundaries

Detect decides what should run. Build creates compiled outputs. Package
materializes deploy artifacts. Deploy performs live release actions.

If a change mixes these responsibilities, pause and create a task/design note
before implementing it.

## Documentation Style

Keep Dagger documentation high-level and API-oriented. Link schemas for exact
field rules rather than duplicating every validation detail.

Use relative links. Remove obsolete descriptions instead of adding historical
warnings about old behavior.

## Task Files

Read [`../../../docs/ai/rules/TasksFiles.md`](../../../docs/ai/rules/TasksFiles.md)
before creating or modifying task files.

When a task checklist is complete, move the file into the matching `completed`
directory. Do not modify completed task files.
