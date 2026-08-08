import { Controller, Post, Get, Param, NotFoundException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Post()
  async createRoom() {
    const room = await this.roomsService.createRoom();
    return {
      roomId: room.id,
      isPlaying: room.isPlaying,
      position: room.position,
      queue: [],
    };
  }

  @Get(':id')
  async getRoom(@Param('id') id: string) {
    const cleanId = id.toUpperCase().trim();
    try {
      const room = await this.roomsService.getRoom(cleanId);
      return {
        roomId: room.id,
        currentVideoId: room.currentVideoId,
        currentVideoTitle: room.currentVideoTitle,
        currentVideoThumbnail: room.currentVideoThumbnail,
        isPlaying: room.isPlaying,
        position: room.position,
        playbackStartedAt: room.playbackStartedAt ? room.playbackStartedAt.getTime() : null,
        queue: room.queue.map((item: any) => ({
          id: item.id,
          videoId: item.videoId,
          title: item.title,
          thumbnail: item.thumbnail,
          channelTitle: item.channelTitle,
          duration: item.duration || undefined,
          addedBy: item.addedBy,
          addedAt: item.addedAt.getTime(),
        })),
      };
    } catch (error) {
      throw new NotFoundException(`Room ${cleanId} not found.`);
    }
  }
}
