import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, Length, MaxLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(64)
  provider?: string;

  @Field()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @Field()
  @Length(8, 256)
  password!: string;

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(120)
  displayName?: string;
}
