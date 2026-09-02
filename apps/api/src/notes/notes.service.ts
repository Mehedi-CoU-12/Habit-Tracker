import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { cacheKeys, TTL } from '../redis/cache-keys.js';
import { SetDayNoteDto } from './dto/set-day-note.dto.js';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * One month of notes, cached under the user's note version so a single write
   * invalidates every cached month at once — same scheme as habits. The client
   * fetches per month because that is the window the calendar screen shows.
   */
  getMonth(userId: string, year: number, month: number) {
    return this.cache.getOrSetVersioned(
      cacheKeys.dayNotesVersion(userId),
      cacheKeys.dayNotesMonth(year, month),
      TTL.dayNotes,
      () =>
        this.prisma.dayNote.findMany({
          where: { userId, year, month },
          orderBy: { day: 'asc' },
        }),
    );
  }

  /** Drop every cached month of this user's notes. */
  private invalidate(userId: string) {
    return this.cache.bumpVersion(cacheKeys.dayNotesVersion(userId));
  }

  async setNote(userId: string, dto: SetDayNoteDto) {
    const { year, month, day, text } = dto;
    const where = {
      userId_year_month_day: { userId, year, month, day },
    };

    if (!text) {
      // deleteMany (not delete) so clearing an already-empty day is a no-op
      // rather than a 404 on a replayed write.
      await this.prisma.dayNote.deleteMany({
        where: { userId, year, month, day },
      });
      await this.invalidate(userId);
      return { year, month, day, text: null };
    }

    const saved = await this.prisma.dayNote.upsert({
      where,
      create: { userId, year, month, day, text },
      update: { text },
    });
    await this.invalidate(userId);
    return saved;
  }
}
