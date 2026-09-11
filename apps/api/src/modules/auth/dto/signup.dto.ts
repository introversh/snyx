import { IsString, MinLength, MaxLength, Matches, IsOptional, IsIn } from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long.' })
  @MaxLength(30, { message: 'Username cannot exceed 30 characters.' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores.',
  })
  username: string;

  @IsString()
  @MinLength(4, { message: 'Password must be at least 4 characters long.' })
  @MaxLength(100, { message: 'Password cannot exceed 100 characters.' })
  password: string;

  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'other'], { message: 'Gender must be male, female, or other.' })
  gender?: string;
}
