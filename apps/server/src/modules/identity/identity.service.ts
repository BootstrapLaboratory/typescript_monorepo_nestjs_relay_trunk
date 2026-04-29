import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IdentityProviderRegistry } from './identity-provider-registry.service';
import { AuthSessionResult, Principal } from './identity.types';
import { IdentitySessionService } from './session.service';

@Injectable()
export class IdentityService {
  constructor(
    private readonly providerRegistry: IdentityProviderRegistry,
    private readonly sessionService: IdentitySessionService,
  ) {}

  async login(input: {
    email: string;
    password: string;
    provider?: string;
  }): Promise<AuthSessionResult> {
    const provider = this.providerRegistry.getLoginProvider(input.provider);
    if (!provider.login) {
      throw new UnauthorizedException('Identity provider cannot login');
    }

    const identity = await provider.login({
      email: input.email,
      password: input.password,
    });
    return this.sessionService.createSession(identity);
  }

  async register(input: {
    displayName?: string;
    email: string;
    password: string;
    provider?: string;
  }): Promise<AuthSessionResult> {
    const provider = this.providerRegistry.getRegistrationProvider(
      input.provider,
    );
    if (!provider.register) {
      throw new UnauthorizedException('Identity provider cannot register');
    }

    const identity = await provider.register({
      displayName: input.displayName,
      email: input.email,
      password: input.password,
    });
    return this.sessionService.createSession(identity);
  }

  refresh(refreshToken: string): Promise<AuthSessionResult> {
    return this.sessionService.refreshSession(refreshToken);
  }

  revokeRefreshToken(refreshToken: string): Promise<boolean> {
    return this.sessionService.revokeRefreshToken(refreshToken);
  }

  revokeAllForPrincipal(principal: Principal): Promise<void> {
    return this.sessionService.revokeAllSessionsForUser(
      Number(principal.userId),
    );
  }
}
