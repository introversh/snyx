import { Controller, Post, Get, Param, Query, NotFoundException } from '@nestjs/common';
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
        chatMessages: (room as any).chatMessages?.map((msg: any) => ({
          id: msg.id,
          roomId: msg.roomId,
          senderId: msg.senderId,
          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar || undefined,
          content: msg.content,
          replyToId: msg.replyToId || undefined,
          replyToSenderName: msg.replyToSenderName || undefined,
          replyToContent: msg.replyToContent || undefined,
          createdAt: msg.createdAt.getTime(),
          reactions: msg.reactions ? msg.reactions.map((r: any) => ({
            id: r.id,
            messageId: r.messageId,
            participantId: r.participantId,
            displayName: r.displayName,
            emoji: r.emoji,
            createdAt: r.createdAt.getTime(),
          })) : [],
        })) || [],
      };
    } catch (error) {
      throw new NotFoundException(`Room ${cleanId} not found.`);
    }
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string
  ) {
    const cleanId = id.toUpperCase().trim();
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const messages = await this.roomsService.getPaginatedMessages(cleanId, before, limitNum);
    return messages.map((msg: any) => ({
      id: msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderAvatar: msg.senderAvatar || undefined,
      content: msg.content,
      replyToId: msg.replyToId || undefined,
      replyToSenderName: msg.replyToSenderName || undefined,
      replyToContent: msg.replyToContent || undefined,
      createdAt: msg.createdAt.getTime(),
      reactions: msg.reactions ? msg.reactions.map((r: any) => ({
        id: r.id,
        messageId: r.messageId,
        participantId: r.participantId,
        displayName: r.displayName,
        emoji: r.emoji,
        createdAt: r.createdAt.getTime(),
      })) : [],
    }));
  }
}
