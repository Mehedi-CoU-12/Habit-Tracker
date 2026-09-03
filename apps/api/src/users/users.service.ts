import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { cacheKeys, TTL } from '../redis/cache-keys.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

/** What a passwordless (Google-only) account types to prove it means it. */
export const DELETE_WORD = 'DELETE';

/**
 * The profile shape every user-facing endpoint returns. `password` is selected
 * only to be collapsed into `hasPassword` by `toProfile` — it never leaves the
 * service. Clients need the flag to know which proof of intent account
 * deletion will ask for (a password, or the typed word).
 */
const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  status: true,
  createdAt: true,
  password: true,
} as const;

type ProfileRow = {
  password: string | null;
} & Record<string, unknown>;

function toProfile({ password, ...rest }: ProfileRow) {
  return { ...rest, hasPassword: password !== null };
}

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
    return this.cache.getOrSet(cacheKeys.me(userId), TTL.me, async () =>
      toProfile(
        await this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: PROFILE_SELECT,
        }),
      ),
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

    const row = await this.prisma.user.update({
      where: { id: userId },
      data,
      // Same shape as GET /users/me — the web client writes this straight
      // into its cached profile, so role/status/hasPassword must not be
      // dropped.
      select: PROFILE_SELECT,
    });
    // A password change bumps tokenVersion, so the cached auth row must go
    // too — otherwise old tokens would stay valid until the authUser TTL.
    await this.cache.del(cacheKeys.me(userId), cacheKeys.authUser(userId));
    return toProfile(row);
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

    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: result.secure_url },
      select: PROFILE_SELECT,
    });
    await this.cache.del(cacheKeys.me(userId));
    return toProfile(row);
  }

  /**
   * Irreversible account deletion. Habits, logs, notes and focus sessions go
   * with the row via the schema's cascades; payments deliberately do not —
   * they're SetNull with the email denormalized first, so the cash ledger
   * survives its user (see the Payment model).
   *
   * No tokenVersion bump is needed: the row is gone, so JwtStrategy's user
   * lookup fails on the very next request. The cached auth row is the one
   * thing that could outlive the account, which is why it's dropped here.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });
    if (!user) throw new NotFoundException('Account not found');

    if (user.password) {
      if (!dto.password) {
        throw new BadRequestException(
          'Your current password is required to delete this account',
        );
      }
      const valid = await bcrypt.compare(dto.password, user.password);
      if (!valid) throw new UnauthorizedException('Password is incorrect');
    } else if (dto.confirmation?.trim().toUpperCase() !== DELETE_WORD) {
      // A Google-only account has no password to prove intent with, so the
      // typed word is the proof.
      throw new BadRequestException(
        `Type ${DELETE_WORD} to confirm deleting this account`,
      );
    }

    await this.prisma.transaction(async (tx) => {
      // Stamp the email before the FK goes null, or the ledger row loses the
      // last thing that identifies it.
      await tx.payment.updateMany({
        where: { userId },
        data: { userEmail: user.email },
      });
      await tx.user.delete({ where: { id: userId } });
    });

    // Every cached trace of the account, so nothing can outlive the row: the
    // auth row (a live token would otherwise pass for up to TTL.authUser),
    // the profile, and the versioned habit/note/focus namespaces.
    await this.cache.del(cacheKeys.authUser(userId), cacheKeys.me(userId));
    await Promise.all([
      this.cache.bumpVersion(cacheKeys.habitsVersion(userId)),
      this.cache.bumpVersion(cacheKeys.dayNotesVersion(userId)),
      this.cache.bumpVersion(cacheKeys.focusVersion(userId)),
      this.cache.bumpVersion(cacheKeys.adminUsersVersion),
    ]);

    return { deleted: true };
  }
}
