# GitHub Provider

This package is the TypeScript provider for GitHub repository configuration
used by production deployment scenarios.

Current scope:

- set GitHub Actions repository variables required by Cloud Run deploys
- set GitHub Actions repository variables required by Cloudflare Pages deploys
- set Cloudflare repository secrets used by the deploy workflow

The real dependency uses the official GitHub CLI (`gh`). Secrets are sent to
`gh secret set` through stdin so secret values are not placed in process
arguments.

Out of scope:

- running GitHub Actions workflows
- managing repository permissions
- configuring provider infrastructure directly

Build and test:

```sh
npm --prefix deploy/providers/github run test
```
