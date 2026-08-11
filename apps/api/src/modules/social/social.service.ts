import { Injectable, ConflictException, NotFoundException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class SocialService {
  constructor(private prisma: PrismaService) {}

  // Helper to determine mutual friend status
  async getFriendStatus(userAId: string, userBId: string): Promise<string> {
    if (userAId === userBId) return 'SELF';

    const u1 = userAId < userBId ? userAId : userBId;
    const u2 = userAId < userBId ? userAId : userAId;

    // 1. Check if already mutual friends
    const friendship = await this.prisma.friendship.findFirst({
      where: { user1Id: u1, user2Id: u2 },
    });
    if (friendship) return 'FRIENDS';

    // 2. Check if userA sent pending request to userB
    const sentReq = await this.prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: userAId,
          receiverId: userBId,
        },
      },
    });
    if (sentReq && sentReq.status === 'PENDING') return 'SENT_PENDING';

    // 3. Check if userB sent pending request to userA
    const receivedReq = await this.prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: userBId,
          receiverId: userAId,
        },
      },
    });
    if (receivedReq && receivedReq.status === 'PENDING') return 'RECEIVED_PENDING';

    return 'NONE';
  }

  // Count total mutual friends of a user
  async getFriendsCount(userId: string): Promise<number> {
    return this.prisma.friendship.count({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
    });
  }

  // Search users in sNyx database
  async searchUsers(currentUserId: string, query: string) {
    const cleanQuery = query.trim().toLowerCase();
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          {
            OR: [
              { username: { contains: cleanQuery, mode: 'insensitive' } },
              { displayName: { contains: cleanQuery, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePicture: true,
        gender: true,
        isPrivate: true,
        bio: true,
      },
      take: 20,
    });

    return Promise.all(
      users.map(async (u) => {
        const friendStatus = await this.getFriendStatus(currentUserId, u.id);
        return { ...u, friendStatus };
      })
    );
  }

  // Get single profile with friend stats
  async getUserProfile(currentUserId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePicture: true,
        profileBanner: true,
        bio: true,
        gender: true,
        isPrivate: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    const friendsCount = await this.getFriendsCount(userId);
    const friendStatus = await this.getFriendStatus(currentUserId, userId);

    return {
      ...user,
      friendsCount,
      friendStatus,
    };
  }

  // Get user profile by username with stats
  async getUserProfileByUsername(currentUserId: string, username: string) {
    const cleanUsername = username.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: cleanUsername, mode: 'insensitive' },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePicture: true,
        profileBanner: true,
        bio: true,
        gender: true,
        isPrivate: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User @${username} not found.`);
    }

    const friendsCount = await this.getFriendsCount(user.id);
    const friendStatus = await this.getFriendStatus(currentUserId, user.id);

    return {
      ...user,
      friendsCount,
      friendStatus,
    };
  }

  // Send friend request
  async sendFriendRequest(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new ConflictException('Cannot send friend request to yourself.');
    }

    const status = await this.getFriendStatus(currentUserId, targetUserId);
    if (status === 'FRIENDS') {
      throw new ConflictException('You are already friends.');
    }

    await this.prisma.friendRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId: currentUserId,
          receiverId: targetUserId,
        },
      },
      update: { status: 'PENDING' },
      create: {
        senderId: currentUserId,
        receiverId: targetUserId,
        status: 'PENDING',
      },
    });

    return { friendStatus: 'SENT_PENDING' };
  }

  // Accept friend request
  async acceptFriendRequest(currentUserId: string, senderUserId: string) {
    const req = await this.prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: senderUserId,
          receiverId: currentUserId,
        },
      },
    });

    if (!req || req.status !== 'PENDING') {
      throw new NotFoundException('No pending friend request found.');
    }

    await this.prisma.friendRequest.update({
      where: { id: req.id },
      data: { status: 'ACCEPTED' },
    });

    const u1 = senderUserId < currentUserId ? senderUserId : currentUserId;
    const u2 = senderUserId < currentUserId ? currentUserId : senderUserId;

    await this.prisma.friendship.upsert({
      where: {
        user1Id_user2Id: {
          user1Id: u1,
          user2Id: u2,
        },
      },
      update: {},
      create: {
        user1Id: u1,
        user2Id: u2,
      },
    });

    return { friendStatus: 'FRIENDS' };
  }

  // Decline friend request
  async declineFriendRequest(currentUserId: string, senderUserId: string) {
    await this.prisma.friendRequest.deleteMany({
      where: {
        senderId: senderUserId,
        receiverId: currentUserId,
      },
    });
    return { friendStatus: 'NONE' };
  }

  // Cancel sent friend request
  async cancelFriendRequest(currentUserId: string, targetUserId: string) {
    await this.prisma.friendRequest.deleteMany({
      where: {
        senderId: currentUserId,
        receiverId: targetUserId,
      },
    });
    return { friendStatus: 'NONE' };
  }

  // Remove friend (unfriend)
  async removeFriend(currentUserId: string, targetUserId: string) {
    const u1 = currentUserId < targetUserId ? currentUserId : targetUserId;
    const u2 = currentUserId < targetUserId ? targetUserId : currentUserId;

    await this.prisma.friendship.deleteMany({
      where: { user1Id: u1, user2Id: u2 },
    });

    await this.prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
    });

    return { friendStatus: 'NONE' };
  }

  // List incoming pending friend requests for user
  async listIncomingFriendRequests(currentUserId: string) {
    const requests = await this.prisma.friendRequest.findMany({
      where: {
        receiverId: currentUserId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePicture: true,
            gender: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => ({
      requestId: r.id,
      createdAt: r.createdAt,
      sender: r.sender,
    }));
  }

  // List online/offline mutual friends
  async listFriends(currentUserId: string) {
    return this.listUserFriends(currentUserId, currentUserId);
  }

  // List friends of a specific user profile (with privacy checks)
  async listUserFriends(currentUserId: string, targetUserId: string) {
    if (currentUserId !== targetUserId) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, isPrivate: true },
      });

      if (targetUser && targetUser.isPrivate) {
        const friendStatus = await this.getFriendStatus(currentUserId, targetUserId);
        if (friendStatus !== 'FRIENDS') {
          throw new ForbiddenException('This account is private. Only mutual friends can view their friends list.');
        }
      }
    }

    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: targetUserId },
          { user2Id: targetUserId },
        ],
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePicture: true,
            gender: true,
            bio: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePicture: true,
            gender: true,
            bio: true,
          },
        },
      },
    });

    return friendships.map((f) => (f.user1Id === targetUserId ? f.user2 : f.user1));
  }

  // Get active conversations list (Inbox)
  async getInbox(currentUserId: string) {
    const messages = await this.prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: currentUserId }, { receiverId: currentUserId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, profilePicture: true, gender: true },
        },
        receiver: {
          select: { id: true, username: true, displayName: true, profilePicture: true, gender: true },
        },
      },
    });

    const conversationsMap = new Map<string, any>();

    for (const msg of messages) {
      const otherUser = msg.senderId === currentUserId ? msg.receiver : msg.sender;
      if (!conversationsMap.has(otherUser.id)) {
        conversationsMap.set(otherUser.id, {
          user: otherUser,
          lastMessage: msg.content,
          createdAt: msg.createdAt,
        });
      }
    }

    return Array.from(conversationsMap.values());
  }

  // Get chat log with specific user
  async getDirectMessages(currentUserId: string, otherUserId: string) {
    return this.prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Send a private direct message
  async sendDirectMessage(senderId: string, receiverId: string, content: string) {
    if (!content.trim()) {
      throw new ConflictException('Message content cannot be empty.');
    }
    return this.prisma.directMessage.create({
      data: {
        senderId,
        receiverId,
        content: content.trim(),
      },
    });
  }

  // Send watchroom invitation
  async createRoomInvite(senderId: string, receiverId: string, roomId: string) {
    return this.prisma.roomInvite.create({
      data: {
        senderId,
        receiverId,
        roomId,
      },
    });
  }

  // List watchroom invitations for current user
  async getReceivedInvites(currentUserId: string) {
    return this.prisma.roomInvite.findMany({
      where: { receiverId: currentUserId },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, profilePicture: true, gender: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Decline watchroom invite
  async declineInvite(currentUserId: string, inviteId: string) {
    return this.prisma.roomInvite.deleteMany({
      where: {
        id: inviteId,
        receiverId: currentUserId,
      },
    });
  }
}
