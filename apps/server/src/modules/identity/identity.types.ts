export type Principal = {
  userId: string;
  subject: string;
  provider: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
};

export enum IdentityProviderCapability {
  Login = 'login',
  Registration = 'registration',
  ExternalPrincipal = 'external-principal',
}

export type ProviderLoginRequest = {
  email: string;
  password: string;
};

export type ProviderRegistrationRequest = {
  email: string;
  password: string;
  displayName?: string;
};

export type ProviderIdentity = {
  userId: string;
  subject: string;
  provider: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
};

export type AuthSessionResult = {
  principal: Principal;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export interface IdentityProvider {
  readonly id: string;
  readonly capabilities: readonly IdentityProviderCapability[];
  login?(request: ProviderLoginRequest): Promise<ProviderIdentity>;
  register?(request: ProviderRegistrationRequest): Promise<ProviderIdentity>;
}

export const IDENTITY_PROVIDERS = Symbol('IDENTITY_PROVIDERS');
