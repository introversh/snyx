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

  private generateRoomCode(): string {
    const chars1 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const chars2 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let part1 = '';
    for (let i = 0; i < 3; i++) { part1 += chars1.charAt(Math.floor(Math.random() * chars1.length)); }
    let part2 = '';
    for (let i = 0; i < 4; i++) { part2 += chars2.charAt(Math.floor(Math.random() * chars2.length)); }
    return `${part1}-${part2}`;
  }

  async signup(username: string, password: string, gender?: string, displayName?: string, profilePicture?: string) {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) throw new UnauthorizedException('Username and password are required.');
    if (this.reservedUsernames.has(cleanUsername)) throw new ConflictException('This username is reserved.');

    const exists = await this.prisma.user.findUnique({ where: { username: cleanUsername } });
    if (exists) throw new ConflictException('Username is already taken.');

    const hashedPassword = await bcrypt.hash(password, 10);
    const validatedGender = gender || 'male';

    const user = await this.prisma.user.create({
      data: {
        username: cleanUsername,
        password: hashedPassword,
        gender: validatedGender,
        displayName: displayName || undefined,
        profilePicture: profilePicture || undefined,
      },
    });

    let roomId = this.generateRoomCode();
    let roomExists = await this.prisma.room.findUnique({ where: { id: roomId } });
    let attempts = 0;
    while (roomExists && attempts < 10) {
      roomId = this.generateRoomCode();
      roomExists = await this.prisma.room.findUnique({ where: { id: roomId } });
      attempts++;
    }

    const roomName = `${displayName || user.username}'s Home`;
    const homeRoom = await this.prisma.room.create({
      data: {
        id: roomId,
        name: roomName,
        isPlaying: false,
        position: 0.0,
        isPermanent: true,
        expiresAt: null,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { homeRoomId: homeRoom.id },
    });

    const token = this.generateToken(user.id, user.username);
    
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { activeToken: token, isOnline: true },
    });

    return {
      userId: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.displayName || undefined,
      profilePicture: updatedUser.profilePicture || undefined,
      bio: updatedUser.bio || undefined,
      profileBanner: updatedUser.profileBanner || undefined,
      gender: updatedUser.gender,
      isPrivate: updatedUser.isPrivate,
      token,
      homeRoomId: updatedUser.homeRoomId,
      showActiveStatus: updatedUser.showActiveStatus,
    };
  }

  async login(username: string, password: string) {
    const cleanUsername = username.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { username: cleanUsername } });
    if (!user) throw new UnauthorizedException('Invalid credentials.');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials.');

    const token = this.generateToken(user.id, user.username);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { activeToken: token, isOnline: true },
    });

    const missedKnocks = await this.getMissedKnocks(user.id);

    return {
      userId: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.displayName || undefined,
      profilePicture: updatedUser.profilePicture || undefined,
      bio: updatedUser.bio || undefined,
      profileBanner: updatedUser.profileBanner || undefined,
      gender: updatedUser.gender,
      isPrivate: updatedUser.isPrivate,
      token,
      homeRoomId: updatedUser.homeRoomId,
      showActiveStatus: updatedUser.showActiveStatus,
      missedKnocks,
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeenAt: new Date(), activeToken: null },
    });
  }

  async updateActiveStatus(userId: string, showActiveStatus: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { showActiveStatus },
    });
  }

  async getMissedKnocks(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { homeRoom: true },
    });
    if (!user || !user.homeRoomId) return [];

    const knocks = await this.prisma.homeKnock.findMany({
      where: {
        homeRoomId: user.homeRoomId,
        seenByOwner: false,
        status: 'PENDING',
      },
      include: {
        knocker: true,
      },
    });

    if (knocks.length > 0) {
      await this.prisma.homeKnock.updateMany({
        where: { id: { in: knocks.map(k => k.id) } },
        data: { seenByOwner: true },
      });
    }

    return knocks.map(k => ({
      knockId: k.id,
      knocker: {
        userId: k.knocker.id,
        username: k.knocker.username,
        displayName: k.knocker.displayName || undefined,
        profilePicture: k.knocker.profilePicture || undefined,
      },
      knockedAt: k.knockedAt.getTime(),
    }));
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
      return jwt.verify(token, this.jwtSecret);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  async validateActiveToken(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.activeToken !== token) return false;
    return true;
  }

  private generateToken(userId: string, username: string): string {
    return jwt.sign(
      { userId, username },
      this.jwtSecret,
      { expiresIn: '30d' }
    );
  }
}
