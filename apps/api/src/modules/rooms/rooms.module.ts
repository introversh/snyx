import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway, PrismaService],
  exports: [RoomsService],
})
export class RoomsModule {}
