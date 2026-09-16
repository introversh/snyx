import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [AuthModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway, PrismaService, CleanupService],
  exports: [RoomsService],
})
export class RoomsModule {}
