import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { FixedBlock } from './entities/fixed-block.entity';
import { ScheduleAllocation } from './entities/schedule-allocation.entity';
import { SchedulerSettings } from './entities/scheduler-settings.entity';
import { TimeService } from './time.service';
import { FixedBlockService } from './fixed-block.service';
import { SettingsService } from './settings.service';
import { TaskService } from './task.service';
import { ScheduleService } from './schedule.service';
import { AiRecommenderService } from './ai-recommender.service';
import { TaskController } from './task.controller';
import { FixedBlockController } from './fixed-block.controller';
import { ScheduleController } from './schedule.controller';
import { SettingsController } from './settings.controller';

/**
 * SchedulerModule - 업무 우선순위 자동 관리 (SmartScheduler) 기능을 담당하는 모듈
 *
 * 고정 시간 블록 관리, 유동 업무 관리, 자동 우선순위 산정,
 * 일정 분할·배치, 남은 기한 표시, AI 에이전트 프롬프트 추천 기능을 제공한다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Task, FixedBlock, ScheduleAllocation, SchedulerSettings]),
  ],
  controllers: [
    TaskController,
    FixedBlockController,
    ScheduleController,
    SettingsController,
  ],
  providers: [
    TimeService,
    SettingsService,
    FixedBlockService,
    TaskService,
    ScheduleService,
    AiRecommenderService,
  ],
  exports: [TimeService, SettingsService, FixedBlockService, TaskService, ScheduleService, AiRecommenderService],
})
export class SchedulerModule {}
