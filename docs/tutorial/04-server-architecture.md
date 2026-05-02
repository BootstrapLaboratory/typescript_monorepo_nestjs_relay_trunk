# Server Architecture

This chapter will explain the backend design: NestJS, Fastify, Apollo GraphQL,
TypeORM, PostgreSQL, migrations, identity, access control, Redis pub/sub, and
feature module boundaries.

## Chapter Intent

Cover why runtime API behavior belongs in `apps/server`, why deployment
behavior stays under `deploy`, and how generated schema output connects the
server to the rest of the monorepo.

## Navigation

Previous: [GraphQL Contract Boundary](03-graphql-contract-boundary.md)

Next: [Webapp Architecture](05-webapp-architecture.md)
