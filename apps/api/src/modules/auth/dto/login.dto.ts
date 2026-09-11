import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1, { message: 'Username is required.' })
  @MaxLength(50, { message: 'Username cannot exceed 50 characters.' })
  username: string;

  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  @MaxLength(100, { message: 'Password cannot exceed 100 characters.' })
  password: string;
}
