/**
 * Photo 모듈 상수 정의
 * 모든 매직넘버를 상수로 추출하여 유지보수성 및 가독성을 높인다.
 */

/** 중복 판정 Hamming Distance 임계값 (이하이면 중복) */
export const DUPLICATE_HAMMING_THRESHOLD = 5;

/** 이미지 리사이즈 최대 너비 (px) */
export const MAX_WIDTH = 1920;

/** 이미지 리사이즈 최대 높이 (px) */
export const MAX_HEIGHT = 1080;

/** WebP 변환 품질 (0~100) */
export const WEBP_QUALITY = 80;

/** 단일 파일 최대 크기 (bytes, 15MB) */
export const MAX_FILE_SIZE = 15_728_640;

/** 한 요청당 최대 파일 개수 */
export const MAX_FILES_PER_REQUEST = 10;

/** 갤러리 기본 페이지 크기 */
export const DEFAULT_PAGE_SIZE = 20;

/** 갤러리 최대 페이지 크기 */
export const MAX_PAGE_SIZE = 100;
