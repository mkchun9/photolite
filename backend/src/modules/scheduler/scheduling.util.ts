import {
  MaterializedBlock,
  FreeInterval,
  ReservedPools,
  SchedulePlan,
  UnscheduledTask,
  TimeBlock,
} from './interfaces/schedule.interface';
import {
  AllocationKind,
  UnscheduledReason,
  TaskCategory,
} from './scheduler.constants';
import { computePriority, comparePriority } from './priority.util';

// ─── Constants ──────────────────────────────────────────────────────────────
const MS_PER_MIN = 60_000;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FixedBlockInput {
  id: string;
  type: string;
  title: string;
  startMinute: number;
  endMinute: number;
  daysOfWeek?: number;
  specificDate?: string;
  isRecurring: boolean;
}

export interface ScheduleSettings {
  bufferMin: number;
  windDownMin: number;
  minChunkMin: number;
  maxFocusMin: number;
  researchQuotaMin: number;
  urgencyWeight: number;
  importanceWeight: number;
}

export interface TaskInput {
  id: string;
  title: string;
  category: string;
  importance: number;
  deadline: Date;
  estimatedMinutes: number;
  completedMinutes: number;
  earliestStart?: Date;
  createdAt: Date;
}

export interface LockInput {
  taskId: string;
  start: Date;
  end: Date;
}

// ─── Timezone Helpers ───────────────────────────────────────────────────────

/**
 * 주어진 타임존에서 특정 날짜의 자정(00:00)에 해당하는 UTC Date를 반환한다.
 * Intl.DateTimeFormat을 사용하여 UTC 오프셋을 계산한다.
 */
function getMidnightInTz(year: number, month: number, day: number, tz: string): Date {
  // 해당 날짜의 정오 UTC를 기준으로 타임존 오프셋을 구한다 (DST 안전)
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(noonUtc);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const localHour = get('hour') === 24 ? 0 : get('hour');
  const localMin = get('minute');

  // 타임존에서 정오 UTC가 표시되는 로컬 시각과의 차이로 오프셋 계산
  // offset = localTime - utcTime (분 단위)
  const localTotalMin = localHour * 60 + localMin;
  const utcTotalMin = 12 * 60; // 정오 UTC = 720분
  const offsetMin = localTotalMin - utcTotalMin;

  // 자정 local = 00:00 local → UTC 기준으로는 -offset 분
  const midnightUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  midnightUtc.setUTCMinutes(midnightUtc.getUTCMinutes() - offsetMin);
  return midnightUtc;
}

/**
 * 주어진 UTC Date로부터 타임존 기반 날짜 문자열(YYYY-MM-DD)을 추출한다.
 */
function getDateStringInTz(date: Date, tz: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * 타임존에서의 요일을 반환한다 (0=일, 6=토)
 */
function getWeekdayInTz(date: Date, tz: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const dayStr = formatter.format(date);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[dayStr] ?? 0;
}

/**
 * horizon 내의 모든 날짜를 {year, month, day} 배열로 반환한다.
 * tz 기반으로 날짜 경계를 판단한다.
 */
function enumerateDays(
  horizonStart: Date,
  horizonEnd: Date,
  tz: string,
): Array<{ year: number; month: number; day: number; dateStr: string }> {
  const days: Array<{ year: number; month: number; day: number; dateStr: string }> = [];
  const startStr = getDateStringInTz(horizonStart, tz);
  const endStr = getDateStringInTz(horizonEnd, tz);

  // 첫날 파싱
  let [y, m, d] = startStr.split('-').map(Number);
  const endDate = new Date(endStr + 'T00:00:00Z');

  // 최대 400일까지 (무한 루프 방지)
  for (let i = 0; i < 400; i++) {
    const dateStr = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ year: y, month: m, day: d, dateStr });

    if (dateStr >= endStr) break;

    // 다음 날로 이동
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth() + 1;
    d = next.getUTCDate();
  }

  return days;
}

// ─── Function 1: materializeFixedBlocks ─────────────────────────────────────

