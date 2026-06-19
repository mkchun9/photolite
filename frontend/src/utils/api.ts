/** API 베이스 URL - Next.js rewrites를 통해 백엔드로 프록시됨 */
export const API_BASE_URL = "/api";

/** 업로드 관련 상수 */
export const UPLOAD_CONSTANTS = {
  MAX_FILES: 10,
  MAX_FILE_SIZE: 15_728_640, // 15MB in bytes
  ALLOWED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp"] as const,
  UPLOAD_ENDPOINT: `${"/api"}/photos/upload`,
} as const;

/** 파일 크기를 사람이 읽을 수 있는 형태로 변환 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(1);
  return `${size} ${units[i]}`;
}

/** MIME 타입이 허용된 이미지 형식인지 검증 */
export function isAllowedMimeType(type: string): boolean {
  return (UPLOAD_CONSTANTS.ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

/** 파일 크기가 제한 이내인지 검증 */
export function isWithinSizeLimit(size: number): boolean {
  return size <= UPLOAD_CONSTANTS.MAX_FILE_SIZE;
}

/** 업로드 응답 타입 */
export interface UploadResultItem {
  success: boolean;
  id?: string;
  fileName: string;
  originalBytes: number;
  optimizedBytes?: number;
  isDuplicate?: boolean;
  duplicateStatus?: string;
  error?: string;
  errorCode?: string;
}

export interface UploadResponse {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  results: UploadResultItem[];
}

/** 파일 검증 에러 타입 */
export interface FileValidationError {
  fileName: string;
  reason: string;
}

/** 클라이언트 사전 검증: 파일 배열에 대해 타입/크기/개수를 확인 */
export function validateFiles(files: File[]): {
  validFiles: File[];
  errors: FileValidationError[];
} {
  const errors: FileValidationError[] = [];
  const validFiles: File[] = [];

  if (files.length > UPLOAD_CONSTANTS.MAX_FILES) {
    // 초과된 파일 목록에 에러 추가
    files.slice(UPLOAD_CONSTANTS.MAX_FILES).forEach((file) => {
      errors.push({
        fileName: file.name,
        reason: `최대 ${UPLOAD_CONSTANTS.MAX_FILES}개까지 업로드할 수 있습니다.`,
      });
    });
    // 최대 개수만큼만 검증 대상으로
    files = files.slice(0, UPLOAD_CONSTANTS.MAX_FILES);
  }

  for (const file of files) {
    if (!isAllowedMimeType(file.type)) {
      errors.push({
        fileName: file.name,
        reason: "지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP만 가능)",
      });
      continue;
    }

    if (!isWithinSizeLimit(file.size)) {
      errors.push({
        fileName: file.name,
        reason: `파일 크기가 15MB를 초과합니다. (${formatFileSize(file.size)})`,
      });
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
}
