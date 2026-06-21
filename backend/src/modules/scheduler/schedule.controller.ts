import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseFilters,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { SchedulePlan, TimeBlock, UnscheduledTask } from './interfaces/schedule.interface';
import { ScheduleAllocation } from './entities/schedule-allocation.entity';
import { SchedulerExceptionFilter } from './filters/scheduler-exception.filter';

/**
 * ScheduleController — 일정 생성·조회·잠금 REST API
 *
 * 엔드포인트:
 * - POST   /api/v1/schedule/generate           → 일정 생성
 * - GET    /api/v1/schedule?startDate&endDate   → 날짜 범위 일정 조회
 * - POST   /api/v1/schedule/allocations/:id/lock   → allocation 잠금
 * - DELETE /api/v1/schedule/allocations/:id/lock   → allocation 잠금 해제
 * - GET    /api/v1/scheduler/now                → 현재 서버 시간 조회
 */
@Controller('v1')
@UseFilters(new SchedulerExceptionFilter())
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('schedule/generate')
  async generate(@Body() dto: GenerateScheduleDto): Promise<SchedulePlan> {
    return this.scheduleService.generate(dto);
  }

  @Get('schedule')
  async findByRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ allocations: TimeBlock[]; atRisk: UnscheduledTask[] }> {
    return this.scheduleService.findByRange(startDate, endDate);
  }

  @Post('schedule/allocations/:id/lock')
  async lockAllocation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ScheduleAllocation> {
    return this.scheduleService.lockAllocation(id);
  }

  @Delete('schedule/allocations/:id/lock')
  async unlockAllocation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ScheduleAllocation> {
    return this.scheduleService.unlockAllocation(id);
  }

  @Get('scheduler/now')
  async getNow(): Promise<{ now: string; timezone: string }> {
    return this.scheduleService.getNow();
  }
}
