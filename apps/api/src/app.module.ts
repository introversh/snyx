import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './modules/health/health.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { YoutubeModule } from './modules/youtube/youtube.module';
import { AuthModule } from './modules/auth/auth.module';
import { SocialModule } from './modules/social/social.module';
import { PlaylistModule } from './modules/playlist/playlist.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HealthModule,
    RoomsModule,
    YoutubeModule,
    AuthModule,
    SocialModule,
    PlaylistModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