/**
 * 호라이즌 내 각 날짜에 대해 고정 블록의 구체적 시간 구간을 전개한다.
 *
 * - 반복 블록: 해당 요일이 daysOfWeek 비트마스크에 포함되는지 확인 (bit 0=일, bit 6=토)
 * - 단발성 블록: specificDate가 해당 날짜와 일치하는지 확인
 * - endMinute <= startMinute: 자정을 넘어 익일까지 이어지는 블록 (overnight wrap)
 * - 타임존 기반으로 각 날짜의 자정을 계산하여 분 단위 오프셋을 적용
 */
export function materializeFixedBlocks(
  blocks: FixedBlockInput[],
  horizon: { start: Date; end: Date },
  tz: string,
): MaterializedBlock[] {
  const result: MaterializedBlock[] = [];
  const days = enumerateDays(horizon.start, horizon.end, tz);

  for (const block of blocks) {
    for (const { year, month, day, dateStr } of days) {
      // 이 날짜에 해당 블록이 적용되는지 확인
      if (block.isRecurring) {
        if (block.daysOfWeek == null) continue;
        const midnight = getMidnightInTz(year, month, day, tz);
        const weekday = getWeekdayInTz(midnight, tz);
        const bitmask = 1 << weekday;
        if ((block.daysOfWeek & bitmask) === 0) continue;
      } else {
        // 단발성 블록: specificDate 확인
        if (!block.specificDate) continue;
        if (block.specificDate !== dateStr) continue;
      }

      // 해당 날짜의 자정을 기준으로 시작/종료 타임스탬프 계산
      const midnight = getMidnightInTz(year, month, day, tz);
      const startMs = midnight.getTime() + block.startMinute * MS_PER_MIN;

      let endMs: number;
      if (block.endMinute <= block.startMinute) {
        // overnight wrap: 익일 자정 + endMinute
        const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
        const nextMidnight = getMidnightInTz(
          nextDay.getUTCFullYear(),
          nextDay.getUTCMonth() + 1,
          nextDay.getUTCDate(),
          tz,
        );
        endMs = nextMidnight.getTime() + block.endMinute * MS_PER_MIN;
      } else {
        endMs = midnight.getTime() + block.endMinute * MS_PER_MIN;
      }

      const start = new Date(startMs);
      const end = new Date(endMs);

      // 호라이즌 범위 내에 있는 블록만 포함 (부분 포함도 허용)
      if (end.getTime() <= horizon.start.getTime()) continue;
      if (start.getTime() >= horizon.end.getTime()) continue;

      result.push({
        fixedBlockId: block.id,
        type: block.type,
        title: block.title,
        start,
        end,
      });
    }
  }

  // 시작 시각순 정렬
  result.sort((a, b) => a.start.getTime() - b.start.getTime());
  return result;
}


// ─── Function 2: deriveFreeIntervals ────────────────────────────────────────

/**
 * 자유 구간을 도출한다.
 *
 * 1. SLEEP 블록으로 기상(awake) 윈도우를 결정: [sleep end, next sleep start]
 * 2. 비-SLEEP 고정 블록을 awake 윈도우에서 제거
 * 3. 각 고정 블록 경계에 buffer 적용 (인접 자유 구간 축소)
 * 4. 취침 시작 직전 windDown 제거
 * 5. 과거 시간(now 이전) 제거
 * 6. minChunk 미만 자투리 구간 제거
 */
