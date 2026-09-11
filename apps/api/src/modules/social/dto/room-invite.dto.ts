import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateRoomInviteDto {
  @IsString()
  @MinLength(1, { message: 'Room ID is required.' })
  @MaxLength(50, { message: 'Room ID cannot exceed 50 characters.' })
  roomId: string;
}
