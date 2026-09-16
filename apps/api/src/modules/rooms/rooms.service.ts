import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Room, QueueItem } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  // Helper to generate a short, human-readable room code (e.g., UMI-7X4K)
  private generateRoomCode(): string {
    const chars1 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters (I, O, 0, 1)
    const chars2 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    
    let part1 = '';
    for (let i = 0; i < 3; i++) {
      part1 += chars1.charAt(Math.floor(Math.random() * chars1.length));
    }
    
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part2 += chars2.charAt(Math.floor(Math.random() * chars2.length));
    }
    
    return `${part1}-${part2}`;
  }

  async createRoom(): Promise<Room> {
    let roomId = this.generateRoomCode();
    
    // Ensure uniqueness
    let exists = await this.prisma.room.findUnique({ where: { id: roomId } });
    let attempts = 0;
    while (exists && attempts < 10) {
      roomId = this.generateRoomCode();
      exists = await this.prisma.room.findUnique({ where: { id: roomId } });
      attempts++;
    }

    return this.prisma.room.create({
      data: {
        id: roomId,
        isPlaying: false,
        position: 0.0,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
  }

  async getRoom(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        queue: {
          orderBy: {
            order: 'asc',
          },
        },
        chatMessages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 50,
          include: {
            reactions: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found.`);
    }

    // Reorder chat messages chronologically (oldest to newest)
    room.chatMessages.reverse();

    return room;
  }

  async getPaginatedMessages(roomId: string, beforeId?: string, limit = 50) {
    let whereClause: any = { roomId };

    if (beforeId) {
      const targetMsg = await this.prisma.chatMessage.findUnique({
        where: { id: beforeId },
      });
      if (targetMsg) {
        whereClause.createdAt = { lt: targetMsg.createdAt };
      }
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        reactions: true,
      },
    });

    return messages.reverse();
  }

  async updatePlaybackState(
    roomId: string,
    isPlaying: boolean,
    position: number,
    playbackStartedAt: Date | null,
    currentVideoId?: string | null,
    currentVideoTitle?: string | null,
    currentVideoThumbnail?: string | null
  ) {
    const data: any = {
      isPlaying,
      position,
      playbackStartedAt,
    };

    if (currentVideoId !== undefined) data.currentVideoId = currentVideoId;
    if (currentVideoTitle !== undefined) data.currentVideoTitle = currentVideoTitle;
    if (currentVideoThumbnail !== undefined) data.currentVideoThumbnail = currentVideoThumbnail;

    return this.prisma.room.update({
      where: { id: roomId },
      data,
    });
  }

  async addQueueItem(
    roomId: string,
    videoId: string,
    title: string,
    thumbnail: string,
    channelTitle: string,
    addedBy: string,
    duration?: number
  ) {
    return this.prisma.$transaction(async (tx) => {
      const lastItem = await tx.queueItem.findFirst({
        where: { roomId },
        orderBy: { order: 'desc' },
      });
      const nextOrder = lastItem ? lastItem.order + 1 : 0;

      return tx.queueItem.create({
        data: {
          roomId,
          videoId,
          title,
          thumbnail,
          channelTitle,
          addedBy,
          duration,
          order: nextOrder,
        },
      });
    });
  }

  async removeQueueItem(roomId: string, itemId: string) {
    return this.prisma.queueItem.delete({
      where: {
        id: itemId,
        roomId, // Ensure it belongs to the room
      },
    });
  }

  async clearQueue(roomId: string) {
    return this.prisma.queueItem.deleteMany({
      where: { roomId },
    });
  }

  async updateQueueOrder(roomId: string, items: { id: string; order: number }[]) {
    // Perform bulk updates in transaction
    return this.prisma.$transaction(
      items.map((item) =>
        this.prisma.queueItem.update({
          where: { id: item.id, roomId },
          data: { order: item.order },
        })
      )
    );
  }

  async createChatMessage(
    roomId: string,
    senderId: string,
    senderName: string,
    content: string,
    senderAvatar?: string | null,
    replyToId?: string | null,
    replyToSenderName?: string | null,
    replyToContent?: string | null,
    isDelivered: boolean = false
  ) {
    return this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        senderName,
        senderAvatar: senderAvatar || null,
        content,
        replyToId: replyToId || null,
        replyToSenderName: replyToSenderName || null,
        replyToContent: replyToContent || null,
        isDelivered,
        isRead: false,
      },
      include: {
        reactions: true,
      },
    });
  }

  async markMessagesAsRead(roomId: string, readerParticipantId: string, messageIds?: string[]) {
    const whereClause: any = {
      roomId,
      senderId: { not: readerParticipantId },
      isRead: false,
    };
    if (messageIds && messageIds.length > 0) {
      whereClause.id = { in: messageIds };
    }

    await this.prisma.chatMessage.updateMany({
      where: whereClause,
      data: {
        isRead: true,
        isDelivered: true,
      },
    });

    return { roomId, readerParticipantId };
  }

  async toggleReaction(
    roomId: string,
    messageId: string,
    participantId: string,
    displayName: string,
    emoji: string
  ) {
    const existing = await this.prisma.chatMessageReaction.findUnique({
      where: {
        messageId_participantId: {
          messageId,
          participantId,
        },
      },
    });

    if (existing) {
      if (existing.emoji === emoji) {
        await this.prisma.chatMessageReaction.delete({
          where: { id: existing.id },
        });
      } else {
        await this.prisma.chatMessageReaction.update({
          where: { id: existing.id },
          data: { emoji, displayName },
        });
      }
    } else {
      await this.prisma.chatMessageReaction.create({
        data: {
          messageId,
          participantId,
          displayName,
          emoji,
        },
      });
    }

    const updatedReactions = await this.prisma.chatMessageReaction.findMany({
      where: { messageId },
    });

    return {
      messageId,
      reactions: updatedReactions,
    };
  }

  async deleteChatMessage(roomId: string, messageId: string, participantId: string) {
    const msg = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!msg || msg.roomId !== roomId || msg.senderId !== participantId) {
      return null;
    }

    await this.prisma.chatMessage.delete({
      where: { id: messageId },
    });

    return { messageId };
  }

  async editChatMessage(
    roomId: string,
    messageId: string,
    participantId: string,
    newContent: string
  ) {
    const msg = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!msg || msg.roomId !== roomId || msg.senderId !== participantId) {
      throw new Error('Message not found or unauthorized');
    }

    const elapsedMs = Date.now() - new Date(msg.createdAt).getTime();
    const TWO_MINUTES_MS = 2 * 60 * 1000;
    if (elapsedMs > TWO_MINUTES_MS) {
      throw new Error('Message can only be edited within 2 minutes of sending.');
    }

    const updated = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        content: newContent,
        isEdited: true,
      },
    });

    return updated;
  }

  async createPermanentRoom(roomName: string): Promise<Room> {
    let roomId = this.generateRoomCode();
    
    let exists = await this.prisma.room.findUnique({ where: { id: roomId } });
    let attempts = 0;
    while (exists && attempts < 10) {
      roomId = this.generateRoomCode();
      exists = await this.prisma.room.findUnique({ where: { id: roomId } });
      attempts++;
    }

    return this.prisma.room.create({
      data: {
        id: roomId,
        name: roomName,
        isPlaying: false,
        position: 0.0,
        isPermanent: true,
        expiresAt: null,
      },
    });
  }

  async logIp(roomId: string, ipAddress: string, userId?: string) {
    return this.prisma.roomIpLog.create({
      data: {
        roomId,
        ipAddress,
        userId: userId || null,
      }
    });
  }

  async logVideoPlay(roomId: string, videoId: string, title: string, thumbnail: string, playedById?: string) {
    return this.prisma.roomVideoHistory.create({
      data: {
        roomId,
        videoId,
        title,
        thumbnail,
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        playedById: playedById || null,
      }
    });
  }

  async startActivity(roomId: string, userId: string): Promise<string> {
    const log = await this.prisma.roomActivityLog.create({
      data: {
        roomId,
        userId,
        joinedAt: new Date(),
      }
    });
    return log.id;
  }

  async endActivity(activityLogId: string) {
    const log = await this.prisma.roomActivityLog.findUnique({ where: { id: activityLogId } });
    if (!log || log.leftAt) return;
    
    const leftAt = new Date();
    const durationSeconds = Math.floor((leftAt.getTime() - log.joinedAt.getTime()) / 1000);
    
    return this.prisma.roomActivityLog.update({
      where: { id: activityLogId },
      data: {
        leftAt,
        durationSeconds,
      }
    });
  }

  async deleteExpiredRooms() {
    return this.prisma.room.deleteMany({
      where: {
        isPermanent: false,
        expiresAt: {
          lte: new Date()
        }
      }
    });
  }

  async cleanOldChatMessages() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.prisma.chatMessage.deleteMany({
      where: {
        createdAt: {
          lte: thirtyDaysAgo
        },
        room: {
          isPermanent: true
        }
      }
    });
  }
}
