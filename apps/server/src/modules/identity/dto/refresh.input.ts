import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, MaxLength } from 'class-validator';

@InputType()
export class RefreshInput {
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(512)
  refreshToken?: string;
}
