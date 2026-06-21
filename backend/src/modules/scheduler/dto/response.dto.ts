/**
 * Response DTOs — 응답 전용 클래스 (유효성 검증 불필요)
 */

export class PriorityBreakdownDto {
  score: number;
  urgency: number;
  effortDensity: number;
  normalizedImportance: number;
  remainingMinutes: number;
  minutesUntilDeadline: number;
  overdue: boolean;
}

export class AiRecommendationDto {
  taskId: string;
  recommended: boolean;
  suitabilityScore: number;
  useType?: string;
  prompt?: string;
  rationale: string;
}

export class RemainingTimeDto {
  totalMinutes: number;
  days: number;
  hours: number;
  minutes: number;
  classification: 'OVERDUE' | 'CRITICAL' | 'WARNING' | 'NORMAL';
}

export class TaskResponseDto {
  id: string;
  title: string;
  description?: string;
  category: string;
  importance: number;
  deadline: string;
  estimatedMinutes: number;
  completedMinutes: number;
  earliestStart?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  remaining: RemainingTimeDto;
  priority: PriorityBreakdownDto;
  ai: AiRecommendationDto;
}

export class TimeBlockDto {
  kind: 'FIXED' | 'TASK' | 'RESEARCH_RESERVED';
  taskId?: string;
  fixedBlockId?: string;
  title: string;
  start: string;
  end: string;
  locked: boolean;
}

export class UnscheduledTaskDto {
  taskId: string;
  title: string;
  unplacedMinutes: number;
  reason: 'DEADLINE_BEFORE_CAPACITY' | 'HORIZON_CAPACITY_EXHAUSTED';
  suggestion: string;
}

export class DayCapacityWarningDto {
  date: string;
  message: string;
}

export class SchedulePlanResponseDto {
  generatedAt: string;
  horizonStart: string;
  horizonEnd: string;
  allocations: TimeBlockDto[];
  atRisk: UnscheduledTaskDto[];
  dayCapacityWarnings: DayCapacityWarningDto[];
}
