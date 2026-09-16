import { Controller, Post, Body, Headers, UnauthorizedException, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    const { username, password, gender, displayName, profilePicture } = signupDto;
    return this.authService.signup(username, password, gender, displayName, profilePicture);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const { username, password } = loginDto;
    return this.authService.login(username, password);
  }

  @Post('profile')
  async updateProfile(@Headers('authorization') authHeader: string, @Body() updateProfileDto: UpdateProfileDto) {
    const token = this.extractToken(authHeader);
    const decoded = this.authService.verifyToken(token);
    return this.authService.updateProfile(decoded.userId, updateProfileDto);
  }

  @Post('logout')
  async logout(@Headers('authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    const decoded = this.authService.verifyToken(token);
    await this.authService.logout(decoded.userId);
    return { success: true };
  }

  @Post('active-status')
  async updateActiveStatus(@Headers('authorization') authHeader: string, @Body() body: { showActiveStatus: boolean }) {
    const token = this.extractToken(authHeader);
    const decoded = this.authService.verifyToken(token);
    await this.authService.updateActiveStatus(decoded.userId, body.showActiveStatus);
    return { success: true };
  }

  @Get('missed-knocks')
  async getMissedKnocks(@Headers('authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    const decoded = this.authService.verifyToken(token);
    return this.authService.getMissedKnocks(decoded.userId);
  }

  private extractToken(authHeader?: string): string {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token) {
      throw new UnauthorizedException('Authentication token is required.');
    }
    return token;
  }
}
