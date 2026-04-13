import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    return user;
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

    const data: { name?: string; password?: string } = {};
    if (dto.name) data.name = dto.name;
    if (dto.newPassword) data.password = await bcrypt.hash(dto.newPassword, 10);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
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
        createdAt: true,
      },
    });
    return updated;
  }
}
