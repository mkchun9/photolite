import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { randomUUID } from 'crypto';
import { ScheduleAllocation } from './entities/schedule-allocation.entity';
import { Task } from './entities/task.entity';
import { TimeService } from './time.service';
import { SettingsService } from './settings.service';
import { FixedBlockService } from './fixed-block.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import {
  SchedulePlan,
  TimeBlock,
  UnscheduledTask,
} from './interfaces/schedule.interface';
import { generateSchedule } from './scheduling.util';
import { AllocationKind, TaskStatus } from './scheduler.constants';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ScheduleAllocation)
    private readonly allocationRepository: Repository<ScheduleAllocation>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly timeService: TimeService,
    private readonly settingsService: SettingsService,
    private readonly fixedBlockService: FixedBlockService,
  ) {}

  /**
   * 일정 생성 오케스트레이션
   *
   * 1. 현재 시각 및 설정 조회
   * 2. horizon 결정 (horizonDays 또는 startDate/endDate)
   * 3. 유효성 검증 (horizonEnd < now → BadRequestException)
   * 4. 비-DONE 태스크, 고정 블록, locked allocation 로드
   * 5. generateSchedule() 순수 함수 호출
   * 6. 결과 allocations 영속화 (locked 유지, 비-locked 교체)
   * 7. SchedulePlan 반환
   */
  async generate(dto: GenerateScheduleDto): Promise<SchedulePlan> {
    // 1. 현재 시각 및 설정
    const now = this.timeService.now();
    const settings = await this.settingsService.getSettings();
    const timezone = settings.timezone;

    // 2. horizon 결정
    let horizonStart: Date;
    let horizonEnd: Date;

    if (dto.startDate && dto.endDate) {
      horizonStart = new Date(dto.startDate);
      horizonEnd = new Date(dto.endDate);
    } else if (dto.horizonDays) {
      horizonStart = now;
      horizonEnd = new Date(now.getTime() + dto.horizonDays * 24 * 60 * 60 * 1000);
    } else {
      // 기본값: 7일
      horizonStart = now;
      horizonEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    // 3. 유효성 검증
    if (horizonEnd.getTime() < now.getTime()) {
      throw new BadRequestException({
        error: 'INVALID_HORIZON',
        message: 'Horizon 종료 시각이 현재 시각보다 이전입니다.',
      });
    }

    // 4. 데이터 로드
    const tasks = await this.taskRepository.find({
      where: { status: Not(TaskStatus.DONE) },
    });

    const fixedBlocks = await this.fixedBlockService.findAll();

    const lockedAllocations = await this.allocationRepository.find({
      where: { locked: true },
    });

    // 5. 순수 함수 호출을 위한 입력 변환
    const taskInputs = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      importance: t.importance,
      deadline: t.deadline,
      estimatedMinutes: t.estimatedMinutes,
      completedMinutes: t.completedMinutes,
      earliestStart: t.earliestStart,
      createdAt: t.createdAt,
    }));

    const fixedBlockInputs = fixedBlocks.map((fb) => ({
      id: fb.id,
      type: fb.type,
      title: fb.title,
      startMinute: fb.startMinute,
      endMinute: fb.endMinute,
      daysOfWeek: fb.daysOfWeek,
      specificDate: fb.specificDate,
      isRecurring: fb.isRecurring,
    }));

    const lockInputs = lockedAllocations
      .filter((a) => a.kind === AllocationKind.TASK && a.taskId)
      .map((a) => ({
        taskId: a.taskId!,
        start: a.startAt,
        end: a.endAt,
      }));

    // 6. generateSchedule 호출
    const plan = generateSchedule({
      tasks: taskInputs,
      fixedBlocks: fixedBlockInputs,
      settings: {
        bufferMin: settings.bufferMin,
        windDownMin: settings.windDownMin,
        minChunkMin: settings.minChunkMin,
        maxFocusMin: settings.maxFocusMin,
        researchQuotaMin: settings.researchQuotaMin,
        urgencyWeight: Number(settings.urgencyWeight),
        importanceWeight: Number(settings.importanceWeight),
      },
      locks: lockInputs,
      horizonStart,
      horizonEnd,
      now,
      tz: timezone,
    });

    // 7. 영속화: 기존 비-locked allocation 삭제 후 새 allocation 저장
    const generationId = randomUUID();

    // 기존 비-locked allocation 삭제
    await this.allocationRepository.delete({ locked: false });

    // locked allocation의 generationId를 새 generationId로 업데이트 (보존)
    if (lockedAllocations.length > 0) {
      const lockedIds = lockedAllocations.map((a) => a.id);
      await this.allocationRepository
        .createQueryBuilder()
        .update(ScheduleAllocation)
        .set({ generationId })
        .whereInIds(lockedIds)
        .execute();
    }

    // 새 allocation 엔티티 생성 및 저장
    const newAllocations: ScheduleAllocation[] = [];

    for (const alloc of plan.allocations) {
      // locked allocation은 이미 DB에 존재하므로 건너뜀
      if (alloc.locked) {
        continue;
      }

      const entity = this.allocationRepository.create({
        generationId,
        kind: alloc.kind,
        taskId: alloc.kind === AllocationKind.TASK ? alloc.taskId : undefined,
        fixedBlockId: alloc.kind === AllocationKind.FIXED ? alloc.fixedBlockId : undefined,
        startAt: new Date(alloc.start),
        endAt: new Date(alloc.end),
        locked: false,
      });

      newAllocations.push(entity);
    }

    if (newAllocations.length > 0) {
      await this.allocationRepository.save(newAllocations);
    }

    return plan;
  }

  /**
   * 날짜 범위로 allocation 조회
   *
   * @param startDate - 시작 날짜 (ISO 8601)
   * @param endDate - 종료 날짜 (ISO 8601)
   * @returns allocations (TimeBlock[]) + atRisk (빈 배열, 생성 시에만 계산)
   */
  async findByRange(
    startDate: string,
    endDate: string,
  ): Promise<{ allocations: TimeBlock[]; atRisk: UnscheduledTask[] }> {
    const allocations = await this.allocationRepository.find({
      where: {
        startAt: MoreThanOrEqual(new Date(startDate)),
        endAt: LessThanOrEqual(new Date(endDate)),
      },
      order: { startAt: 'ASC' },
      relations: { task: true, fixedBlock: true },
    });

    const timeBlocks: TimeBlock[] = allocations.map((a) => ({
      kind: a.kind as AllocationKind,
      taskId: a.taskId ?? undefined,
      fixedBlockId: a.fixedBlockId ?? undefined,
      title: this.getAllocationTitle(a),
      start: a.startAt.toISOString(),
      end: a.endAt.toISOString(),
      locked: a.locked,
    }));

    return {
      allocations: timeBlocks,
      atRisk: [],
    };
  }

  /**
   * 현재 서버 시간 및 타임존 반환
   */
  async getNow(): Promise<{ now: string; timezone: string }> {
    const settings = await this.settingsService.getSettings();
    const now = this.timeService.now();
    return {
      now: now.toISOString(),
      timezone: settings.timezone,
    };
  }

  /**
   * 특정 allocation을 잠금 처리
   *
   * 잠긴 allocation은 이후 일정 재생성 시 이동 불가(immovable)로 취급된다.
   *
   * @param allocationId - 잠금할 allocation의 UUID
   * @returns 업데이트된 ScheduleAllocation 엔티티
   * @throws NotFoundException - 해당 ID의 allocation이 존재하지 않을 때
   */
  async lockAllocation(allocationId: string): Promise<ScheduleAllocation> {
    const allocation = await this.allocationRepository.findOne({
      where: { id: allocationId },
    });

    if (!allocation) {
      throw new NotFoundException(
        `Allocation with id "${allocationId}" not found`,
      );
    }

    allocation.locked = true;
    return this.allocationRepository.save(allocation);
  }

  /**
   * 특정 allocation의 잠금 해제
   *
   * 잠금 해제된 allocation은 다음 일정 재생성 시 재배치 대상이 된다.
   *
   * @param allocationId - 잠금 해제할 allocation의 UUID
   * @returns 업데이트된 ScheduleAllocation 엔티티
   * @throws NotFoundException - 해당 ID의 allocation이 존재하지 않을 때
   */
  async unlockAllocation(allocationId: string): Promise<ScheduleAllocation> {
    const allocation = await this.allocationRepository.findOne({
      where: { id: allocationId },
    });

    if (!allocation) {
      throw new NotFoundException(
        `Allocation with id "${allocationId}" not found`,
      );
    }

    allocation.locked = false;
    return this.allocationRepository.save(allocation);
  }

  /**
   * allocation의 title을 결정하는 헬퍼
   */
  private getAllocationTitle(allocation: ScheduleAllocation): string {
    if (allocation.kind === AllocationKind.TASK && allocation.task) {
      return allocation.task.title;
    }
    if (allocation.kind === AllocationKind.FIXED && allocation.fixedBlock) {
      return allocation.fixedBlock.title;
    }
    if (allocation.kind === AllocationKind.RESEARCH_RESERVED) {
      return '연구 시간 (예약)';
    }
    return '알 수 없는 블록';
  }
}
