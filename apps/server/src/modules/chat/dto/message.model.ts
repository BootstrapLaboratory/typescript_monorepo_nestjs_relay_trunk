import { Field, ID, ObjectType } from '@nestjs/graphql';
import { AutoMap } from '@automapper/classes';

@ObjectType({ description: 'chat message' })
export class Message {
  @Field(() => ID)
  @AutoMap()
  id!: string;

  @Field(() => String, { nullable: true })
  @AutoMap()
  author?: string;

  @Field(() => String, { nullable: true })
  @AutoMap()
  email?: string;

  @Field()
  @AutoMap()
  body!: string;
}
