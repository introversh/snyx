import { IsString, MaxLength, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Display name cannot exceed 50 characters.' })
  displayName?: string | null;

  @IsOptional()
  @IsString()
  profilePicture?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'Bio cannot exceed 250 characters.' })
  bio?: string;

  @IsOptional()
  @IsString()
  profileBanner?: string;

  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'other'], { message: 'Gender must be male, female, or other.' })
  gender?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
