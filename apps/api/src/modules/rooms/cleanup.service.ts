import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RoomsService } from './rooms.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private roomsService: RoomsService) {}

  @Cron('0 3 * * *') // Daily at 3 AM
  async handleRoomCleanup() {
    this.logger.log('Running room cleanup cron...');
    try {
      await this.roomsService.deleteExpiredRooms();
      await this.roomsService.cleanOldChatMessages();
      this.logger.log('Room cleanup completed.');
    } catch (error) {
      this.logger.error('Room cleanup failed:', error);
    }
  }
}
