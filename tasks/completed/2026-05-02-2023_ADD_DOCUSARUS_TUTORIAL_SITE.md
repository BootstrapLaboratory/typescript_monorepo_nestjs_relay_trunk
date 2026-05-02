# Add Docusaurus Tutorial Site

## Goal

Add a Docusaurus documentation site as its own Rush project and publish it
through the existing Cloudflare Pages webapp deployment.

The public route shape should be:

```text
https://<webapp-host>/          -> current Vite/TanStack webapp
https://<webapp-host>/docs/     -> Docusaurus documentation site
https://<webapp-host>/docs/tutorial/ -> project design tutorial
```

## Design Decision

- Docusaurus is a separate Rush project, not a TanStack Router page.
- The webapp remains the only production frontend deploy target.
- The Docusaurus build output is copied into `apps/webapp/dist/docs/` before
  Cloudflare Pages deploys the webapp artifact.
- Docusaurus uses `baseUrl: "/docs/"` so internal links and assets resolve
  under the shared webapp origin.

## Consequences

- Docs keep their own build, config, sidebar, MDX/Markdown pipeline, and future
  extensibility.
- Production still has one Cloudflare Pages project and one public frontend
  origin.
- The webapp can link to `/docs/tutorial/`, but should not own `/docs/*`
  routes.
- Rush/Rush Delivery must make the docs build an explicit dependency of the
  deployable webapp artifact.

## Phase 1: Inspect Current Boundaries

- [x] Confirm Rush project conventions and command behavior.
- [x] Confirm webapp build and package artifact behavior.
- [x] Confirm Cloudflare Pages deploy script uploads the merged static output.
- [x] Check whether any existing docs/Docusaurus config can be reused.

## Phase 2: Add Docs Rush Project

- [x] Create a Docusaurus project folder for the docs site.
- [x] Add `package.json`, Docusaurus config, sidebar config, TypeScript config,
      and content entrypoint.
- [x] Configure the docs site with `baseUrl: "/docs/"`.
- [x] Add the project to `rush.json`.
- [x] Install/update Rush dependencies and lockfile.

## Phase 3: Move Tutorial Into Published Docs

- [x] Make the current tutorial available at `/docs/tutorial/`.
- [x] Preserve the source Markdown structure without duplicating large content
      unnecessarily.
- [x] Ensure Docusaurus sidebar/navigation exposes the tutorial as the first
      docs section.

## Phase 4: Compose Docs Into Webapp Artifact

- [x] Add a repeatable build/composition step that copies the docs build into
      `apps/webapp/dist/docs/`.
- [x] Wire webapp build/package behavior so Cloudflare Pages receives both the
      webapp and docs static files.
- [x] Ensure local and CI builds use the same path.

## Phase 5: Documentation And AI Guidance

- [x] Update repository/webapp/deployment architecture docs for the docs site
      boundary.
- [x] Document the local build/deploy workflow impact.
- [x] Keep guidance clear that `/docs/*` is Docusaurus-owned, not TanStack
      Router-owned.

## Phase 6: Validation

- [x] Verify Docusaurus builds.
- [x] Verify the webapp artifact includes `dist/docs/`.
- [x] Run full local QA with Trunk.
- [x] Provide semantic commit messages.
