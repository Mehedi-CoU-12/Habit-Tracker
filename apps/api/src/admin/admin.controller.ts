import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { Roles } from '../auth/roles.decorator.js';
import { AdminService } from './admin.service.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

type AuthedRequest = { user: { id: string } };

// The global guard stack already requires a valid token + ACTIVE account;
// @Roles(ADMIN) narrows every route here to admins (enforced by RolesGuard).
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  listUsers(@Query() query: ListUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  // Same shape as GET /habits, so the admin UI reuses the dashboard
  // components over any user's data.
  @Get('users/:id/habits')
  getUserHabits(
    @Param('id') id: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.adminService.getUserHabits(
      id,
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : now.getMonth() + 1,
    );
  }

  @Patch('users/:id/status')
  updateStatus(
    @Request() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.adminService.updateStatus(req.user.id, id, dto);
  }

  @Delete('users/:id')
  deleteUser(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.adminService.deleteUser(req.user.id, id);
  }

  @Post('users/:id/payments')
  recordPayment(
    @Request() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.adminService.recordPayment(req.user.id, id, dto);
  }

  @Get('users/:id/payments')
  listPayments(@Param('id') id: string) {
    return this.adminService.listPayments(id);
  }
}
