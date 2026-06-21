import { Injectable } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Task } from './entities/task.entity';
import { AiRecommendation } from './interfaces/ai.interface';
import { getRecommendation } from './ai-recommender.util';

/**
 * AiRecommenderService - AI 에이전트 추천 서비스
 *
 * SettingsService에서 aiThreshold를 가져와
 * 각 Task에 대한 AI 적합도 추천 결과를 반환한다.
 */
@Injectable()
export class AiRecommenderService {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 단일 Task에 대한 AI 추천 결과 반환
   *
   * - SettingsService에서 aiThreshold 가져옴
   * - Task.deadline (Date)을 ISO string으로 변환하여 getRecommendation util 호출
   */
  async getRecommendationForTask(task: Task): Promise<AiRecommendation> {
    const settings = await this.settingsService.getSettings();

    return getRecommendation(
      {
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        deadline: task.deadline.toISOString(),
      },
      settings.aiThreshold,
    );
  }

  /**
   * 여러 Task에 대한 AI 추천 결과 일괄 반환
   *
   * - SettingsService에서 aiThreshold를 한 번만 가져옴
   * - 각 Task를 getRecommendation util에 전달
   */
  async getRecommendationsForAll(tasks: Task[]): Promise<AiRecommendation[]> {
    const settings = await this.settingsService.getSettings();

    return tasks.map((task) =>
      getRecommendation(
        {
          id: task.id,
          title: task.title,
          description: task.description,
          category: task.category,
          deadline: task.deadline.toISOString(),
        },
        settings.aiThreshold,
      ),
    );
  }
}
