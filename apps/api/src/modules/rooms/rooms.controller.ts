import { Controller, Post, Get, Param, Query, Headers, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { AuthService } from '../auth/auth.service';

@Controller('rooms')
export class RoomsController {
  constructor(
    private roomsService: RoomsService,
    private authService: AuthService,
  ) {}

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

  @Post('from-playlist/:id')
  async createRoomFromPlaylist(
    @Param('id') playlistId: string,
    @Headers('authorization') authHeader: string
  ) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token) throw new UnauthorizedException('Authentication required');
    const decoded = this.authService.verifyToken(token);
    const room = await this.roomsService.createRoomFromPlaylist(playlistId, decoded.userId);
    return {
      roomId: room.id,
      isPlaying: room.isPlaying,
      position: room.position,
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
          isEdited: Boolean(msg.isEdited),
          isDelivered: Boolean(msg.isDelivered),
          isRead: Boolean(msg.isRead),
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
      isEdited: Boolean(msg.isEdited),
      isDelivered: Boolean(msg.isDelivered),
      isRead: Boolean(msg.isRead),
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
