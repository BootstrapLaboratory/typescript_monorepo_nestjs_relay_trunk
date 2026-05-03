# AGENTS.md

- if you do not find files referenced in this document, then STOP processing and write error message about it
- Always read `.ai/conventions.md` before making code or
  architecture changes in this repository.
- Read `.ai/deployment.md` when working on production setup,
  pre-deployment tasks, deployment instructions, GitHub Actions deployment
  workflows, Rush Delivery package/deploy metadata, or files under `deploy`.
- Read `apps/server/docs/ai/conventions.md` when working under `apps/server`,
  `deploy/cloudrun`, server Rush Delivery metadata, backend GraphQL schema
  generation, database migrations, or Cloud Run deployment behavior.
- Read `apps/webapp/docs/ai/conventions.md` when working under `apps/webapp`,
  `deploy/cloudflare-pages`, webapp Rush Delivery metadata, Relay operations,
  or Cloudflare Pages deployment behavior.
- Read `libs/api/docs/ai/conventions.md` when working under `libs/api` or
  when changing the GraphQL schema contract between server and webapp.
- Read `.ai/rules/BashModules.md` only when working on bash modules, shell scripts, or shell-based project layout.
- Read `.ai/rules/CodeQA.md` before running local code QA, linting,
  formatting, security checks, or validation commands.
- Do not load specialized docs unless the task touches that area.
- After completing a task, if you modify any files, give two commit messages in semantic commits style: short and detailed
- After modifying any files in source tree give a commit message in semantic commits style: short and detailed
- Read `.ai/rules/DocEditing.md` only when editing documentation, markdown documents
- if the task user is asking for is big enough and cannot be complited in one run, then create a task file under `tasks` directory with checklist/phases/etc
- Read `.ai/rules/TasksFiles.md` when creating, managing, or modifying
  files under the `tasks` directory.
