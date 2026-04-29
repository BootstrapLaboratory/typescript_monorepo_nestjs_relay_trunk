import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PrincipalModel {
  @Field()
  userId!: string;

  @Field()
  subject!: string;

  @Field()
  provider!: string;

  @Field(() => [String])
  roles!: string[];

  @Field(() => [String])
  permissions!: string[];
}
