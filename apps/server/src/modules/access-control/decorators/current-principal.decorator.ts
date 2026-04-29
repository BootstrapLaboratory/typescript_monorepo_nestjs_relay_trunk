import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { IdentityGraphqlContext } from '../../identity/graphql/identity-graphql.context';
import { Principal } from '../../identity/identity.types';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal | null => {
    if (context.getType<string>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext<IdentityGraphqlContext>().principal ?? null;
    }

    const request = context.switchToHttp().getRequest<{
      principal?: Principal | null;
    }>();
    return request.principal ?? null;
  },
);