export function deriveFreeIntervals(
  materialized: MaterializedBlock[],
  settings: { bufferMin: number; windDownMin: number; minChunkMin: number },
  sleepBlocks: MaterializedBlock[],
  now: Date,
  tz: string = 'UTC',
): FreeInterval[] {
  const bufferMs = settings.bufferMin * MS_PER_MIN;
  const windDownMs = settings.windDownMin * MS_PER_MIN;
  const minChunkMs = settings.minChunkMin * MS_PER_MIN;

  // SLEEP 블록을 시간순으로 정렬
  const sortedSleep = [...sleepBlocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  // 비-SLEEP 고정 블록 (시간순 정렬)
  const nonSleepBlocks = materialized
    .filter((b) => b.type !== 'SLEEP')
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // 1단계: awake 윈도우 도출 (sleep end → next sleep start)
  let awakeWindows: Array<{ start: Date; end: Date }> = [];

  if (sortedSleep.length === 0) {
    // SLEEP 블록이 없으면 전체 horizon이 awake
    // 이 경우 materialized 중 가장 이른 시작부터 가장 늦은 끝까지를 범위로 사용
    // 혹은 단순히 가장 이른 블록 이전 ~ 가장 늦은 블록 이후를 모두 awake로 취급
    const allBlocks = [...materialized].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
    if (allBlocks.length > 0) {
      const earliest = allBlocks[0].start;
      const latest = allBlocks[allBlocks.length - 1].end;
      // earliest 이전부터 latest 이후까지 전체를 하나의 awake window로
      awakeWindows.push({
        start: new Date(Math.min(earliest.getTime(), now.getTime())),
        end: latest,
      });
    }
    // SLEEP도 없고 다른 블록도 없으면 자유 구간 없음
  } else {
    // 각 sleep 블록의 end → 다음 sleep 블록의 start 가 awake window
    for (let i = 0; i < sortedSleep.length; i++) {
      const awakeStart = sortedSleep[i].end;
      const awakeEnd =
        i + 1 < sortedSleep.length
          ? sortedSleep[i + 1].start
          : sortedSleep[i].end; // 마지막 sleep 이후는 다음 sleep 시작까지
      if (awakeEnd.getTime() > awakeStart.getTime()) {
        awakeWindows.push({ start: awakeStart, end: awakeEnd });
      }
    }

    // 첫 sleep 시작 이전 시간도 awake로 포함 (만약 horizon 시작이 첫 sleep 이전이라면)
    if (sortedSleep.length > 0) {
      const firstSleepStart = sortedSleep[0].start;

      // 마지막 sleep end 이후도 awake에 추가
      const lastSleepEnd = sortedSleep[sortedSleep.length - 1].end;
      // 다음 sleep이 있는지 (이미 위에서 처리됨)
      // firstSleepStart 이전에 awake 구간이 있을 수 있음
      // (예: 호라이즌 시작이 기상 전이라면 무시 - 수면 중이니까)
    }
  }

  // 2단계: awake 윈도우에서 비-SLEEP 고정 블록 제거 + 버퍼 적용
  let freeIntervals: Array<{ start: Date; end: Date }> = [];

  for (const awake of awakeWindows) {
    // 이 awake 윈도우와 겹치는 비-SLEEP 블록을 찾아 제거
    let intervals: Array<{ start: number; end: number }> = [
      { start: awake.start.getTime(), end: awake.end.getTime() },
    ];

    for (const block of nonSleepBlocks) {
      const blockStart = block.start.getTime();
      const blockEnd = block.end.getTime();

      // 버퍼 포함한 occupied 구간
      const occupiedStart = blockStart - bufferMs;
      const occupiedEnd = blockEnd + bufferMs;

      const newIntervals: Array<{ start: number; end: number }> = [];
      for (const interval of intervals) {
        // occupied 구간과 겹치지 않으면 그대로 유지
        if (interval.end <= occupiedStart || interval.start >= occupiedEnd) {
          newIntervals.push(interval);
        } else {
          // 왼쪽 잔여
          if (interval.start < occupiedStart) {
            newIntervals.push({ start: interval.start, end: occupiedStart });
          }
          // 오른쪽 잔여
          if (interval.end > occupiedEnd) {
            newIntervals.push({ start: occupiedEnd, end: interval.end });
          }
        }
      }
      intervals = newIntervals;
    }


    // 3단계: wind-down 적용 (awake 윈도우 끝 = 다음 sleep 시작 직전에 windDown 제거)
    // awake.end가 다음 수면 시작이므로 awake.end - windDown 이후를 제거
    const windDownStart = awake.end.getTime() - windDownMs;
    intervals = intervals
      .map((interval) => {
        if (interval.end <= windDownStart) return interval;
        if (interval.start >= windDownStart) return null; // 완전히 wind-down 구간 내
        return { start: interval.start, end: windDownStart };
      })
      .filter((i): i is { start: number; end: number } => i !== null);

    for (const interval of intervals) {
      freeIntervals.push({
        start: new Date(interval.start),
        end: new Date(interval.end),
      });
    }
  }

  // 4단계: 과거 시간 제거
  const nowMs = now.getTime();
  freeIntervals = freeIntervals
    .map((interval) => {
      if (interval.end.getTime() <= nowMs) return null;
      if (interval.start.getTime() < nowMs) {
        return { start: now, end: interval.end };
      }
      return interval;
    })
    .filter((i): i is { start: Date; end: Date } => i !== null);

  // 5단계: minChunk 미만 자투리 제거
  freeIntervals = freeIntervals.filter(
    (i) => i.end.getTime() - i.start.getTime() >= minChunkMs,
  );

  // 시간순 정렬 및 날짜 태그 부여
  freeIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());


  // FreeInterval로 변환 (날짜 태그 포함)
  return freeIntervals.map((interval) => ({
    start: interval.start,
    end: interval.end,
    date: getDateStringInTz(interval.start, tz),
  }));
}

