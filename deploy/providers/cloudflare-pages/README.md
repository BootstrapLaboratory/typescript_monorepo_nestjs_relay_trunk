# Cloudflare Pages Provider

This package is the TypeScript provider spike for Cloudflare Pages production
provisioning. It owns provider-side setup actions only.

Current scope:

- ensure a Cloudflare Pages project exists
- set the production branch
- disable Cloudflare Git automatic deployments for Git-integrated Pages
  projects

Out of scope:

- uploading built assets
- running Wrangler deployments
- configuring GitHub repository secrets or variables
- deriving backend GraphQL endpoint URLs

Build and test:

```sh
npm --prefix deploy/providers/cloudflare-pages run test
```
