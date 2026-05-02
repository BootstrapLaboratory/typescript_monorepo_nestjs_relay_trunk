# Docs Site

This Rush project owns the Docusaurus documentation site that is hosted under
the webapp origin at `/docs/`.

The project design tutorial source stays in `../../docs/tutorial`. Docusaurus
reads that Markdown directly and publishes it under `/docs/tutorial/`.

## Commands

```bash
npm --prefix apps/docs run start:dev
npm --prefix apps/docs run build
```

The production webapp artifact copies this project's `build` output into
`apps/webapp/dist/docs/` before Cloudflare Pages deploys `apps/webapp/dist`.
