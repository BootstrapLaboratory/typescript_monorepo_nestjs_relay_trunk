import { Principal } from '../identity.types';

export type IdentityGraphqlRequest = {
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

export type IdentityGraphqlReply = {
  clearCookie?: (
    name: string,
    options?: Record<string, unknown>,
  ) => IdentityGraphqlReply;
  setCookie?: (
    name: string,
    value: string,
    options?: Record<string, unknown>,
  ) => IdentityGraphqlReply;
};

export type IdentityGraphqlContext = {
  principal?: Principal | null;
  req?: IdentityGraphqlRequest;
  reply?: IdentityGraphqlReply;
};
