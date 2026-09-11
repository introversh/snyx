import { IsString, MinLength, MaxLength } from 'class-validator';

export class SendDirectMessageDto {
  @IsString()
  @MinLength(1, { message: 'Message content cannot be empty.' })
  @MaxLength(2000, { message: 'Message cannot exceed 2000 characters.' })
  content: string;
}
