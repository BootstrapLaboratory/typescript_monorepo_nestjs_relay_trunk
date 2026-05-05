import 'reflect-metadata';

jest.mock('../identity/identity.module', () => ({
  IdentityModule: class IdentityModule {},
}));

import { type FactoryProvider, type Provider } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import {
  GraphqlAuthenticationGuard,
  RolesGuard,
  SERVER_AUTH_ACCESS_TOKEN_VERIFIER,
  type ServerAuthAccessTokenVerifier,
} from '@omgjs/labkit-server-auth';
import { AccessControlModule } from './access-control.module';
import { IdentityModule } from '../identity/identity.module';
import { type Principal } from '../identity/identity.types';
import { AccessTokenService } from '../identity/token.service';

const getAccessControlModuleMetadata = <T>(key: string): T[] => {
  return (Reflect.getMetadata(key, AccessControlModule) ?? []) as T[];
};

type AccessTokenVerifierProvider = FactoryProvider<
  ServerAuthAccessTokenVerifier<Principal>
>;

const isAccessTokenVerifierProvider = (
  provider: Provider,
): provider is AccessTokenVerifierProvider => {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'provide' in provider &&
    provider.provide === SERVER_AUTH_ACCESS_TOKEN_VERIFIER &&
    'useFactory' in provider &&
    typeof provider.useFactory === 'function'
  );
};

const getAccessTokenVerifierProvider = (): AccessTokenVerifierProvider => {
  const provider = getAccessControlModuleMetadata<Provider>(
    MODULE_METADATA.PROVIDERS,
  ).find(isAccessTokenVerifierProvider);

  if (!provider) {
    throw new Error('Access token verifier provider must use a factory');
  }

  return provider;
};

describe('AccessControlModule', () => {
  it('wires Labkit guards at the app access-control boundary', () => {
    expect(
      getAccessControlModuleMetadata<unknown>(MODULE_METADATA.IMPORTS),
    ).toContain(IdentityModule);

    expect(
      getAccessControlModuleMetadata<Provider>(MODULE_METADATA.PROVIDERS),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: SERVER_AUTH_ACCESS_TOKEN_VERIFIER,
        }),
        GraphqlAuthenticationGuard,
        RolesGuard,
      ]),
    );

    expect(
      getAccessControlModuleMetadata<unknown>(MODULE_METADATA.EXPORTS),
    ).toEqual(expect.arrayContaining([GraphqlAuthenticationGuard, RolesGuard]));
  });

  it('adapts AccessTokenService to the Labkit access-token verifier contract', async () => {
    const accessTokenVerifierProvider = getAccessTokenVerifierProvider();
    expect(accessTokenVerifierProvider.inject).toEqual([AccessTokenService]);

    const principal: Principal = {
      userId: '1',
      subject: 'ada@example.test',
      provider: 'local',
      displayName: 'Ada Lovelace',
      roles: ['user'],
      permissions: ['chat:write'],
    };
    const verifyAccessTokenMock = jest.fn().mockResolvedValue(principal);
    const accessTokenService = {
      verifyAccessToken: verifyAccessTokenMock,
    } as Pick<AccessTokenService, 'verifyAccessToken'> as AccessTokenService;

    const verifyAccessToken = await Promise.resolve(
      accessTokenVerifierProvider.useFactory(accessTokenService),
    );

    await expect(verifyAccessToken('access-token')).resolves.toEqual(principal);
    expect(verifyAccessTokenMock).toHaveBeenCalledWith('access-token');
  });
});