// ─── Function 3: reserveResearchQuota ───────────────────────────────────────

/**
 * 일자별 연구 쿼터를 자유 구간 중 가장 이른 시간부터 예약한다.
 *
 * - 각 날짜에서 dailyQuota(분)만큼을 이른 구간부터 연구용으로 예약
 * - 자유시간이 dailyQuota 미만이면 그날의 남은 자유시간 전체를 예약 + shortfall 보고
 * - 예약 구간은 researchPool, 나머지는 generalPool로 분리
 */
export function reserveResearchQuota(
  freeIntervals: FreeInterval[],
  dailyQuota: number,
): ReservedPools {
  const quotaMs = dailyQuota * MS_PER_MIN;
  const researchPool: FreeInterval[] = [];
  const generalPool: FreeInterval[] = [];
  const shortfalls: Array<{ date: string; shortfallMinutes: number }> = [];

  // 날짜별로 그룹화
  const byDate = new Map<string, FreeInterval[]>();
  for (const interval of freeIntervals) {
    const existing = byDate.get(interval.date) ?? [];
    existing.push(interval);
    byDate.set(interval.date, existing);
  }

  for (const [date, intervals] of byDate.entries()) {
    // 시간순 정렬 (이미 정렬되어 있어야 하지만 보장)
    intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

    let remainingQuota = quotaMs;

    for (const interval of intervals) {
      const intervalDuration =
        interval.end.getTime() - interval.start.getTime();

      if (remainingQuota <= 0) {
        // 쿼터 충족됨 → 일반 풀로
        generalPool.push(interval);
      } else if (intervalDuration <= remainingQuota) {

        // 전체 구간을 연구용으로 예약
        researchPool.push(interval);
        remainingQuota -= intervalDuration;
      } else {
        // 구간 분할: 앞부분은 연구, 뒷부분은 일반
        const splitPoint = new Date(
          interval.start.getTime() + remainingQuota,
        );
        researchPool.push({
          start: interval.start,
          end: splitPoint,
          date: interval.date,
        });
        generalPool.push({
          start: splitPoint,
          end: interval.end,
          date: interval.date,
        });
        remainingQuota = 0;
      }
    }

    // 쿼터 미달 시 shortfall 보고
    if (remainingQuota > 0) {
      shortfalls.push({
        date,
        shortfallMinutes: Math.ceil(remainingQuota / MS_PER_MIN),
      });
    }
  }

  return { researchPool, generalPool, shortfalls };
}

// ─── Function 4: allocateTasks ──────────────────────────────────────────────


/**
 * locked 윈도우가 주어진 구간과 겹치는 부분을 제외한 사용 가능 구간을 반환한다.
 */
