# Docs Site

This Rush project owns the Docusaurus documentation site that is hosted under
the webapp origin at `/docs/`.

The project design tutorial source stays in `../../docs/tutorial`. Docusaurus
reads that Markdown directly and publishes it under `/docs/tutorial/`.

The root `docs` directory is also a private Rush project. This project depends
on it so documentation content changes flow through the Rush graph before the
webapp artifact is built.

## Commands

```bash
npm --prefix apps/docsite run start:dev
npm --prefix apps/docsite run build
```

The local dev command sets `DOCS_SITE_URL=http://localhost:3001` and
`DOCS_APP_URL=http://localhost:5173`, so the Docusaurus navigation can link
back to the local Vite webapp.

The production webapp artifact copies this project's `build` output into
`apps/webapp/dist/docs/` before Cloudflare Pages deploys `apps/webapp/dist`.
