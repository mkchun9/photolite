import { Injectable } from '@nestjs/common';
import {
  CRITICAL_HOURS,
  WARNING_HOURS,
  DEFAULT_TIMEZONE,
  DeadlineClassification,
} from './scheduler.constants';

/**
 * TimeService — 현재 시각, 남은 기한 계산·분류·포맷을 담당하는 서비스
 *
 * - now(): 시스템 클럭 기준 현재 시각 반환
 * - remainingUntil(): deadline − now (분/밀리초)
 * - classify(): 남은 기한 → OVERDUE/CRITICAL/WARNING/NORMAL 분류 (순수 함수)
 * - format(): 총 분을 일/시/분 + 포맷 문자열로 변환 (순수 함수)
 */
@Injectable()
export class TimeService {
  /**
   * 서버 시스템 클럭 기준 현재 시각을 반환한다.
   * timezone 파라미터는 표시 목적이며, Date 객체 자체는 항상 UTC 기반이다.
   *
   * @param timezone - IANA 타임존 (기본값: DEFAULT_TIMEZONE = 'Asia/Seoul')
   * @returns 현재 시각 Date 객체
   */
  now(timezone?: string): Date {
    // timezone은 표시 목적 (Date 객체는 내부적으로 항상 UTC)
    void (timezone ?? DEFAULT_TIMEZONE);
    return new Date();
  }

  /**
   * deadline까지 남은 시간을 밀리초와 분으로 반환한다.
   *
   * @param deadline - 마감 기한
   * @param now - 현재 시각
   * @returns { totalMinutes, totalMilliseconds }
   */
  remainingUntil(
    deadline: Date,
    now: Date,
  ): { totalMinutes: number; totalMilliseconds: number } {
    const totalMilliseconds = deadline.getTime() - now.getTime();
    const totalMinutes = totalMilliseconds / 60000;
    return { totalMinutes, totalMilliseconds };
  }

  /**
   * deadline과 now를 비교하여 남은 기한 분류를 반환한다. (순수 함수)
   *
   * - now >= deadline → OVERDUE
   * - remaining <= 24h (CRITICAL_HOURS * 60분) → CRITICAL
   * - remaining <= 72h (WARNING_HOURS * 60분) → WARNING
   * - 그 외 → NORMAL
   *
   * @param deadline - 마감 기한
   * @param now - 현재 시각
   * @returns DeadlineClassification
   */
  classify(deadline: Date, now: Date): DeadlineClassification {
    const remainingMs = deadline.getTime() - now.getTime();

    if (remainingMs <= 0) {
      return DeadlineClassification.OVERDUE;
    }

    const remainingMinutes = remainingMs / 60000;
    const criticalMinutes = CRITICAL_HOURS * 60;
    const warningMinutes = WARNING_HOURS * 60;

    if (remainingMinutes <= criticalMinutes) {
      return DeadlineClassification.CRITICAL;
    }

    if (remainingMinutes <= warningMinutes) {
      return DeadlineClassification.WARNING;
    }

    return DeadlineClassification.NORMAL;
  }

  /**
   * 총 분(totalMinutes)을 일·시·분으로 분해하고 한국어 포맷 문자열을 반환한다. (순수 함수)
   *
   * 예: 3045분 → { days: 2, hours: 2, minutes: 45, formatted: "2일 2시간 45분" }
   *     190분 → { days: 0, hours: 3, minutes: 10, formatted: "3시간 10분" }
   *     45분  → { days: 0, hours: 0, minutes: 45, formatted: "45분" }
   *
   * @param totalMinutes - 총 분 (양수)
   * @returns { days, hours, minutes, formatted }
   */
  format(totalMinutes: number): {
    days: number;
    hours: number;
    minutes: number;
    formatted: string;
  } {
    const absTotalMinutes = Math.floor(Math.abs(totalMinutes));

    const days = Math.floor(absTotalMinutes / (24 * 60));
    const hours = Math.floor((absTotalMinutes % (24 * 60)) / 60);
    const minutes = absTotalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) {
      parts.push(`${days}일`);
    }
    if (hours > 0) {
      parts.push(`${hours}시간`);
    }
    if (minutes > 0 || parts.length === 0) {
      parts.push(`${minutes}분`);
    }

    const formatted = parts.join(' ');

    return { days, hours, minutes, formatted };
  }
}
