# Add OIDC Identity Provider

## Goal

Add an external OpenID Connect identity provider adapter that plugs into the
existing `identity` provider registry without changing business GraphQL
resolvers.

## Checklist

- [ ] Add OIDC provider configuration for issuer, client id, client secret,
      scopes, redirect/callback behavior, and role/group claim mapping.
- [ ] Add an OIDC provider adapter that normalizes verified external identities
      into the internal `Principal` and provider account model.
- [ ] Decide whether the first OIDC flow is browser redirect, token exchange, or
      both.
- [ ] Add GraphQL or HTTP transport adapter endpoints/mutations for the selected
      OIDC flow.
- [ ] Map external claims/groups into internal roles without leaking raw
      provider claims into business resolvers.
- [ ] Add tests for provider selection, external principal normalization, and
      invalid provider/token handling.
- [ ] Update server architecture documentation if the OIDC runtime shape changes
      the identity boundary.

## Notes

- OIDC should be one provider among many enabled by `AUTH_PROVIDERS`; local auth
  remains available when configured.
- Prefer standards-based OIDC behavior over provider-specific branches for
  Keycloak, Google, and similar providers.
