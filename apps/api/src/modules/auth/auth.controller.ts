import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    const { username, password, gender } = signupDto;
    return this.authService.signup(username, password, gender);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const { username, password } = loginDto;
    return this.authService.login(username, password);
  }

  @Post('profile')
  async updateProfile(@Headers('authorization') authHeader: string, @Body() updateProfileDto: UpdateProfileDto) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token) {
      throw new UnauthorizedException('Authentication token is required.');
    }
    const decoded = this.authService.verifyToken(token);
    return this.authService.updateProfile(decoded.userId, updateProfileDto);
  }
}