function subtractLocks(
  intervalStart: number,
  intervalEnd: number,
  locks: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  let segments = [{ start: intervalStart, end: intervalEnd }];

  for (const lock of locks) {
    const newSegments: Array<{ start: number; end: number }> = [];
    for (const seg of segments) {
      if (seg.end <= lock.start || seg.start >= lock.end) {
        newSegments.push(seg);
      } else {
        if (seg.start < lock.start) {
          newSegments.push({ start: seg.start, end: lock.start });
        }
        if (seg.end > lock.end) {
          newSegments.push({ start: lock.end, end: seg.end });
        }
      }
    }
    segments = newSegments;
  }

  return segments;
}

/**
 * 우선순위 그리디 배치 알고리즘
 *
 * - PERSONAL_RESEARCH 태스크: researchPool 우선, 부족분은 generalPool
 * - 그 외 태스크: generalPool
 * - 풀의 구간을 시간순으로 순회하며, 매 슬롯마다 배치 가능한 최고 우선순위 태스크를 선택
 * - 세션 길이: min(remaining, maxFocus, slotRemaining, deadline까지) (>= minChunk 또는 최종 자투리)
 * - locked allocation은 사전 점유 (겹치지 않게 배치)
 * - 미배치 remaining은 atRisk로 보고
 */
