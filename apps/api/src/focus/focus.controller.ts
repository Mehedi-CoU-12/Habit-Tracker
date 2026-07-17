import { Body, Controller, Get, Post, Query, Request } from '@nestjs/common';
import { RecordSessionDto } from './dto/record-session.dto.js';
import { FocusService } from './focus.service.js';

// Auth comes from the global guard stack (app.module.ts) — no @UseGuards.
@Controller('focus')
export class FocusController {
  constructor(private readonly focusService: FocusService) {}

  @Post('sessions')
  recordSession(
    @Request() req: { user: { id: string } },
    @Body() dto: RecordSessionDto,
  ) {
    return this.focusService.recordSession(req.user.id, dto);
  }

  // year/month/day = the client's local today, so the day boundaries in the
  // stats follow the user's calendar (same convention as GET /habits).
  @Get('stats')
  getStats(
    @Request() req: { user: { id: string } },
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('day') day?: string,
  ) {
    const now = new Date();
    return this.focusService.getStats(
      req.user.id,
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : now.getMonth() + 1,
      day ? parseInt(day) : now.getDate(),
    );
  }
}
