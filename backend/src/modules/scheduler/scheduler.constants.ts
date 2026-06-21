/** 우선순위 가중치 */
export const DEFAULT_URGENCY_WEIGHT = 0.6;
export const DEFAULT_IMPORTANCE_WEIGHT = 0.4;
export const URGENCY_CAP = 2.0;

/** 중요도 범위 */
export const MIN_IMPORTANCE = 1;
export const MAX_IMPORTANCE = 5;

/** 연구 쿼터 */
export const DEFAULT_RESEARCH_QUOTA_MIN = 180;

/** 버퍼 및 제한 */
export const DEFAULT_BUFFER_MIN = 10;
export const DEFAULT_WIND_DOWN_MIN = 30;
export const DEFAULT_MIN_CHUNK_MIN = 25;
export const DEFAULT_MAX_FOCUS_MIN = 120;

/** 남은 기한 분류 임계값 (시간) */
export const CRITICAL_HOURS = 24;
export const WARNING_HOURS = 72;

/** AI 추천 */
export const AI_SUITABILITY_THRESHOLD = 0.5;
export const CATEGORY_AI_BASE: Record<string, number> = {
  DOCUMENT: 0.9,
  PERSONAL_RESEARCH: 0.8,
  ASSIGNMENT: 0.7,
  STUDY: 0.6,
  CLASS_PREP: 0.5,
  EXAM: 0.5,
  OTHER: 0.4,
};
export const AI_BOOST_KEYWORDS = ['요약', '번역', '초안', '작성', '정리', '리뷰', '분석', '코드', '디버그', 'draft', 'summary', 'review', 'code'];
export const AI_PENALTY_KEYWORDS = ['실험', '촬영', '대면', '미팅', '발표', '인터뷰', '설문', 'lab', 'meeting', 'present'];

/** 기본 타임존 */
export const DEFAULT_TIMEZONE = 'Asia/Seoul';

/** 카테고리 Enum */
export enum TaskCategory {
  DOCUMENT = 'DOCUMENT',
  ASSIGNMENT = 'ASSIGNMENT',
  PERSONAL_RESEARCH = 'PERSONAL_RESEARCH',
  STUDY = 'STUDY',
  CLASS_PREP = 'CLASS_PREP',
  EXAM = 'EXAM',
  OTHER = 'OTHER',
}

/** 고정 블록 타입 Enum */
export enum FixedBlockType {
  SLEEP = 'SLEEP',
  MEAL = 'MEAL',
  EXERCISE = 'EXERCISE',
  CLASS = 'CLASS',
  CUSTOM = 'CUSTOM',
}

/** 태스크 상태 Enum */
export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  ARCHIVED = 'ARCHIVED',
}

/** 남은 기한 분류 Enum */
export enum DeadlineClassification {
  OVERDUE = 'OVERDUE',
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  NORMAL = 'NORMAL',
}

/** Allocation 종류 Enum */
export enum AllocationKind {
  FIXED = 'FIXED',
  TASK = 'TASK',
  RESEARCH_RESERVED = 'RESEARCH_RESERVED',
}

/** at-risk 사유 Enum */
export enum UnscheduledReason {
  DEADLINE_BEFORE_CAPACITY = 'DEADLINE_BEFORE_CAPACITY',
  HORIZON_CAPACITY_EXHAUSTED = 'HORIZON_CAPACITY_EXHAUSTED',
}
