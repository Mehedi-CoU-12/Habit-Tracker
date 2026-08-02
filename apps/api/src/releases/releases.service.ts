import { Injectable } from '@nestjs/common';
import { AppPlatform } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { TTL, cacheKeys } from '../redis/cache-keys.js';
import { UpsertReleaseDto } from './dto/upsert-release.dto.js';

/** What an installed app needs to decide whether to prompt. */
export type PublicRelease = {
  latest: string;
  minimum: string;
  url: string;
  notes: string | null;
  publishedAt: string;
} | null;

@Injectable()
export class ReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  getPublic(platform: AppPlatform): Promise<PublicRelease> {
    return this.cache.getOrSet(
      cacheKeys.appRelease(platform),
      TTL.appRelease,
      () => this.queryPublic(platform),
    );
  }

  private async queryPublic(platform: AppPlatform): Promise<PublicRelease> {
    const row = await this.prisma.appRelease.findUnique({
      where: { platform },
      select: {
        latest: true,
        minimum: true,
        url: true,
        notes: true,
        updatedAt: true,
      },
    });
    if (!row) return null;
    const { updatedAt, ...rest } = row;
    return { ...rest, publishedAt: updatedAt.toISOString() };
  }

  /** Every platform's row, for the admin dashboard. */
  listAll() {
    return this.prisma.appRelease.findMany({ orderBy: { platform: 'asc' } });
  }

  async upsert(adminId: string, platform: AppPlatform, dto: UpsertReleaseDto) {
    const data = {
      latest: dto.latest,
      minimum: dto.minimum,
      url: dto.url,
      notes: dto.notes ?? null,
      updatedBy: adminId,
    };
    const saved = await this.prisma.appRelease.upsert({
      where: { platform },
      create: { platform, ...data },
      update: data,
    });
    // Publishing is the whole point of this record — apps must see it now,
    // not up to TTL.appRelease later.
    await this.cache.del(cacheKeys.appRelease(platform));
    return saved;
  }
}
