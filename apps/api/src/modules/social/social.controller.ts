import { Controller, Get, Post, Delete, Body, Param, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { SocialService } from './social.service';
import { AuthService } from '../auth/auth.service';

@Controller('social')
export class SocialController {
  constructor(
    private socialService: SocialService,
    private authService: AuthService
  ) {}

  private verifyToken(authHeader: string) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token) {
      throw new UnauthorizedException('Authentication token is required.');
    }
    return this.authService.verifyToken(token);
  }

  @Get('users')
  async searchUsers(@Headers('authorization') auth: string, @Query('q') query: string) {
    const user = this.verifyToken(auth);
    return this.socialService.searchUsers(user.userId, query || '');
  }

  @Get('profile/:userId')
  async getUserProfile(@Headers('authorization') auth: string, @Param('userId') userId: string) {
    const user = this.verifyToken(auth);
    return this.socialService.getUserProfile(user.userId, userId);
  }

  @Get('profile/username/:username')
  async getUserProfileByUsername(@Headers('authorization') auth: string, @Param('username') username: string) {
    const user = this.verifyToken(auth);
    return this.socialService.getUserProfileByUsername(user.userId, username);
  }

  // Friend Request Endpoints
  @Post('friend-request/send/:userId')
  async sendFriendRequest(@Headers('authorization') auth: string, @Param('userId') userId: string) {
    const user = this.verifyToken(auth);
    return this.socialService.sendFriendRequest(user.userId, userId);
  }

  @Post('friend-request/accept/:userId')
  async acceptFriendRequest(@Headers('authorization') auth: string, @Param('userId') userId: string) {
    const user = this.verifyToken(auth);
    return this.socialService.acceptFriendRequest(user.userId, userId);
  }

  @Post('friend-request/decline/:userId')
  async declineFriendRequest(@Headers('authorization') auth: string, @Param('userId') userId: string) {
    const user = this.verifyToken(auth);
    return this.socialService.declineFriendRequest(user.userId, userId);
  }

  @Post('friend-request/cancel/:userId')
  async cancelFriendRequest(@Headers('authorization') auth: string, @Param('userId') userId: string) {
    const user = this.verifyToken(auth);
    return this.socialService.cancelFriendRequest(user.userId, userId);
  }

  @Post('friend-request/unfriend/:userId')
  async removeFriend(@Headers('authorization') auth: string, @Param('userId') userId: string) {
    const user = this.verifyToken(auth);
    return this.socialService.removeFriend(user.userId, userId);
  }

  @Get('friend-requests')
  async listIncomingFriendRequests(@Headers('authorization') auth: string) {
    const user = this.verifyToken(auth);
    return this.socialService.listIncomingFriendRequests(user.userId);
  }

  @Get('friends')
  async listFriends(@Headers('authorization') auth: string) {
    const user = this.verifyToken(auth);
    return this.socialService.listFriends(user.userId);
  }

  @Get('friends/:userId')
  async listUserFriends(@Headers('authorization') auth: string, @Param('userId') userId: string) {
    const user = this.verifyToken(auth);
    return this.socialService.listUserFriends(user.userId, userId);
  }

  @Get('dms')
  async getInbox(@Headers('authorization') auth: string) {
    const user = this.verifyToken(auth);
    return this.socialService.getInbox(user.userId);
  }

  @Get('dms/:userId')
  async getDirectMessages(@Headers('authorization') auth: string, @Param('userId') otherUserId: string) {
    const user = this.verifyToken(auth);
    return this.socialService.getDirectMessages(user.userId, otherUserId);
  }

  @Post('dms/:userId')
  async sendDirectMessage(
    @Headers('authorization') auth: string,
    @Param('userId') receiverId: string,
    @Body('content') content: string
  ) {
    const user = this.verifyToken(auth);
    return this.socialService.sendDirectMessage(user.userId, receiverId, content);
  }

  @Post('invites/:userId')
  async createRoomInvite(
    @Headers('authorization') auth: string,
    @Param('userId') receiverId: string,
    @Body('roomId') roomId: string
  ) {
    const user = this.verifyToken(auth);
    return this.socialService.createRoomInvite(user.userId, receiverId, roomId);
  }

  @Get('invites')
  async getReceivedInvites(@Headers('authorization') auth: string) {
    const user = this.verifyToken(auth);
    return this.socialService.getReceivedInvites(user.userId);
  }

  @Delete('invites/:inviteId')
  async declineInvite(@Headers('authorization') auth: string, @Param('inviteId') inviteId: string) {
    const user = this.verifyToken(auth);
    return this.socialService.declineInvite(user.userId, inviteId);
  }
}
