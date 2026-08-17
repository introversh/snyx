import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms.service';
import {
  SocketEvents,
  RoomState,
  RoomUser,
  JoinRoomPayload,
  PlaybackPlayPayload,
  PlaybackSeekPayload,
  QueueAddPayload,
  QueueRemovePayload,
} from '@youtube-together/shared';

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      if (
        !origin ||
        origin === 'https://snyx.netlify.app' ||
        origin === 'http://localhost:5173' ||
        origin.endsWith('.netlify.app') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  },
})
export class RoomsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Memory store for room participant presence
  // roomId -> participantId -> RoomUser & { socketId: string }
  private presence = new Map<string, Map<string, RoomUser & { socketId: string }>>();

  constructor(private roomsService: RoomsService) {}

  async handleDisconnect(client: Socket) {
    for (const [roomId, users] of this.presence.entries()) {
      for (const [participantId, user] of users.entries()) {
        if (user.socketId === client.id) {
          user.isConnected = false;
          console.log(`User [${user.displayName}] marked disconnected in room [${roomId}]`);
          await this.broadcastRoomState(roomId);
          return;
        }
      }
    }
  }

  private async broadcastRoomState(roomId: string) {
    try {
      const dbRoom = await this.roomsService.getRoom(roomId);
      const roomUsersMap = this.presence.get(roomId);
      const users: RoomUser[] = roomUsersMap
        ? Array.from(roomUsersMap.values()).map(({ participantId, displayName, isConnected }) => ({
            participantId,
            displayName,
            isConnected,
          }))
        : [];

      const state: RoomState = {
        roomId: dbRoom.id,
        currentVideoId: dbRoom.currentVideoId,
        currentVideoTitle: dbRoom.currentVideoTitle,
        currentVideoThumbnail: dbRoom.currentVideoThumbnail,
        isPlaying: dbRoom.isPlaying,
        position: dbRoom.position,
        playbackStartedAt: dbRoom.playbackStartedAt ? dbRoom.playbackStartedAt.getTime() : null,
        queue: dbRoom.queue.map((item: any) => ({
          id: item.id,
          videoId: item.videoId,
          title: item.title,
          thumbnail: item.thumbnail,
          channelTitle: item.channelTitle,
          duration: item.duration || undefined,
          addedBy: item.addedBy,
          addedAt: item.addedAt.getTime(),
        })),
        users,
        chatMessages: (dbRoom as any).chatMessages ? (dbRoom as any).chatMessages.map((msg: any) => ({
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
        })) : [],
      };

      this.server.to(roomId).emit(SocketEvents.ROOM_STATE, state);
    } catch (error: any) {
      if (error?.status === 404 || error?.name === 'NotFoundException') {
        this.presence.delete(roomId);
      } else {
        console.error(`Failed to broadcast state for room ${roomId}:`, error);
      }
    }
  }

  @SubscribeMessage(SocketEvents.ROOM_JOIN)
  async handleJoin(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, displayName, participantId } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    try {
      // Fetch room from DB to ensure it exists
      await this.roomsService.getRoom(cleanRoomId);

      // Get or create users map for this room
      if (!this.presence.has(cleanRoomId)) {
        this.presence.set(cleanRoomId, new Map());
      }
      const roomUsers = this.presence.get(cleanRoomId)!;

      // Check room capacity limit (max 2 users)
      const existingUser = roomUsers.get(participantId);
      const activeUsersCount = Array.from(roomUsers.values()).filter(u => u.isConnected).length;

      // If this is a new participant and room is already full (2 active connections)
      if (!existingUser && activeUsersCount >= 2) {
        client.emit(SocketEvents.ERROR, { message: 'This room is full.' });
        return;
      }

      // Add/Update user details
      roomUsers.set(participantId, {
        participantId,
        displayName,
        isConnected: true,
        socketId: client.id,
      });

      // Join client to Socket.IO room channel
      client.join(cleanRoomId);
      console.log(`User [${displayName}] joined room [${cleanRoomId}]`);

      // Broadcast updated room state
      await this.broadcastRoomState(cleanRoomId);
    } catch (err) {
      client.emit(SocketEvents.ERROR, { message: 'Room not found.' });
    }
  }

  @SubscribeMessage(SocketEvents.ROOM_LEAVE)
  async handleLeave(
    @MessageBody() payload: { roomId: string; participantId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, participantId } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    const roomUsers = this.presence.get(cleanRoomId);
    if (roomUsers) {
      roomUsers.delete(participantId);
    }

    client.leave(cleanRoomId);
    console.log(`User [${participantId}] left room [${cleanRoomId}]`);
    await this.broadcastRoomState(cleanRoomId);
  }

  @SubscribeMessage(SocketEvents.PLAYBACK_PLAY)
  async handlePlay(
    @MessageBody() payload: PlaybackPlayPayload & { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, position } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    await this.roomsService.updatePlaybackState(
      cleanRoomId,
      true,
      position,
      new Date()
    );

    await this.broadcastRoomState(cleanRoomId);
  }

  @SubscribeMessage(SocketEvents.PLAYBACK_PAUSE)
  async handlePause(
    @MessageBody() payload: PlaybackPlayPayload & { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, position } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    await this.roomsService.updatePlaybackState(
      cleanRoomId,
      false,
      position,
      null
    );

    await this.broadcastRoomState(cleanRoomId);
  }

  @SubscribeMessage(SocketEvents.PLAYBACK_SEEK)
  async handleSeek(
    @MessageBody() payload: PlaybackSeekPayload & { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, position } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    const room = await this.roomsService.getRoom(cleanRoomId);
    
    // If playing, reset playbackStartedAt to now so drift calculations align
    const playbackStartedAt = room.isPlaying ? new Date() : null;

    await this.roomsService.updatePlaybackState(
      cleanRoomId,
      room.isPlaying,
      position,
      playbackStartedAt
    );

    await this.broadcastRoomState(cleanRoomId);
  }

  @SubscribeMessage(SocketEvents.PLAYBACK_LOAD)
  async handleLoad(
    @MessageBody() payload: { roomId: string; videoId: string; title: string; thumbnail: string; channelTitle: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, videoId, title, thumbnail, channelTitle } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    await this.roomsService.updatePlaybackState(
      cleanRoomId,
      true,
      0.0,
      new Date(),
      videoId,
      title,
      thumbnail
    );

    await this.broadcastRoomState(cleanRoomId);
  }

  @SubscribeMessage(SocketEvents.QUEUE_ADD)
  async handleQueueAdd(
    @MessageBody() payload: QueueAddPayload & { roomId: string; participantId: string; displayName: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, videoId, title, thumbnail, channelTitle, duration, displayName } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    await this.roomsService.addQueueItem(
      cleanRoomId,
      videoId,
      title,
      thumbnail,
      channelTitle,
      displayName,
      duration
    );

    // If the room has no current video, automatically load this added video
    const room = await this.roomsService.getRoom(cleanRoomId);
    if (!room.currentVideoId) {
      const nextItem = room.queue[0];
      if (nextItem) {
        await this.roomsService.updatePlaybackState(
          cleanRoomId,
          true,
          0.0,
          new Date(),
          nextItem.videoId,
          nextItem.title,
          nextItem.thumbnail
        );
        await this.roomsService.removeQueueItem(cleanRoomId, nextItem.id);
      }
    }

    await this.broadcastRoomState(cleanRoomId);
  }

  @SubscribeMessage(SocketEvents.QUEUE_REMOVE)
  async handleQueueRemove(
    @MessageBody() payload: QueueRemovePayload & { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, itemId } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    await this.roomsService.removeQueueItem(cleanRoomId, itemId);
    await this.broadcastRoomState(cleanRoomId);
  }

  @SubscribeMessage(SocketEvents.PLAYBACK_ENDED)
  async handlePlaybackEnded(
    @MessageBody() payload: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    const room = await this.roomsService.getRoom(cleanRoomId);
    if (room.queue.length > 0) {
      // Authoritative advancement to next video
      const nextItem = room.queue[0];
      await this.roomsService.updatePlaybackState(
        cleanRoomId,
        true,
        0.0,
        new Date(),
        nextItem.videoId,
        nextItem.title,
        nextItem.thumbnail
      );
      // Remove from queue
      await this.roomsService.removeQueueItem(cleanRoomId, nextItem.id);
    } else {
      // Pause current video at end
      await this.roomsService.updatePlaybackState(
        cleanRoomId,
        false,
        room.position,
        null
      );
    }

    await this.broadcastRoomState(cleanRoomId);
  }

  @SubscribeMessage(SocketEvents.PLAYBACK_NEXT)
  async handleNext(
    @MessageBody() payload: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    const room = await this.roomsService.getRoom(cleanRoomId);
    if (room.queue.length > 0) {
      const nextItem = room.queue[0];
      await this.roomsService.updatePlaybackState(
        cleanRoomId,
        true,
        0.0,
        new Date(),
        nextItem.videoId,
        nextItem.title,
        nextItem.thumbnail
      );
      await this.roomsService.removeQueueItem(cleanRoomId, nextItem.id);
    }

    await this.broadcastRoomState(cleanRoomId);
  }

  @SubscribeMessage(SocketEvents.PLAYBACK_PLAY_QUEUE_ITEM)
  async handlePlayQueueItem(
    @MessageBody() payload: { roomId: string; itemId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, itemId } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    try {
      const room = await this.roomsService.getRoom(cleanRoomId);
      const targetItem = room.queue.find((item: any) => item.id === itemId);
      if (targetItem) {
        await this.roomsService.updatePlaybackState(
          cleanRoomId,
          true,
          0.0,
          new Date(),
          targetItem.videoId,
          targetItem.title,
          targetItem.thumbnail
        );
        await this.roomsService.removeQueueItem(cleanRoomId, itemId);
      }
      await this.broadcastRoomState(cleanRoomId);
    } catch (e) {
      console.error(`Error playing queue item ${itemId}:`, e);
    }
  }

  @SubscribeMessage(SocketEvents.QUEUE_REORDER)
  async handleQueueReorder(
    @MessageBody() payload: { roomId: string; startIndex: number; endIndex: number },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, startIndex, endIndex } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    try {
      const room = await this.roomsService.getRoom(cleanRoomId);
      const queueList = [...room.queue];
      if (startIndex >= 0 && startIndex < queueList.length && endIndex >= 0 && endIndex < queueList.length) {
        const [removed] = queueList.splice(startIndex, 1);
        queueList.splice(endIndex, 0, removed);

        const updates = queueList.map((item, idx) => ({
          id: item.id,
          order: idx,
        }));

        await this.roomsService.updateQueueOrder(cleanRoomId, updates);
      }
      await this.broadcastRoomState(cleanRoomId);
    } catch (e) {
      console.error(`Error reordering queue for room ${roomId}:`, e);
    }
  }

  @SubscribeMessage(SocketEvents.CHAT_MESSAGE)
  async handleChatMessage(
    @MessageBody() payload: {
      roomId: string;
      senderId: string;
      senderName: string;
      senderAvatar?: string;
      content: string;
      replyToId?: string;
      replyToSenderName?: string;
      replyToContent?: string;
    },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, senderId, senderName, senderAvatar, content, replyToId, replyToSenderName, replyToContent } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    try {
      const msg = await this.roomsService.createChatMessage(
        cleanRoomId,
        senderId,
        senderName,
        content,
        senderAvatar,
        replyToId,
        replyToSenderName,
        replyToContent
      );

      // Broadcast chat message instantly to all connected client sockets in the room
      this.server.to(cleanRoomId).emit(SocketEvents.CHAT_MESSAGE, {
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
      });
    } catch (err) {
      console.error(`Error creating/broadcasting chat message in room ${roomId}:`, err);
    }
  }

  @SubscribeMessage(SocketEvents.CHAT_REACTION)
  async handleChatReaction(
    @MessageBody() payload: {
      roomId: string;
      messageId: string;
      participantId: string;
      displayName: string;
      emoji: string;
    },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, messageId, participantId, displayName, emoji } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    try {
      const result = await this.roomsService.toggleReaction(
        cleanRoomId,
        messageId,
        participantId,
        displayName,
        emoji
      );

      this.server.to(cleanRoomId).emit(SocketEvents.CHAT_REACTION, {
        messageId: result.messageId,
        reactions: result.reactions.map((r: any) => ({
          id: r.id,
          messageId: r.messageId,
          participantId: r.participantId,
          displayName: r.displayName,
          emoji: r.emoji,
          createdAt: r.createdAt.getTime(),
        })),
      });
    } catch (err) {
      console.error(`Error toggling chat reaction in room ${roomId}:`, err);
    }
  }

  @SubscribeMessage(SocketEvents.CHAT_DELETE)
  async handleChatDelete(
    @MessageBody() payload: { roomId: string; messageId: string; participantId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, messageId, participantId } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    try {
      const deleted = await this.roomsService.deleteChatMessage(cleanRoomId, messageId, participantId);
      if (deleted) {
        this.server.to(cleanRoomId).emit(SocketEvents.CHAT_DELETE, { messageId });
      }
    } catch (err) {
      console.error(`Error un-sending chat message in room ${roomId}:`, err);
    }
  }
}
