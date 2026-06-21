import {
  Controller,
  Get,
  Patch,
  Body,
  UseFilters,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SchedulerSettings } from './entities/scheduler-settings.entity';
import { SchedulerExceptionFilter } from './filters/scheduler-exception.filter';

/**
 * SettingsController — 스케줄러 설정 REST API
 *
 * 엔드포인트:
 * - GET   /api/v1/scheduler/settings  → 현재 설정 조회
 * - PATCH /api/v1/scheduler/settings  → 설정 업데이트
 */
@Controller('v1/scheduler')
@UseFilters(new SchedulerExceptionFilter())
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('settings')
  async getSettings(): Promise<SchedulerSettings> {
    return this.settingsService.getSettings();
  }

  @Patch('settings')
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
  ): Promise<SchedulerSettings> {
    return this.settingsService.updateSettings(dto);
  }
}
