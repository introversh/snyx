import { Module } from '@nestjs/common';
import { PlaylistController } from './playlist.controller';
import { PlaylistService } from './playlist.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PlaylistController],
  providers: [PlaylistService, PrismaService],
  exports: [PlaylistService],
})
export class PlaylistModule {}
