import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { cacheKeys, TTL } from '../redis/cache-keys.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  // Cached; invalidated by every mutation of the profile — updateProfile and
  // uploadAvatar here, plus the admin status change/delete (AdminService) so
  // a PENDING account polling this endpoint sees its activation immediately.
  getMe(userId: string) {
    return this.cache.getOrSet(cacheKeys.me(userId), TTL.me, () =>
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to set a new password',
        );
      }
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      if (!user.password) {
        throw new BadRequestException(
          'This account uses Google sign-in and has no password',
        );
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!valid)
        throw new UnauthorizedException('Current password is incorrect');
    }

    const data: {
      name?: string;
      password?: string;
      tokenVersion?: { increment: number };
    } = {};
    if (dto.name) data.name = dto.name;
    if (dto.newPassword) {
      data.password = await bcrypt.hash(dto.newPassword, 10);
      // Changing the password revokes every existing session (this device
      // included) — the next request fails the tokenVersion check and the
      // client is sent back to sign in with the new password.
      data.tokenVersion = { increment: 1 };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      // Same shape as GET /users/me — the web client writes this straight
      // into its cached profile, so role/status must not be dropped.
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    // A password change bumps tokenVersion, so the cached auth row must go
    // too — otherwise old tokens would stay valid until the authUser TTL.
    await this.cache.del(cacheKeys.me(userId), cacheKeys.authUser(userId));
    return updated;
  }

  async uploadAvatar(userId: string, buffer: Buffer, mimetype: string) {
    const base64 = buffer.toString('base64');
    const dataUri = `data:${mimetype};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'habitflow/avatars',
      public_id: `user_${userId}`,
      overwrite: true,
      transformation: [
        { width: 200, height: 200, crop: 'fill', gravity: 'face' },
      ],
    });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: result.secure_url },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    await this.cache.del(cacheKeys.me(userId));
    return updated;
  }
}
