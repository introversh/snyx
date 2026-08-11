import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { YoutubeModule } from './modules/youtube/youtube.module';
import { AuthModule } from './modules/auth/auth.module';
import { SocialModule } from './modules/social/social.module';

@Module({
  imports: [HealthModule, RoomsModule, YoutubeModule, AuthModule, SocialModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