export function allocateTasks(
  tasks: TaskInput[],
  pools: { researchPool: FreeInterval[]; generalPool: FreeInterval[] },
  locks: LockInput[],
  settings: {
    minChunkMin: number;
    maxFocusMin: number;
    bufferMin: number;
    urgencyWeight: number;
    importanceWeight: number;
  },
  now: Date,
): {
  allocations: Array<{ taskId: string; title: string; start: Date; end: Date }>;
  atRisk: Array<{
    taskId: string;
    title: string;
    unplacedMinutes: number;
    reason: UnscheduledReason;
    suggestion: string;
  }>;
} {

  const minChunkMs = settings.minChunkMin * MS_PER_MIN;
  const maxFocusMs = settings.maxFocusMin * MS_PER_MIN;
  const bufferMs = settings.bufferMin * MS_PER_MIN;

  const allocations: Array<{ taskId: string; title: string; start: Date; end: Date }> = [];

  // 남은 시간 추적
  const remainingMap = new Map<string, number>();
  for (const task of tasks) {
    const remaining = Math.max(task.estimatedMinutes - task.completedMinutes, 0);
    remainingMap.set(task.id, remaining * MS_PER_MIN);
  }

  // locks를 ms 기반으로 변환
  const locksMs = locks.map((l) => ({
    taskId: l.taskId,
    start: l.start.getTime(),
    end: l.end.getTime(),
  }));

  // 연구 태스크와 일반 태스크 분리
  const researchTasks = tasks.filter(
    (t) => t.category === TaskCategory.PERSONAL_RESEARCH,
  );
  const generalTasks = tasks.filter(
    (t) => t.category !== TaskCategory.PERSONAL_RESEARCH,
  );

  /**
   * 주어진 풀에서 주어진 태스크 목록을 그리디 배치한다.
   */
  function fillPool(
    pool: FreeInterval[],
    eligibleTasks: TaskInput[],
  ): void {
    const sortedPool = [...pool].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );

    for (const interval of sortedPool) {
      // locked 윈도우를 제외한 사용 가능 세그먼트 도출
      const segments = subtractLocks(
        interval.start.getTime(),
        interval.end.getTime(),
        locksMs,
      );


      for (const seg of segments) {
        let cursor = seg.start;

        while (cursor + minChunkMs <= seg.end) {
          // 배치 가능한 후보: remaining > 0, earliestStart <= cursor, deadline > cursor
          const candidates = eligibleTasks.filter((t) => {
            const remaining = remainingMap.get(t.id) ?? 0;
            if (remaining <= 0) return false;
            if (t.earliestStart && t.earliestStart.getTime() > cursor) return false;
            if (t.deadline.getTime() <= cursor) return false;
            return true;
          });

          if (candidates.length === 0) break;

          // 우선순위 산정 후 최고 우선순위 선택
          const cursorDate = new Date(cursor);
          const scored = candidates.map((t) => {
            const priority = computePriority(
              {
                estimatedMinutes: t.estimatedMinutes,
                completedMinutes:
                  t.estimatedMinutes -
                  (remainingMap.get(t.id) ?? 0) / MS_PER_MIN,
                deadline: t.deadline,
                importance: t.importance,
              },
              cursorDate,
              {
                urgencyWeight: settings.urgencyWeight,
                importanceWeight: settings.importanceWeight,
              },
            );
            return { task: t, priority };
          });

          // comparePriority로 정렬하여 최우선 태스크 선택
          scored.sort((a, b) =>
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


          const selected = scored[0].task;
          const remaining = remainingMap.get(selected.id) ?? 0;

          // 세션 길이 계산
          const slotRemaining = seg.end - cursor;
          const deadlineRemaining = selected.deadline.getTime() - cursor;
          let sessionMs = Math.min(
            remaining,
            maxFocusMs,
            slotRemaining,
            deadlineRemaining,
          );

          // minChunk 보장 (최종 자투리 예외: remaining < minChunk이면 허용)
          if (sessionMs < minChunkMs) {
            if (remaining < minChunkMs) {
              // 최종 자투리 허용 — remaining 전체를 배치 (단, 슬롯/마감 내에서)
              sessionMs = Math.min(remaining, slotRemaining, deadlineRemaining);
              if (sessionMs <= 0) break;
            } else {
              // 슬롯이 부족하므로 다음 구간으로
              break;
            }
          }

          // 할당 생성
          const sessionEnd = cursor + sessionMs;
          allocations.push({
            taskId: selected.id,
            title: selected.title,
            start: new Date(cursor),
            end: new Date(sessionEnd),
          });

          // remaining 차감
          remainingMap.set(selected.id, remaining - sessionMs);

          // cursor 전진 (세션 + 버퍼)
          cursor = sessionEnd + bufferMs;
        }
      }
    }
  }

  // 연구 태스크: researchPool 먼저, 부족분은 generalPool
  fillPool(pools.researchPool, researchTasks);
  fillPool(pools.generalPool, researchTasks);

  // 일반 태스크: generalPool에서만 배치
  fillPool(pools.generalPool, generalTasks);


  // at-risk 태스크 식별
  const atRisk: Array<{
    taskId: string;
    title: string;
    unplacedMinutes: number;
    reason: UnscheduledReason;
    suggestion: string;
  }> = [];

  for (const task of tasks) {
    const remaining = remainingMap.get(task.id) ?? 0;
    if (remaining > 0) {
      const unplacedMinutes = Math.ceil(remaining / MS_PER_MIN);

      // 사유 판단: 마감 전에 용량이 부족했는지, 호라이즌 전체 용량이 부족했는지
      const deadlineMs = task.deadline.getTime();
      const nowMs = now.getTime();

      // 마감까지 남은 시간 내에 공간이 있었는지 확인
      let reason: UnscheduledReason;
      let suggestion: string;

      if (deadlineMs <= nowMs) {
        // 이미 마감 초과
        reason = UnscheduledReason.DEADLINE_BEFORE_CAPACITY;
        suggestion = '마감을 연장하세요';
      } else {
        // 마감 전에 배치할 공간이 부족했는지 판단
        // 마감 이전 pool에 남은 용량 확인
        const capacityBeforeDeadline = [
          ...pools.researchPool,
          ...pools.generalPool,
        ]
          .filter(
            (i) =>
              i.start.getTime() < deadlineMs &&
              i.end.getTime() > nowMs,
          )
          .reduce((sum, i) => {
            const effectiveStart = Math.max(i.start.getTime(), nowMs);
            const effectiveEnd = Math.min(i.end.getTime(), deadlineMs);
            return sum + Math.max(0, effectiveEnd - effectiveStart);
          }, 0);

        if (capacityBeforeDeadline < remaining) {
          reason = UnscheduledReason.DEADLINE_BEFORE_CAPACITY;
          suggestion = '마감을 연장하세요';
        } else {
          reason = UnscheduledReason.HORIZON_CAPACITY_EXHAUSTED;
          suggestion = 'horizon을 확장하세요';
        }
      }

      atRisk.push({
        taskId: task.id,
        title: task.title,
        unplacedMinutes,
        reason,
        suggestion,
      });
    }
  }

  return { allocations, atRisk };
}


