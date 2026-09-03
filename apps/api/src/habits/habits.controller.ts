import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { ApplyTemplateDto } from './dto/apply-template.dto.js';
import { CreateHabitDto } from './dto/create-habit.dto.js';
import { UpdateHabitDto } from './dto/update-habit.dto.js';
import { ToggleLogDto } from './dto/toggle-log.dto.js';
import { SetLogDto } from './dto/set-log.dto.js';
import { SetLogAmountDto } from './dto/set-log-amount.dto.js';
import { SetSkipDto } from './dto/set-skip.dto.js';
import { HabitsService } from './habits.service.js';

// Auth comes from the global guard stack (app.module.ts) — no @UseGuards.
@Controller('habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Get()
  getHabits(
    @Request() req: { user: { id: string } },
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.habitsService.getHabitsWithLogs(
      req.user.id,
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : now.getMonth() + 1,
    );
  }

  @Post()
  createHabit(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateHabitDto,
  ) {
    return this.habitsService.createHabit(req.user.id, dto);
  }

  @Patch(':id')
  updateHabit(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateHabitDto,
  ) {
    return this.habitsService.updateHabit(req.user.id, id, dto);
  }

  @Delete(':id')
  deleteHabit(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.habitsService.deleteHabit(req.user.id, id);
  }

  @Post('apply-template')
  applyTemplate(
    @Request() req: { user: { id: string } },
    @Body() dto: ApplyTemplateDto,
  ) {
    return this.habitsService.applyTemplate(req.user.id, dto.templateId);
  }

  @Post('logs/toggle')
  toggleLog(
    @Request() req: { user: { id: string } },
    @Body() dto: ToggleLogDto,
  ) {
    return this.habitsService.toggleLog(req.user.id, dto);
  }

  // Idempotent counterpart of logs/toggle — the mobile offline sync uses this so
  // replayed writes converge instead of flipping state. PUT because it sets an
  // absolute state for the (habit, date) cell.
  @Put('logs')
  setLog(@Request() req: { user: { id: string } }, @Body() dto: SetLogDto) {
    return this.habitsService.setLog(req.user.id, dto);
  }

  // Absolute, idempotent skip write — the streak-insurance sibling of
  // PUT /logs. PUT because it sets a state for the (habit, date) cell, which
  // is what makes an outbox replay converge.
  @Put('skips')
  setSkip(@Request() req: { user: { id: string } }, @Body() dto: SetSkipDto) {
    return this.habitsService.setSkip(req.user.id, dto);
  }

  // Absolute amount counterpart for quantified habits. A sibling of PUT /logs
  // rather than an extra field on it, so older clients are untouched.
  @Put('logs/amount')
  setLogAmount(
    @Request() req: { user: { id: string } },
    @Body() dto: SetLogAmountDto,
  ) {
    return this.habitsService.setLogAmount(req.user.id, dto);
  }
}
