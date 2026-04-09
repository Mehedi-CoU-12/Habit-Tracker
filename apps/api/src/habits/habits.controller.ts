import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateHabitDto } from './dto/create-habit.dto.js';
import { ToggleLogDto } from './dto/toggle-log.dto.js';
import { HabitsService } from './habits.service.js';

@UseGuards(JwtAuthGuard)
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

  @Delete(':id')
  deleteHabit(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.habitsService.deleteHabit(req.user.id, id);
  }

  @Post('logs/toggle')
  toggleLog(
    @Request() req: { user: { id: string } },
    @Body() dto: ToggleLogDto,
  ) {
    return this.habitsService.toggleLog(req.user.id, dto);
  }
}
