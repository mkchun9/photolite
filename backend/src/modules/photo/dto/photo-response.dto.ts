/**
 * 개별 이미지 응답 DTO
 */
export class PhotoResponse {
  /** 고유 식별자 (UUID) */
  id: string;

  /** 원본 파일명 */
  fileName: string;

  /** aHash (64-bit, 16자 hex string) */
  hash: string;

  /** 원본 파일 크기 (bytes) */
  originalBytes: number;

  /** 최적화 후 파일 크기 (bytes) */
  optimizedBytes: number;

  /** 최적화 이미지 너비 (px) */
  width: number;

  /** 최적화 이미지 높이 (px) */
  height: number;

  /** 업로드 시간 (ISO 8601) */
  createdAt: Date;

  /** 썸네일 URL (최대 300px) */
  thumbnailUrl: string;

  /** 풀 해상도 URL */
  fullUrl: string;

  /** 절약률 (%, 소수점 1자리) */
  savingsPercent: number;

  /** 중복 여부 */
  isDuplicate: boolean;
}

/**
 * 페이지네이션 메타데이터
 */
export class PaginationMeta {
  /** 전체 이미지 수 */
  totalCount: number;

  /** 현재 페이지 번호 */
  currentPage: number;

  /** 전체 페이지 수 */
  totalPages: number;

  /** 페이지당 이미지 수 */
  pageSize: number;
}

/**
 * 갤러리 목록 응답 DTO (페이지네이션 포함)
 */
export class PaginatedGalleryResponse {
  /** 이미지 목록 */
  images: PhotoResponse[];

  /** 페이지네이션 메타데이터 */
  pagination: PaginationMeta;
}

/**
 * 절약 통계 응답 DTO
 */
export class StatisticsResponse {
  /** 전체 이미지 수 */
  count: number;

  /** 전체 원본 크기 합계 (bytes) */
  totalOriginalBytes: number;

  /** 전체 최적화 크기 합계 (bytes) */
  totalOptimizedBytes: number;

  /** 절약된 용량 (bytes) */
  savedBytes: number;

  /** 절약률 (%, 소수점 2자리) */
  savedPercent: number;

  /** 중복으로 감지된 이미지 수 */
  duplicateCount: number;
}
