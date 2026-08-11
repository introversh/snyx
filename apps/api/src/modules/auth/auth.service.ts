import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'snyx_secret_jwt_key_123';

  constructor(private prisma: PrismaService) {}

  async signup(username: string, password: string, gender?: string) {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      throw new UnauthorizedException('Username and password are required.');
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

  async updateProfile(
    userId: string,
    displayName: string,
    profilePicture: string,
    bio?: string,
    profileBanner?: string,
    gender?: string,
    isPrivate?: boolean
  ) {
    const data: any = {};
    if (displayName !== undefined) data.displayName = displayName || null;
    if (profilePicture !== undefined) data.profilePicture = profilePicture || null;
    if (bio !== undefined) data.bio = bio || "";
    if (profileBanner !== undefined) data.profileBanner = profileBanner || "";
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
