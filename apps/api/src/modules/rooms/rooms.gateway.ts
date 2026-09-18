import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect, OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma.service';
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
import { AuthService } from '../auth/auth.service';

const envOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [];
const defaultOrigins = [
  'https://snyx.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];
const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        (process.env.NODE_ENV !== 'production' && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')))
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  },
})
export class RoomsGateway implements OnGatewayDisconnect, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  // Memory store for room participant presence
  // roomId -> participantId -> RoomUser & { socketId: string }
  private presence = new Map<string, Map<string, RoomUser & { socketId: string }>>();

  constructor(
    private roomsService: RoomsService,
    private authService: AuthService,
    private prisma: PrismaService
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (token) {
      try {
        const decoded = this.authService.verifyToken(token);
        const isValid = await this.authService.validateActiveToken(decoded.userId, token);
        if (!isValid) {
          client.emit(SocketEvents.SESSION_FORCE_LOGOUT);
          client.disconnect(true);
          return;
        }

        client.data.userId = decoded.userId;
        client.data.token = token;

        // Join personal user room for targeted notifications & knocks
        client.join(`user:${decoded.userId}`);

        // Single device session enforcement:
        // Force-logout any existing sockets for this user that carry an older/different token
        const existingSockets = await this.server.in(`user:${decoded.userId}`).fetchSockets();
        for (const existingSocket of existingSockets) {
          if (existingSocket.id !== client.id && existingSocket.data?.token && existingSocket.data.token !== token) {
            existingSocket.emit(SocketEvents.SESSION_FORCE_LOGOUT);
            existingSocket.disconnect(true);
          }
        }

        // Mark user as online in DB
        await this.prisma.user.updateMany({
          where: { id: decoded.userId },
          data: { isOnline: true },
        });
      } catch (e) {
        client.emit(SocketEvents.SESSION_FORCE_LOGOUT);
        client.disconnect(true);
      }
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.activityLogId) {
      await this.roomsService.endActivity(client.data.activityLogId);
      client.data.activityLogId = null;
    }

    if (client.data.userId) {
      try {
        const remainingSockets = await this.server.in(`user:${client.data.userId}`).fetchSockets();
        const otherSockets = remainingSockets.filter(s => s.id !== client.id);
        if (otherSockets.length === 0) {
          await this.prisma.user.updateMany({
            where: { id: client.data.userId },
            data: { isOnline: false, lastSeenAt: new Date() },
          });
        }
      } catch (e) {}
    }

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
        serverTime: Date.now(),
        isPermanent: dbRoom.isPermanent,
        expiresAt: dbRoom.expiresAt ? dbRoom.expiresAt.getTime() : null,
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

      // Verify token if available in handshake or payload
      const token = (client.handshake?.auth?.token || (payload as any)?.token) as string | undefined;
      let verifiedUserId = participantId;
      let verifiedDisplayName = displayName;

      if (token) {
        try {
          const decoded = this.authService.verifyToken(token);
          if (decoded && decoded.userId) {
            verifiedUserId = decoded.userId;
            if (decoded.username) {
              verifiedDisplayName = displayName || decoded.username;
            }
          }
        } catch (e) {
          // Fall back to participantId
        }
      }

      client.data.userId = verifiedUserId;
      client.data.displayName = verifiedDisplayName;
      client.data.roomId = cleanRoomId;

      // Add/Update user details
      roomUsers.set(verifiedUserId, {
        participantId: verifiedUserId,
        displayName: verifiedDisplayName,
        isConnected: true,
        socketId: client.id,
      });

      // Join client to Socket.IO room channel
      client.join(cleanRoomId);
      console.log(`User [${verifiedDisplayName}] joined room [${cleanRoomId}]`);

      // Log room IP
      const ipAddress = (client.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || client.handshake.address || 'unknown';
      try {
        await this.roomsService.logIp(cleanRoomId, ipAddress, verifiedUserId);
      } catch (e) {}

      // Start user room activity tracking
      if (verifiedUserId) {
        try {
          const activityId = await this.roomsService.startActivity(cleanRoomId, verifiedUserId);
          client.data.activityLogId = activityId;
        } catch (e) {}
      }

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

    if (client.data.activityLogId) {
      await this.roomsService.endActivity(client.data.activityLogId);
      client.data.activityLogId = null;
    }

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

    try {
      await this.roomsService.logVideoPlay(
        cleanRoomId,
        videoId,
        title,
        thumbnail,
        client.data.userId || null
      );
    } catch (e) {}

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

  @SubscribeMessage(SocketEvents.ROOM_USER_REMOVE)
  async handleRemoveUser(
    @MessageBody() payload: { roomId: string; targetParticipantId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, targetParticipantId } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();

    const roomUsers = this.presence.get(cleanRoomId);
    if (roomUsers) {
      const targetUser = roomUsers.get(targetParticipantId);
      if (targetUser) {
        // Emit kicked event directly to target user's socket
        this.server.to(targetUser.socketId).emit(SocketEvents.ROOM_USER_KICKED, {
          message: 'You have been removed from this room by a participant.'
        });

        // Leave socket channel
        const targetSocket = this.server.sockets.sockets.get(targetUser.socketId);
        if (targetSocket) {
          targetSocket.leave(cleanRoomId);
        }

        // Delete from room presence
        roomUsers.delete(targetParticipantId);
      }
    }

    console.log(`User [${targetParticipantId}] removed from room [${cleanRoomId}]`);
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
    const cleanContent = content ? content.trim() : '';

    if (!cleanContent || cleanContent.length > 2000) {
      return;
    }

    const verifiedSenderId = client.data?.userId || senderId;
    const verifiedSenderName = client.data?.displayName || senderName;

    // Check if other participants are actively connected in the room
    const roomUsers = this.presence.get(cleanRoomId);
    const otherConnectedUsers = roomUsers
      ? Array.from(roomUsers.values()).filter(u => u.isConnected && u.participantId !== verifiedSenderId)
      : [];
    const isDelivered = otherConnectedUsers.length > 0;

    try {
      const msg = await this.roomsService.createChatMessage(
        cleanRoomId,
        verifiedSenderId,
        verifiedSenderName,
        cleanContent,
        senderAvatar,
        replyToId,
        replyToSenderName,
        replyToContent,
        isDelivered
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
      });
    } catch (err) {
      console.error(`Error creating/broadcasting chat message in room ${roomId}:`, err);
    }
  }

  @SubscribeMessage(SocketEvents.CHAT_TYPING)
  async handleChatTyping(
    @MessageBody() payload: { roomId: string; isTyping: boolean; participantId?: string; displayName?: string },
    @ConnectedSocket() client: Socket
  ) {
    const cleanRoomId = payload.roomId?.toUpperCase().trim();
    if (!cleanRoomId) return;
    const verifiedSenderId = client.data?.userId || payload.participantId;
    const verifiedSenderName = client.data?.displayName || payload.displayName;

    // Broadcast typing status to everyone else in the room
    client.to(cleanRoomId).emit(SocketEvents.CHAT_TYPING, {
      roomId: cleanRoomId,
      participantId: verifiedSenderId,
      displayName: verifiedSenderName,
      isTyping: Boolean(payload.isTyping),
    });
  }

  @SubscribeMessage(SocketEvents.CHAT_READ)
  async handleChatRead(
    @MessageBody() payload: { roomId: string; participantId?: string; messageIds?: string[] },
    @ConnectedSocket() client: Socket
  ) {
    const cleanRoomId = payload.roomId?.toUpperCase().trim();
    if (!cleanRoomId) return;
    const verifiedReaderId = client.data?.userId || payload.participantId;

    try {
      await this.roomsService.markMessagesAsRead(cleanRoomId, verifiedReaderId, payload.messageIds);
      this.server.to(cleanRoomId).emit(SocketEvents.CHAT_READ, {
        roomId: cleanRoomId,
        readerParticipantId: verifiedReaderId,
        messageIds: payload.messageIds,
      });
    } catch (err) {
      console.error(`Error marking messages as read in room ${cleanRoomId}:`, err);
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
    const verifiedParticipantId = client.data?.userId || participantId;
    const verifiedDisplayName = client.data?.displayName || displayName;

    try {
      const result = await this.roomsService.toggleReaction(
        cleanRoomId,
        messageId,
        verifiedParticipantId,
        verifiedDisplayName,
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
    const verifiedParticipantId = client.data?.userId || participantId;

    try {
      const deleted = await this.roomsService.deleteChatMessage(cleanRoomId, messageId, verifiedParticipantId);
      if (deleted) {
        this.server.to(cleanRoomId).emit(SocketEvents.CHAT_DELETE, { messageId });
      }
    } catch (err) {
      console.error(`Error un-sending chat message in room ${roomId}:`, err);
    }
  }

  @SubscribeMessage(SocketEvents.CHAT_EDIT)
  async handleChatEdit(
    @MessageBody() payload: { roomId: string; messageId: string; participantId: string; newContent: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, messageId, participantId, newContent } = payload;
    const cleanRoomId = roomId.toUpperCase().trim();
    const cleanContent = newContent ? newContent.trim() : '';

    if (!cleanContent || cleanContent.length > 2000) {
      return;
    }

    const verifiedParticipantId = client.data?.userId || participantId;

    try {
      const updated = await this.roomsService.editChatMessage(cleanRoomId, messageId, verifiedParticipantId, cleanContent);
      if (updated) {
        this.server.to(cleanRoomId).emit(SocketEvents.CHAT_EDIT, {
          messageId: updated.id,
          content: updated.content,
          isEdited: updated.isEdited,
        });
      }
    } catch (err: any) {
      console.error(`Error editing chat message in room ${roomId}:`, err);
      client.emit(SocketEvents.ERROR, { message: err?.message || 'Failed to edit message' });
    }
  }

  @SubscribeMessage(SocketEvents.HOME_KNOCK)
  async handleHomeKnock(
    @MessageBody() payload: { targetUsername: string },
    @ConnectedSocket() client: Socket
  ) {
    const { targetUsername } = payload;
    const knockerId = client.data.userId;
    if (!knockerId) return;

    try {
      const targetUser = await this.prisma.user.findUnique({
        where: { username: targetUsername.toLowerCase().trim() },
      });
      if (!targetUser || !targetUser.homeRoomId) return;

      const knockerUser = await this.prisma.user.findUnique({ where: { id: knockerId } });
      if (!knockerUser) return;

      // Rate limit: check if a pending knock already exists within the last 60s
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      let knock = await this.prisma.homeKnock.findFirst({
        where: {
          homeRoomId: targetUser.homeRoomId,
          knockerId: knockerId,
          status: 'PENDING',
          knockedAt: { gte: oneMinuteAgo },
        },
      });

      if (!knock) {
        knock = await this.prisma.homeKnock.create({
          data: {
            homeRoomId: targetUser.homeRoomId,
            knockerId: knockerId,
            seenByOwner: false,
          },
        });
      }

      // Check active live socket connections for target user
      const targetSockets = await this.server.in(`user:${targetUser.id}`).fetchSockets();
      const isOnline = targetSockets.length > 0 || targetUser.isOnline;

      if (isOnline && targetSockets.length > 0) {
        this.server.to(`user:${targetUser.id}`).emit(SocketEvents.HOME_KNOCK_INCOMING, {
          knockId: knock.id,
          knocker: {
            userId: knockerUser.id,
            username: knockerUser.username,
            displayName: knockerUser.displayName || undefined,
            profilePicture: knockerUser.profilePicture || undefined,
          },
          knockedAt: knock.knockedAt.getTime(),
        });

        // Inform knocker that knock was sent and is awaiting response
        client.emit(SocketEvents.HOME_KNOCK_WAITING, {
          knockId: knock.id,
          offline: false,
        });
      } else {
        // Target is not online right now
        client.emit(SocketEvents.HOME_KNOCK_WAITING, {
          knockId: knock.id,
          offline: true,
        });
      }
    } catch (e) {
      console.error('Error handling home knock:', e);
    }
  }

  @SubscribeMessage(SocketEvents.HOME_KNOCK_RESPONSE)
  async handleHomeKnockResponse(
    @MessageBody() payload: { knockId: string; action: 'admit' | 'wait' },
    @ConnectedSocket() client: Socket
  ) {
    const { knockId, action } = payload;
    const ownerId = client.data.userId;
    if (!ownerId) return;

    try {
      const knock = await this.prisma.homeKnock.findUnique({
        where: { id: knockId },
      });
      if (!knock) return;

      const roomOwner = await this.prisma.user.findFirst({
        where: { homeRoomId: knock.homeRoomId },
      });
      if (!roomOwner || roomOwner.id !== ownerId) return;

      await this.prisma.homeKnock.update({
        where: { id: knockId },
        data: {
          status: action === 'admit' ? 'ADMITTED' : 'PENDING',
          respondedAt: new Date(),
          seenByOwner: true,
        },
      });

      if (action === 'admit') {
        this.server.to(`user:${knock.knockerId}`).emit(SocketEvents.HOME_KNOCK_ADMITTED, {
          knockId: knock.id,
          roomId: knock.homeRoomId,
        });
      } else {
        this.server.to(`user:${knock.knockerId}`).emit(SocketEvents.HOME_KNOCK_WAITING, {
          knockId: knock.id,
          offline: false,
        });
      }
    } catch (e) {
      console.error('Error handling knock response:', e);
    }
  }
}
