import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerSettings } from './entities/scheduler-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_RESEARCH_QUOTA_MIN,
  DEFAULT_BUFFER_MIN,
  DEFAULT_WIND_DOWN_MIN,
  DEFAULT_MIN_CHUNK_MIN,
  DEFAULT_MAX_FOCUS_MIN,
  DEFAULT_URGENCY_WEIGHT,
  DEFAULT_IMPORTANCE_WEIGHT,
  AI_SUITABILITY_THRESHOLD,
} from './scheduler.constants';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(SchedulerSettings)
    private readonly settingsRepository: Repository<SchedulerSettings>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.getSettings();
  }

  async getSettings(): Promise<SchedulerSettings> {
    const existing = await this.settingsRepository.findOne({ where: {} });
    if (existing) {
      return existing;
    }
    return this.seedDefaults();
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<SchedulerSettings> {
    const settings = await this.getSettings();
    Object.assign(settings, dto);
    return this.settingsRepository.save(settings);
  }

  async seedDefaults(): Promise<SchedulerSettings> {
    const defaults = this.settingsRepository.create({
      timezone: DEFAULT_TIMEZONE,
      researchQuotaMin: DEFAULT_RESEARCH_QUOTA_MIN,
      bufferMin: DEFAULT_BUFFER_MIN,
      windDownMin: DEFAULT_WIND_DOWN_MIN,
      minChunkMin: DEFAULT_MIN_CHUNK_MIN,
      maxFocusMin: DEFAULT_MAX_FOCUS_MIN,
      urgencyWeight: DEFAULT_URGENCY_WEIGHT,
      importanceWeight: DEFAULT_IMPORTANCE_WEIGHT,
      aiThreshold: AI_SUITABILITY_THRESHOLD,
    });
    return this.settingsRepository.save(defaults);
  }
}
