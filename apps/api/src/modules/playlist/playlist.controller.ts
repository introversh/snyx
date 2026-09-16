import { Controller, Get, Post, Put, Delete, Param, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { AuthService } from '../auth/auth.service';

@Controller('playlists')
export class PlaylistController {
  constructor(
    private readonly playlistService: PlaylistService,
    private readonly authService: AuthService
  ) {}

  private extractUserId(authHeader?: string): string {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token) throw new UnauthorizedException('Missing token');
    const decoded = this.authService.verifyToken(token);
    return decoded.userId;
  }

  private extractUserIdOptional(authHeader?: string): string | null {
    if (!authHeader) return null;
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token) return null;
    try {
      const decoded = this.authService.verifyToken(token);
      return decoded.userId || null;
    } catch {
      return null;
    }
  }

  @Post()
  async createPlaylist(
    @Headers('authorization') authHeader: string,
    @Body() body: { name: string; description?: string; isPrivate?: boolean }
  ) {
    const userId = this.extractUserId(authHeader);
    return this.playlistService.createPlaylist(userId, body.name, body.description, Boolean(body.isPrivate));
  }

  @Get('user/:userId')
  async getUserPlaylists(
    @Param('userId') userId: string,
    @Headers('authorization') authHeader?: string
  ) {
    const requestingUserId = this.extractUserIdOptional(authHeader);
    return this.playlistService.getUserPlaylists(userId, requestingUserId);
  }

  @Get(':id')
  async getPlaylist(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string
  ) {
    const requestingUserId = this.extractUserIdOptional(authHeader);
    return this.playlistService.getPlaylist(id, requestingUserId);
  }

  @Put(':id')
  async updatePlaylist(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Body() body: { name?: string; description?: string; isPrivate?: boolean }
  ) {
    const userId = this.extractUserId(authHeader);
    return this.playlistService.updatePlaylist(id, userId, body.name, body.description, body.isPrivate);
  }

  @Delete(':id')
  async deletePlaylist(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string
  ) {
    const userId = this.extractUserId(authHeader);
    return this.playlistService.deletePlaylist(id, userId);
  }

  @Post(':id/items')
  async addItem(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Body() body: { videoId: string; title: string; thumbnail: string; sourceUrl: string; duration?: number }
  ) {
    const userId = this.extractUserId(authHeader);
    return this.playlistService.addItem(id, userId, body.videoId, body.title, body.thumbnail, body.sourceUrl, body.duration);
  }

  @Delete(':id/items/:itemId')
  async removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Headers('authorization') authHeader: string
  ) {
    const userId = this.extractUserId(authHeader);
    return this.playlistService.removeItem(id, itemId, userId);
  }

  @Put(':id/items/reorder')
  async reorderItems(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Body() body: { items: { id: string; order: number }[] }
  ) {
    const userId = this.extractUserId(authHeader);
    return this.playlistService.reorderItems(id, userId, body.items);
  }
}
