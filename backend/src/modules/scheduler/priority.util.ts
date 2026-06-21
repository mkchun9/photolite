import {
  URGENCY_CAP,
  MAX_IMPORTANCE,
  DEFAULT_URGENCY_WEIGHT,
  DEFAULT_IMPORTANCE_WEIGHT,
} from './scheduler.constants';
import { PriorityBreakdown } from './interfaces/priority.interface';

/**
 * 값을 [lo, hi] 범위로 클램프
 */
const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/**
 * 남은 노력 / 마감까지 남은 시간 (effort density)
 * minutesUntilDeadline <= 0 이면 Infinity 반환
 */
export function effortDensity(
  remainingMinutes: number,
  minutesUntilDeadline: number,
): number {
  if (minutesUntilDeadline <= 0) {
    return Infinity;
  }
  return remainingMinutes / minutesUntilDeadline;
}

/**
 * 우선순위 산정 (순수 함수)
 *
 * - remainingMinutes = max(estimatedMinutes - completedMinutes, 0)
 * - minutesUntilDeadline = (deadline - now) / 60000
 * - deadline <= now: effortDensity = Infinity, urgency = URGENCY_CAP, overdue = true
 * - else: effortDensity = remaining / minutesUntilDeadline, urgency = clamp(effortDensity, 0, URGENCY_CAP)
 * - normalizedImportance = importance / MAX_IMPORTANCE
 * - score = urgencyWeight * urgency + importanceWeight * normalizedImportance
 */
export function computePriority(
  task: {
    estimatedMinutes: number;
    completedMinutes: number;
    deadline: Date;
    importance: number;
  },
  now: Date,
  settings?: { urgencyWeight?: number; importanceWeight?: number },
): PriorityBreakdown {
  const urgencyWeight = settings?.urgencyWeight ?? DEFAULT_URGENCY_WEIGHT;
  const importanceWeight = settings?.importanceWeight ?? DEFAULT_IMPORTANCE_WEIGHT;

  const remainingMinutes = Math.max(
    task.estimatedMinutes - task.completedMinutes,
    0,
  );
  const minutesUntilDeadline =
    (task.deadline.getTime() - now.getTime()) / 60000;

  let urgency: number;
  let density: number;
  const overdue = minutesUntilDeadline <= 0;

  if (overdue) {
    density = Infinity;
    urgency = URGENCY_CAP;
  } else {
    density = effortDensity(remainingMinutes, minutesUntilDeadline);
    urgency = clamp(density, 0, URGENCY_CAP);
  }

  const normalizedImportance = task.importance / MAX_IMPORTANCE;
  const score = urgencyWeight * urgency + importanceWeight * normalizedImportance;

  return {
    score,
    urgency,
    effortDensity: density,
    normalizedImportance,
    remainingMinutes,
    minutesUntilDeadline,
    overdue,
  };
}

/**
 * 동점 처리 비교 함수 (정렬용)
 * score desc → deadline asc → importance desc → createdAt asc → id asc (lexicographic)
 *
 * @returns 음수면 a가 우선 (a를 먼저 배치)
 */
export function comparePriority(
  a: { score: number; deadline: Date; importance: number; createdAt: Date; id: string },
  b: { score: number; deadline: Date; importance: number; createdAt: Date; id: string },
): number {
  // score desc (높을수록 우선)
  if (b.score !== a.score) return b.score - a.score;
  // deadline asc (이른 마감이 우선)
  if (a.deadline.getTime() !== b.deadline.getTime())
    return a.deadline.getTime() - b.deadline.getTime();
  // importance desc (중요도 높은 쪽 우선)
  if (b.importance !== a.importance) return b.importance - a.importance;
  // createdAt asc (먼저 만든 쪽 우선)
  if (a.createdAt.getTime() !== b.createdAt.getTime())
    return a.createdAt.getTime() - b.createdAt.getTime();
  // id asc (lexicographic 안정 정렬)
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}
