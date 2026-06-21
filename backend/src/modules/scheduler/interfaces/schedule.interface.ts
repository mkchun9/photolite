import { AllocationKind, UnscheduledReason } from '../scheduler.constants';

export interface TimeBlock {
  kind: AllocationKind;
  taskId?: string;
  fixedBlockId?: string;
  title: string;
  start: string; // ISO 8601
  end: string;
  locked: boolean;
}

export interface FreeInterval {
  start: Date;
  end: Date;
  date: string; // YYYY-MM-DD
}

export interface UnscheduledTask {
  taskId: string;
  title: string;
  unplacedMinutes: number;
  reason: UnscheduledReason;
  suggestion: string;
}

export interface SchedulePlan {
  generatedAt: string;
  horizonStart: string;
  horizonEnd: string;
  allocations: TimeBlock[];
  atRisk: UnscheduledTask[];
  dayCapacityWarnings: Array<{ date: string; message: string }>;
}

export interface ReservedPools {
  researchPool: FreeInterval[];
  generalPool: FreeInterval[];
  shortfalls: Array<{ date: string; shortfallMinutes: number }>;
}

export interface MaterializedBlock {
  fixedBlockId: string;
  type: string;
  title: string;
  start: Date;
  end: Date;
}
