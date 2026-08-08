import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { YoutubeModule } from './modules/youtube/youtube.module';

@Module({
  imports: [HealthModule, RoomsModule, YoutubeModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
