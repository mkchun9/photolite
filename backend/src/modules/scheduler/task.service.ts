import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TimeService } from './time.service';
import { SettingsService } from './settings.service';
import { computePriority, comparePriority } from './priority.util';
import { PriorityBreakdown } from './interfaces/priority.interface';
import { AiRecommendation } from './interfaces/ai.interface';
import { DeadlineClassification, TaskStatus } from './scheduler.constants';

/**
 * 태스크 남은 기한 정보
 */
export interface RemainingInfo {
  totalMinutes: number;
  days: number;
  hours: number;
  minutes: number;
  classification: DeadlineClassification;
}

/**
 * 태스크 + 우선순위 + 남은 기한 + AI 추천 결합 응답
 */
export interface TaskWithDetails {
  task: Task;
  remaining: RemainingInfo;
  priority: PriorityBreakdown;
  ai: AiRecommendation;
}

/**
 * TaskService — 유동 업무(태스크) CRUD 및 우선순위·남은 기한·AI 추천 통합 조회
 *
 * - create: 태스크 생성 (마감 < 현재 시각이어도 수락, 우선순위 시스템이 overdue 처리)
 * - findAll: 미완료 태스크 목록을 우선순위 desc 정렬 + 남은 기한 + AI 추천 병합
 * - findOne: ID로 단건 조회, 미존재 시 NotFoundException
 * - update: 태스크 필드 업데이트
 * - remove: 태스크 삭제
 */
@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly timeService: TimeService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * 태스크 생성
   * 마감이 현재 시각 이전이어도 수락 — 우선순위 시스템에서 overdue로 처리됨
   */
  async create(dto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      importance: dto.importance,
      deadline: new Date(dto.deadline),
      estimatedMinutes: dto.estimatedMinutes,
      completedMinutes: dto.completedMinutes ?? 0,
      earliestStart: dto.earliestStart ? new Date(dto.earliestStart) : undefined,
      status: TaskStatus.PENDING,
    });

    return this.taskRepository.save(task);
  }

  /**
   * 미완료(DONE 제외) 태스크 목록을 우선순위 desc 정렬 + 남은 기한 + AI 추천 병합
   */
  async findAll(): Promise<TaskWithDetails[]> {
    const tasks = await this.taskRepository.find({
      where: { status: Not(TaskStatus.DONE) },
    });

    const now = this.timeService.now();
    const settings = await this.settingsService.getSettings();

    const enriched: TaskWithDetails[] = tasks.map((task) => {
      // 우선순위 산정
      const priority = computePriority(task, now, {
        urgencyWeight: settings.urgencyWeight,
        importanceWeight: settings.importanceWeight,
      });

      // 남은 기한 계산
      const { totalMinutes } = this.timeService.remainingUntil(task.deadline, now);
      const classification = this.timeService.classify(task.deadline, now);
      const formatted = this.timeService.format(totalMinutes);

      const remaining: RemainingInfo = {
        totalMinutes,
        days: formatted.days,
        hours: formatted.hours,
        minutes: formatted.minutes,
        classification,
      };

      // AI 추천 placeholder (Task 9.2에서 실제 구현 교체 예정)
      const ai: AiRecommendation = {
        taskId: task.id,
        recommended: false,
        suitabilityScore: 0,
        rationale: 'AI 추천 서비스 미구현',
      };

      return { task, remaining, priority, ai };
    });

    // 우선순위 score desc 정렬 (동점 시 comparePriority 규칙 적용)
    enriched.sort((a, b) =>
      comparePriority(
        {
          score: a.priority.score,
          deadline: a.task.deadline,
          importance: a.task.importance,
          createdAt: a.task.createdAt,
          id: a.task.id,
        },
        {
          score: b.priority.score,
          deadline: b.task.deadline,
          importance: b.task.importance,
          createdAt: b.task.createdAt,
          id: b.task.id,
        },
      ),
    );

    return enriched;
  }

  /**
   * ID로 단건 조회. 미존재 시 NotFoundException
   */
  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with id "${id}" not found`);
    }
    return task;
  }

  /**
   * 태스크 필드 업데이트
   */
  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.category !== undefined) task.category = dto.category;
    if (dto.importance !== undefined) task.importance = dto.importance;
    if (dto.deadline !== undefined) task.deadline = new Date(dto.deadline);
    if (dto.estimatedMinutes !== undefined) task.estimatedMinutes = dto.estimatedMinutes;
    if (dto.completedMinutes !== undefined) task.completedMinutes = dto.completedMinutes;
    if (dto.earliestStart !== undefined) task.earliestStart = new Date(dto.earliestStart);
    if (dto.status !== undefined) task.status = dto.status;

    return this.taskRepository.save(task);
  }

  /**
   * 태스크 삭제
   */
  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    await this.taskRepository.remove(task);
  }
}
