import { Body, Controller, Get, Put, Query, Request } from '@nestjs/common';
import { NotesService } from './notes.service.js';
import { SetDayNoteDto } from './dto/set-day-note.dto.js';

// Auth comes from the global guard stack (app.module.ts) — no @UseGuards.
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  getMonth(
    @Request() req: { user: { id: string } },
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.notes.getMonth(
      req.user.id,
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : now.getMonth() + 1,
    );
  }

  // PUT because it sets an absolute state for the (user, date) cell, and a
  // blank body clears it. See SetDayNoteDto on why there is no DELETE.
  @Put()
  setNote(
    @Request() req: { user: { id: string } },
    @Body() dto: SetDayNoteDto,
  ) {
    return this.notes.setNote(req.user.id, dto);
  }
}
