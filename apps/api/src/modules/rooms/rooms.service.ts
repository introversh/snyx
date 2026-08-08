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
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found.`);
    }

    return room;
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
    // Get last order
    const lastItem = await this.prisma.queueItem.findFirst({
      where: { roomId },
      orderBy: { order: 'desc' },
    });
    const nextOrder = lastItem ? lastItem.order + 1 : 0;

    return this.prisma.queueItem.create({
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
}
