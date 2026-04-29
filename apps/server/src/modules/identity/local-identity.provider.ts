import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IdentityConfigService } from './identity-config.service';
import { IdentityAccountEntity } from './entities/identity-account.entity';
import { IdentityUserEntity } from './entities/identity-user.entity';
import { IdentityUserRoleEntity } from './entities/identity-user-role.entity';
import { PasswordService } from './password.service';
import {
  IdentityProvider,
  IdentityProviderCapability,
  ProviderIdentity,
  ProviderLoginRequest,
  ProviderRegistrationRequest,
} from './identity.types';

const LOCAL_PROVIDER_ID = 'local';

@Injectable()
export class LocalIdentityProvider implements IdentityProvider {
  readonly id = LOCAL_PROVIDER_ID;
  readonly capabilities = [
    IdentityProviderCapability.Login,
    IdentityProviderCapability.Registration,
  ] as const;

  constructor(
    private readonly dataSource: DataSource,
    private readonly identityConfig: IdentityConfigService,
    private readonly passwordService: PasswordService,
    @InjectRepository(IdentityAccountEntity)
    private readonly accountRepo: Repository<IdentityAccountEntity>,
    @InjectRepository(IdentityUserRoleEntity)
    private readonly roleRepo: Repository<IdentityUserRoleEntity>,
  ) {}

  async login(request: ProviderLoginRequest): Promise<ProviderIdentity> {
    const subject = this.normalizeSubject(request.email);
    const account = await this.accountRepo.findOne({
      relations: {
        user: true,
      },
      where: {
        provider: LOCAL_PROVIDER_ID,
        subject,
      },
    });

    if (!account?.passwordHash || !account.user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.passwordService.verifyPassword(
      account.passwordHash,
      request.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = await this.getRoles(account.userId);
    return {
      permissions: [],
      provider: LOCAL_PROVIDER_ID,
      roles,
      subject,
      userId: String(account.userId),
    };
  }

  async register(
    request: ProviderRegistrationRequest,
  ): Promise<ProviderIdentity> {
    const subject = this.normalizeSubject(request.email);
    const existingAccount = await this.accountRepo.findOneBy({
      provider: LOCAL_PROVIDER_ID,
      subject,
    });
    if (existingAccount) {
      throw new BadRequestException('Local identity already exists');
    }

    const passwordHash = await this.passwordService.hashPassword(
      request.password,
    );
    const defaultRole = this.identityConfig.getDefaultRole();

    const userId = await this.dataSource.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(IdentityUserEntity, {
          displayName: request.displayName,
          email: subject,
          isActive: true,
        }),
      );

      await manager.save(
        manager.create(IdentityAccountEntity, {
          passwordHash,
          provider: LOCAL_PROVIDER_ID,
          subject,
          userId: user.id,
        }),
      );

      await manager.save(
        manager.create(IdentityUserRoleEntity, {
          role: defaultRole,
          userId: user.id,
        }),
      );

      return user.id;
    });

    return {
      permissions: [],
      provider: LOCAL_PROVIDER_ID,
      roles: [defaultRole],
      subject,
      userId: String(userId),
    };
  }

  private async getRoles(userId: number): Promise<string[]> {
    const roles = await this.roleRepo.findBy({ userId });
    return roles.map((role) => role.role);
  }

  private normalizeSubject(email: string): string {
    return email.trim().toLowerCase();
  }
}
