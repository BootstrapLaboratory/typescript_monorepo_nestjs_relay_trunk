import { Inject, Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { IdentityConfigService } from './identity-config.service';
import {
  IDENTITY_PROVIDERS,
  IdentityProvider,
  IdentityProviderCapability,
} from './identity.types';

@Injectable()
export class IdentityProviderRegistry {
  private readonly providersById = new Map<string, IdentityProvider>();

  constructor(
    private readonly identityConfig: IdentityConfigService,
    @Inject(IDENTITY_PROVIDERS)
    providers: IdentityProvider[],
  ) {
    for (const provider of providers) {
      this.providersById.set(provider.id, provider);
    }
  }

  getLoginProvider(providerId?: string): IdentityProvider {
    return this.getEnabledProviderWithCapability(
      providerId || this.identityConfig.getDefaultLoginProvider(),
      IdentityProviderCapability.Login,
    );
  }

  getRegistrationProvider(providerId?: string): IdentityProvider {
    return this.getEnabledProviderWithCapability(
      providerId || this.identityConfig.getRegistrationProvider(),
      IdentityProviderCapability.Registration,
    );
  }

  private getEnabledProviderWithCapability(
    providerId: string,
    capability: IdentityProviderCapability,
  ): IdentityProvider {
    const enabledProviders = new Set(this.identityConfig.getEnabledProviders());
    if (!enabledProviders.has(providerId)) {
      throw new BadRequestException(
        `Identity provider ${providerId} is not enabled`,
      );
    }

    const provider = this.providersById.get(providerId);
    if (!provider) {
      throw new BadRequestException(
        `Identity provider ${providerId} is not registered`,
      );
    }

    if (!provider.capabilities.includes(capability)) {
      throw new BadRequestException(
        `Identity provider ${providerId} does not support ${capability}`,
      );
    }

    return provider;
  }
}
