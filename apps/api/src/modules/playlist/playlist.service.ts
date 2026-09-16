import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PlaylistService {
  constructor(private prisma: PrismaService) {}

  async createPlaylist(userId: string, name: string, description?: string, isPrivate: boolean = false) {
    return this.prisma.playlist.create({
      data: {
        userId,
        name,
        description,
        isPrivate,
      },
    });
  }

  async getUserPlaylists(userId: string, requestingUserId?: string | null) {
    const isOwner = requestingUserId === userId;
    return this.prisma.playlist.findMany({
      where: {
        userId,
        ...(isOwner ? {} : { isPrivate: false }),
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async getPlaylist(playlistId: string, requestingUserId?: string | null) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');

    if (playlist.isPrivate && playlist.userId !== requestingUserId) {
      throw new UnauthorizedException('This playlist is private');
    }

    return playlist;
  }

  async updatePlaylist(playlistId: string, userId: string, name?: string, description?: string, isPrivate?: boolean) {
    const playlist = await this.getPlaylist(playlistId, userId);
    if (playlist.userId !== userId) throw new UnauthorizedException('Not authorized');

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate;

    return this.prisma.playlist.update({
      where: { id: playlistId },
      data: updateData,
    });
  }

  async deletePlaylist(playlistId: string, userId: string) {
    const playlist = await this.getPlaylist(playlistId, userId);
    if (playlist.userId !== userId) throw new UnauthorizedException('Not authorized');

    return this.prisma.playlist.delete({
      where: { id: playlistId },
    });
  }

  async addItem(playlistId: string, userId: string, videoId: string, title: string, thumbnail: string, sourceUrl: string, duration?: number) {
    const playlist = await this.getPlaylist(playlistId, userId);
    if (playlist.userId !== userId) throw new UnauthorizedException('Not authorized');

    const lastItem = await this.prisma.playlistItem.findFirst({
      where: { playlistId },
      orderBy: { order: 'desc' },
    });
    const order = lastItem ? lastItem.order + 1 : 0;

    return this.prisma.playlistItem.create({
      data: {
        playlistId,
        videoId,
        title,
        thumbnail,
        sourceUrl,
        duration,
        order,
      },
    });
  }

  async removeItem(playlistId: string, itemId: string, userId: string) {
    const playlist = await this.getPlaylist(playlistId, userId);
    if (playlist.userId !== userId) throw new UnauthorizedException('Not authorized');

    return this.prisma.playlistItem.delete({
      where: { id: itemId },
    });
  }

  async reorderItems(playlistId: string, userId: string, items: { id: string; order: number }[]) {
    const playlist = await this.getPlaylist(playlistId, userId);
    if (playlist.userId !== userId) throw new UnauthorizedException('Not authorized');

    return this.prisma.$transaction(
      items.map(item =>
        this.prisma.playlistItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );
  }
}
