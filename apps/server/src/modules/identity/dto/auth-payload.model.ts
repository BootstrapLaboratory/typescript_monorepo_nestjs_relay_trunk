import { Field, ObjectType } from '@nestjs/graphql';
import { PrincipalModel } from './principal.model';

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken!: string;

  @Field()
  accessTokenExpiresAt!: string;

  @Field({ nullable: true })
  refreshToken?: string;

  @Field()
  refreshTokenExpiresAt!: string;

  @Field(() => PrincipalModel)
  principal!: PrincipalModel;
}
