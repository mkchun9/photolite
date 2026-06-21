import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseFilters,
} from '@nestjs/common';
import { TaskService, TaskWithDetails } from './task.service';
import { AiRecommenderService } from './ai-recommender.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';
import { AiRecommendation } from './interfaces/ai.interface';
import { SchedulerExceptionFilter } from './filters/scheduler-exception.filter';

/**
 * TaskController — 유동 업무(태스크) REST API
 *
 * 엔드포인트:
 * - POST   /api/v1/tasks                 → 태스크 생성
 * - GET    /api/v1/tasks                  → 전체 태스크 목록 (우선순위/남은기한/AI 포함)
 * - GET    /api/v1/tasks/ai-recommendations → 전체 태스크 AI 추천 일괄 조회
 * - GET    /api/v1/tasks/:id              → 태스크 단건 조회
 * - PATCH  /api/v1/tasks/:id              → 태스크 수정
 * - DELETE /api/v1/tasks/:id              → 태스크 삭제
 * - GET    /api/v1/tasks/:id/ai-recommendation → 개별 태스크 AI 추천 조회
 */
@Controller('v1/tasks')
@UseFilters(new SchedulerExceptionFilter())
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly aiRecommenderService: AiRecommenderService,
  ) {}

  @Post()
  async create(@Body() dto: CreateTaskDto): Promise<Task> {
    return this.taskService.create(dto);
  }

  @Get()
  async findAll(): Promise<TaskWithDetails[]> {
    return this.taskService.findAll();
  }

  /**
   * 전체 태스크 AI 추천 일괄 조회
   * 주의: ':id' 라우트보다 먼저 위치해야 라우트 충돌 방지
   */
  @Get('ai-recommendations')
  async getAiRecommendations(): Promise<AiRecommendation[]> {
    const taskDetails = await this.taskService.findAll();
    const tasks = taskDetails.map((td) => td.task);
    return this.aiRecommenderService.getRecommendationsForAll(tasks);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Task> {
    return this.taskService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<Task> {
    return this.taskService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.taskService.remove(id);
  }

  /**
   * 개별 태스크 AI 추천 조회
   */
  @Get(':id/ai-recommendation')
  async getAiRecommendation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AiRecommendation> {
    const task = await this.taskService.findOne(id);
    return this.aiRecommenderService.getRecommendationForTask(task);
  }
}
