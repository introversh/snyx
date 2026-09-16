import re

with open('src/modules/rooms/rooms.gateway.ts', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace('OnGatewayDisconnect,', 'OnGatewayDisconnect, OnGatewayConnection,')
if 'OnGatewayConnection' not in content:
    content = content.replace('OnGatewayDisconnect', 'OnGatewayDisconnect, OnGatewayConnection')

# 2. Add implements OnGatewayConnection
content = content.replace('implements OnGatewayDisconnect', 'implements OnGatewayDisconnect, OnGatewayConnection')

# 3. Add userSockets
user_sockets_code = '''
  // roomId -> participantId -> RoomUser & { socketId: string }
  private presence = new Map<string, Map<string, RoomUser & { socketId: string }>>();
  
  // userId -> socketId
  private userSockets = new Map<string, string>();
'''
content = content.replace('  private presence = new Map<string, Map<string, RoomUser & { socketId: string }>>();', user_sockets_code)

# 4. handleConnection
handle_connection_code = '''
  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    if (token) {
      try {
        const decoded = this.authService.verifyToken(token);
        const isValid = await this.authService.validateActiveToken(decoded.userId, token);
        if (!isValid) {
          client.emit(SocketEvents.SESSION_FORCE_LOGOUT);
          client.disconnect();
          return;
        }
        this.userSockets.set(decoded.userId, client.id);
        client.data.userId = decoded.userId;
      } catch (e) {
        client.emit(SocketEvents.SESSION_FORCE_LOGOUT);
        client.disconnect();
      }
    }
  }

  async handleDisconnect(client: Socket) {'''
content = content.replace('  async handleDisconnect(client: Socket) {', handle_connection_code)

# 5. handleDisconnect body updates
handle_disconnect_update = '''  async handleDisconnect(client: Socket) {
    if (client.data.activityLogId) {
      await this.roomsService.endActivity(client.data.activityLogId);
    }
    if (client.data.userId) {
      this.userSockets.delete(client.data.userId);
      await this.authService.logout(client.data.userId);
    }'''
content = content.replace('  async handleDisconnect(client: Socket) {', handle_disconnect_update)

# 6. handleJoin
handle_join_find = '''    this.presence.set(cleanRoomId, roomUsers);

    // Broadcast updated room state'''
handle_join_replace = '''    this.presence.set(cleanRoomId, roomUsers);

    // Logging IP and Activity
    const ipAddress = client.handshake.headers['x-forwarded-for'] || client.handshake.address;
    const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;
    await this.roomsService.logIp(cleanRoomId, ipStr, verifiedParticipantId);
    const activityLogId = await this.roomsService.startActivity(cleanRoomId, verifiedParticipantId);
    client.data.activityLogId = activityLogId;

    // Broadcast updated room state'''
content = content.replace(handle_join_find, handle_join_replace)

# 7. handleLeave
handle_leave_find = '''    if (roomUsers) {
      roomUsers.delete(verifiedParticipantId);'''
handle_leave_replace = '''    if (client.data.activityLogId) {
      await this.roomsService.endActivity(client.data.activityLogId);
      delete client.data.activityLogId;
    }
    if (roomUsers) {
      roomUsers.delete(verifiedParticipantId);'''
content = content.replace(handle_leave_find, handle_leave_replace)

# 8. handleLoad
handle_load_find = '''    try {
      await this.roomsService.updatePlaybackState(
        cleanRoomId,
        true, // Play when new video is loaded
        0.0,
        new Date(),
        videoId,
        title,
        thumbnail
      );
      await this.broadcastRoomState(cleanRoomId);'''
handle_load_replace = '''    try {
      await this.roomsService.updatePlaybackState(
        cleanRoomId,
        true, // Play when new video is loaded
        0.0,
        new Date(),
        videoId,
        title,
        thumbnail
      );
      
      const verifiedSenderId = client.data?.userId;
      await this.roomsService.logVideoPlay(cleanRoomId, videoId, title, thumbnail, verifiedSenderId);
      
      await this.broadcastRoomState(cleanRoomId);'''
content = content.replace(handle_load_find, handle_load_replace)

# 9. broadcastRoomState
broadcast_find = '''      const state: RoomState = {
        roomId: dbRoom.id,
        currentVideoId: dbRoom.currentVideoId,
        currentVideoTitle: dbRoom.currentVideoTitle,
        currentVideoThumbnail: dbRoom.currentVideoThumbnail,
        isPlaying: dbRoom.isPlaying,
        position: dbRoom.position,
        playbackStartedAt: dbRoom.playbackStartedAt ? dbRoom.playbackStartedAt.getTime() : null,
        serverTime: Date.now(),
        queue: dbRoom.queue.map((item: any) => ({'''
broadcast_replace = '''      const state: RoomState = {
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
        queue: dbRoom.queue.map((item: any) => ({'''
content = content.replace(broadcast_find, broadcast_replace)

# 10. knock events
knock_events_code = '''
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
        include: { homeRoom: true },
      });
      if (!targetUser || !targetUser.homeRoomId) return;

      const knockerUser = await this.prisma.user.findUnique({ where: { id: knockerId } });
      if (!knockerUser) return;

      const knock = await this.prisma.homeKnock.create({
        data: {
          homeRoomId: targetUser.homeRoomId,
          knockerId: knockerId,
        },
      });

      if (targetUser.isOnline) {
        const targetSocketId = this.userSockets.get(targetUser.id);
        if (targetSocketId) {
          this.server.to(targetSocketId).emit(SocketEvents.HOME_KNOCK_INCOMING, {
            knockId: knock.id,
            knocker: {
              userId: knockerUser.id,
              username: knockerUser.username,
              displayName: knockerUser.displayName || undefined,
              profilePicture: knockerUser.profilePicture || undefined,
            },
            knockedAt: knock.knockedAt.getTime(),
          });
        }
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
        include: { homeRoom: { include: { homeOwner: true } } },
      });
      // Need to find owner of homeRoom since relation is on User.homeRoom
      // Let's query user whose homeRoomId is knock.homeRoomId
      const roomOwner = await this.prisma.user.findFirst({
        where: { homeRoomId: knock.homeRoomId }
      });
      
      if (!knock || !roomOwner || roomOwner.id !== ownerId) return;

      await this.prisma.homeKnock.update({
        where: { id: knockId },
        data: {
          status: action === 'admit' ? 'ADMITTED' : 'PENDING',
          respondedAt: new Date(),
          seenByOwner: true,
        },
      });

      const knockerSocketId = this.userSockets.get(knock.knockerId);
      if (knockerSocketId) {
        if (action === 'admit') {
          this.server.to(knockerSocketId).emit(SocketEvents.HOME_KNOCK_ADMITTED, {
            knockId: knock.id,
            roomId: knock.homeRoomId,
          });
        } else {
          this.server.to(knockerSocketId).emit(SocketEvents.HOME_KNOCK_WAITING, {
            knockId: knock.id,
          });
        }
      }
    } catch (e) {
      console.error('Error handling knock response:', e);
    }
  }
}
'''

content = content.rsplit('}', 1)[0] + knock_events_code

if 'PrismaService' not in content:
    content = content.replace("import { RoomsService } from './rooms.service';", "import { PrismaService } from '../../prisma.service';\nimport { RoomsService } from './rooms.service';")
    content = content.replace("private authService: AuthService", "private authService: AuthService,\n    private prisma: PrismaService")

with open('src/modules/rooms/rooms.gateway.ts', 'w') as f:
    f.write(content)
