import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() body: any) {
    const { username, password, gender } = body;
    return this.authService.signup(username, password, gender);
  }

  @Post('login')
  async login(@Body() body: any) {
    const { username, password } = body;
    return this.authService.login(username, password);
  }

  @Post('profile')
  async updateProfile(@Headers('authorization') authHeader: string, @Body() body: any) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token) {
      throw new UnauthorizedException('Authentication token is required.');
    }
    const decoded = this.authService.verifyToken(token);
    const { displayName, profilePicture, bio, profileBanner, gender, isPrivate } = body;
    return this.authService.updateProfile(decoded.userId, displayName, profilePicture, bio, profileBanner, gender, isPrivate);
  }
}