// ─── Function 5: generateSchedule ───────────────────────────────────────────

/**
 * 전체 스케줄링 파이프라인 오케스트레이션:
 * 1. materializeFixedBlocks → 고정 블록 인스턴스
 * 2. SLEEP / 비-SLEEP 분리
 * 3. deriveFreeIntervals → 자유 구간
 * 4. reserveResearchQuota → 연구 풀 / 일반 풀 분리
 * 5. allocateTasks → 태스크 배치 + atRisk
 * 6. 고정 블록 + 연구 예약 + 태스크 배치 결합 → SchedulePlan
 */
export function generateSchedule(input: {
  tasks: TaskInput[];
  fixedBlocks: FixedBlockInput[];
  settings: ScheduleSettings;
  locks: LockInput[];
  horizonStart: Date;
  horizonEnd: Date;
  now: Date;
  tz: string;
}): SchedulePlan {
  const { tasks, fixedBlocks, settings, locks, horizonStart, horizonEnd, now, tz } = input;

  // 1. 고정 블록 전개
  const materialized = materializeFixedBlocks(
    fixedBlocks,
    { start: horizonStart, end: horizonEnd },
    tz,
  );

  // 2. SLEEP / 비-SLEEP 분리
  const sleepBlocks = materialized.filter((b) => b.type === 'SLEEP');
  const nonSleepMaterialized = materialized.filter((b) => b.type !== 'SLEEP');

  // 3. 자유 구간 도출
  const freeIntervals = deriveFreeIntervals(
    nonSleepMaterialized,
    {
      bufferMin: settings.bufferMin,
      windDownMin: settings.windDownMin,
      minChunkMin: settings.minChunkMin,
    },
    sleepBlocks,
    now,
    tz,
  );

  // 4. 연구 쿼터 선확보
  const reservedPools = reserveResearchQuota(
    freeIntervals,
    settings.researchQuotaMin,
  );


  // 5. 태스크 배치
  const { allocations: taskAllocations, atRisk } = allocateTasks(
    tasks,
    {
      researchPool: reservedPools.researchPool,
      generalPool: reservedPools.generalPool,
    },
    locks,
    {
      minChunkMin: settings.minChunkMin,
      maxFocusMin: settings.maxFocusMin,
      bufferMin: settings.bufferMin,
      urgencyWeight: settings.urgencyWeight,
      importanceWeight: settings.importanceWeight,
    },
    now,
  );

  // 6. 최종 allocations 구성
  const allAllocations: TimeBlock[] = [];

  // 고정 블록 → FIXED allocation
  for (const fb of materialized) {
    allAllocations.push({
      kind: AllocationKind.FIXED,
      fixedBlockId: fb.fixedBlockId,
      title: fb.title,
      start: fb.start.toISOString(),
      end: fb.end.toISOString(),
      locked: false,
    });
  }

  // 연구 예약 블록 중 태스크로 채워지지 않은 부분 → RESEARCH_RESERVED
  // 연구 풀에서 실제 배치된 태스크 시간을 제외한 남은 구간을 예약 블록으로 표시
  const researchAllocatedMs = new Map<string, number>();
  for (const alloc of taskAllocations) {
    const task = tasks.find((t) => t.id === alloc.taskId);
    if (task && task.category === TaskCategory.PERSONAL_RESEARCH) {
      // 연구 풀 내에서 배치된 시간 추적
      for (const rp of reservedPools.researchPool) {
        const overlapStart = Math.max(
          alloc.start.getTime(),
          rp.start.getTime(),
        );
        const overlapEnd = Math.min(alloc.end.getTime(), rp.end.getTime());
        if (overlapEnd > overlapStart) {
          const key = `${rp.start.getTime()}-${rp.end.getTime()}`;
          researchAllocatedMs.set(
            key,
            (researchAllocatedMs.get(key) ?? 0) + (overlapEnd - overlapStart),
          );
        }
      }
    }
  }


  // 미사용된 연구 예약 구간을 RESEARCH_RESERVED로 추가
  for (const rp of reservedPools.researchPool) {
    const key = `${rp.start.getTime()}-${rp.end.getTime()}`;
    const used = researchAllocatedMs.get(key) ?? 0;
    const totalMs = rp.end.getTime() - rp.start.getTime();
    if (used < totalMs) {
      // 미사용 부분이 있으면 예약 블록으로 표시
      // 단순화: 전체 연구 풀 구간 중 태스크가 배치되지 않은 부분을 찾아 추가
      // 여기서는 연구 풀 구간 전체를 순회하며 태스크 배치와 겹치지 않는 부분을 찾는다
      let segments = [{ start: rp.start.getTime(), end: rp.end.getTime() }];

      for (const alloc of taskAllocations) {
        const allocStart = alloc.start.getTime();
        const allocEnd = alloc.end.getTime();
        const newSegments: Array<{ start: number; end: number }> = [];
        for (const seg of segments) {
          if (seg.end <= allocStart || seg.start >= allocEnd) {
            newSegments.push(seg);
          } else {
            if (seg.start < allocStart) {
              newSegments.push({ start: seg.start, end: allocStart });
            }
            if (seg.end > allocEnd) {
              newSegments.push({ start: allocEnd, end: seg.end });
            }
          }
        }
        segments = newSegments;
      }

      for (const seg of segments) {
        if (seg.end - seg.start >= MS_PER_MIN) {
          allAllocations.push({
            kind: AllocationKind.RESEARCH_RESERVED,
            title: '연구 시간 (예약)',
            start: new Date(seg.start).toISOString(),
            end: new Date(seg.end).toISOString(),
            locked: false,
          });
        }
      }
    }
  }


  // 태스크 배치 → TASK allocation
  for (const alloc of taskAllocations) {
    const isLocked = locks.some(
      (l) =>
        l.taskId === alloc.taskId &&
        l.start.getTime() === alloc.start.getTime() &&
        l.end.getTime() === alloc.end.getTime(),
    );
    allAllocations.push({
      kind: AllocationKind.TASK,
      taskId: alloc.taskId,
      title: alloc.title,
      start: alloc.start.toISOString(),
      end: alloc.end.toISOString(),
      locked: isLocked,
    });
  }

  // 시간순 정렬
  allAllocations.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  // dayCapacityWarnings 생성
  const dayCapacityWarnings: Array<{ date: string; message: string }> = [];

  // 연구 쿼터 shortfall 보고
  for (const sf of reservedPools.shortfalls) {
    dayCapacityWarnings.push({
      date: sf.date,
      message: `연구 쿼터 부족: ${sf.shortfallMinutes}분 부족`,
    });
  }

  // 자유시간이 0인 날 보고 (호라이즌 내의 모든 날 확인)
  const allDays = enumerateDays(horizonStart, horizonEnd, tz);
  const daysWithFreeTime = new Set(freeIntervals.map((i) => i.date));
  for (const { dateStr } of allDays) {
    if (!daysWithFreeTime.has(dateStr)) {
      dayCapacityWarnings.push({
        date: dateStr,
        message: '가용 시간 없음: 이 날은 자유 시간이 없습니다',
      });
    }
  }


  // atRisk → UnscheduledTask 형태
  const unscheduledTasks: UnscheduledTask[] = atRisk.map((r) => ({
    taskId: r.taskId,
    title: r.title,
    unplacedMinutes: r.unplacedMinutes,
    reason: r.reason,
    suggestion: r.suggestion,
  }));

  return {
    generatedAt: now.toISOString(),
    horizonStart: horizonStart.toISOString(),
    horizonEnd: horizonEnd.toISOString(),
    allocations: allAllocations,
    atRisk: unscheduledTasks,
    dayCapacityWarnings,
  };
}
