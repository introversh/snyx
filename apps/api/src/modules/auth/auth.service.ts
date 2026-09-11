import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'snyx_secret_jwt_key_123';

  constructor(private prisma: PrismaService) {}

  private readonly reservedUsernames = new Set([
    'room', 'auth', 'social', 'youtube', 'api', 'admin', 'administrator',
    'login', 'signup', 'settings', 'profile', 'null', 'undefined', 'static', 'assets', 'system'
  ]);

  async signup(username: string, password: string, gender?: string) {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      throw new UnauthorizedException('Username and password are required.');
    }

    if (this.reservedUsernames.has(cleanUsername)) {
      throw new ConflictException('This username is reserved and cannot be registered.');
    }

    // Check if user already exists
    const exists = await this.prisma.user.findUnique({
      where: { username: cleanUsername },
    });
    if (exists) {
      throw new ConflictException('Username is already taken.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const validatedGender = gender || 'male';

    // Create user
    const user = await this.prisma.user.create({
      data: {
        username: cleanUsername,
        password: hashedPassword,
        gender: validatedGender,
      },
    });

    const token = this.generateToken(user.id, user.username);

    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName || undefined,
      profilePicture: user.profilePicture || undefined,
      bio: user.bio || undefined,
      profileBanner: user.profileBanner || undefined,
      gender: user.gender,
      isPrivate: user.isPrivate,
      token,
    };
  }

  async login(username: string, password: string) {
    const cleanUsername = username.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const token = this.generateToken(user.id, user.username);

    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName || undefined,
      profilePicture: user.profilePicture || undefined,
      bio: user.bio || undefined,
      profileBanner: user.profileBanner || undefined,
      gender: user.gender,
      isPrivate: user.isPrivate,
      token,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { displayName, profilePicture, bio, profileBanner, gender, isPrivate } = dto;
    const data: any = {};
    if (displayName !== undefined) data.displayName = displayName ? displayName.trim() : null;
    if (profilePicture !== undefined) data.profilePicture = profilePicture ? profilePicture.trim() : null;
    if (bio !== undefined) data.bio = bio ? bio.trim() : "";
    if (profileBanner !== undefined) data.profileBanner = profileBanner ? profileBanner.trim() : "";
    if (gender !== undefined) data.gender = gender || "male";
    if (isPrivate !== undefined) data.isPrivate = Boolean(isPrivate);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName || undefined,
      profilePicture: user.profilePicture || undefined,
      bio: user.bio || undefined,
      profileBanner: user.profileBanner || undefined,
      gender: user.gender,
      isPrivate: user.isPrivate,
    };
  }

  verifyToken(token: string): any {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  private generateToken(userId: string, username: string): string {
    return jwt.sign(
      { userId, username },
      this.jwtSecret,
      { expiresIn: '30d' }
    );
  }
}
