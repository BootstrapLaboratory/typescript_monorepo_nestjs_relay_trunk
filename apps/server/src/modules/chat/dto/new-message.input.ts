import { Field, InputType } from '@nestjs/graphql';
import { Length, MaxLength, IsOptional } from 'class-validator';
import { AutoMap } from '@automapper/classes';

@InputType()
export class NewMessageInput {
  @Field({ nullable: true })
  @MaxLength(16)
  @AutoMap()
  @IsOptional()
  author?: string;

  @Field({ nullable: false })
  @Length(1, 1024)
  @AutoMap()
  body: string;
}
