import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { IdentityGraphqlContext } from '../../identity/graphql/identity-graphql.context';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../access-control.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context)) {
      return true;
    }

    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (requiredRoles.length === 0) {
      return true;
    }

    const gqlContext =
      GqlExecutionContext.create(context).getContext<IdentityGraphqlContext>();
    const principal = gqlContext.principal;
    if (!principal) {
      throw new ForbiddenException('Principal is required for role checks');
    }

    const hasRoles = requiredRoles.every((role) => {
      return principal.roles.includes(role);
    });
    if (!hasRoles) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
