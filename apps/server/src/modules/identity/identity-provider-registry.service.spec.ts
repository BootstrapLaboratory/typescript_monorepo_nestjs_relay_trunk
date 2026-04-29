import { BadRequestException } from '@nestjs/common';
import { IdentityConfigService } from './identity-config.service';
import { IdentityProviderRegistry } from './identity-provider-registry.service';
import { IdentityProvider, IdentityProviderCapability } from './identity.types';

function createConfig(overrides: {
  defaultLoginProvider?: string;
  enabledProviders?: string[];
  registrationProvider?: string;
}): IdentityConfigService {
  return {
    getDefaultLoginProvider: () => overrides.defaultLoginProvider ?? 'local',
    getEnabledProviders: () => overrides.enabledProviders ?? ['local'],
    getRegistrationProvider: () => overrides.registrationProvider ?? 'local',
  } as unknown as IdentityConfigService;
}

describe('IdentityProviderRegistry', () => {
  const localProvider: IdentityProvider = {
    capabilities: [
      IdentityProviderCapability.Login,
      IdentityProviderCapability.Registration,
    ],
    id: 'local',
  };
  const oidcProvider: IdentityProvider = {
    capabilities: [IdentityProviderCapability.Login],
    id: 'oidc',
  };

  it('returns the configured default login provider', () => {
    const registry = new IdentityProviderRegistry(
      createConfig({
        defaultLoginProvider: 'oidc',
        enabledProviders: ['local', 'oidc'],
      }),
      [localProvider, oidcProvider],
    );

    expect(registry.getLoginProvider()).toBe(oidcProvider);
  });

  it('allows selecting any enabled provider with the requested capability', () => {
    const registry = new IdentityProviderRegistry(
      createConfig({
        enabledProviders: ['local', 'oidc'],
      }),
      [localProvider, oidcProvider],
    );

    expect(registry.getLoginProvider('local')).toBe(localProvider);
    expect(registry.getLoginProvider('oidc')).toBe(oidcProvider);
  });

  it('rejects disabled providers', () => {
    const registry = new IdentityProviderRegistry(
      createConfig({
        enabledProviders: ['local'],
      }),
      [localProvider, oidcProvider],
    );

    expect(() => registry.getLoginProvider('oidc')).toThrow(
      BadRequestException,
    );
  });

  it('rejects providers that do not support registration', () => {
    const registry = new IdentityProviderRegistry(
      createConfig({
        enabledProviders: ['oidc'],
        registrationProvider: 'oidc',
      }),
      [oidcProvider],
    );

    expect(() => registry.getRegistrationProvider()).toThrow(
      BadRequestException,
    );
  });
});
