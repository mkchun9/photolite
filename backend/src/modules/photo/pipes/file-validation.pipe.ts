import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { MAX_FILE_SIZE, MAX_FILES_PER_REQUEST } from '../photo.constants';

/**
 * 허용 MIME 타입 목록
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/**
 * Magic bytes 시그니처 정의
 * 실제 파일 콘텐츠의 첫 바이트를 검사하여 파일 유형을 확인한다.
 */
const MAGIC_BYTES: ReadonlyArray<{
  mime: string;
  bytes: number[];
  offset?: number;
  additionalCheck?: (buffer: Buffer) => boolean;
}> = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WebP: RIFF....WEBP (offset 0에서 RIFF, offset 8에서 WEBP)
  {
    mime: 'image/webp',
    bytes: [0x52, 0x49, 0x46, 0x46], // "RIFF"
    additionalCheck: (buffer: Buffer): boolean => {
      if (buffer.length < 12) return false;
      // offset 8~11: "WEBP" (0x57 0x45 0x42 0x50)
      return (
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );
    },
  },
];

/**
 * 에러 응답 생성 헬퍼
 */
function createErrorResponse(
  error: string,
  message: string,
  details?: Record<string, any>,
): { error: string; message: string; details?: Record<string, any>; timestamp: string } {
  return {
    error,
    message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  };
}

/**
 * FileValidationPipe - 업로드된 파일 배열을 검증하는 NestJS 커스텀 파이프
 *
 * 검증 항목:
 * 1. 배치 최대 10개 제한 (MAX_FILES_PER_REQUEST)
 * 2. 빈 파일(0 bytes) 거부
 * 3. 파일 크기 검증 (15MB 상한, MAX_FILE_SIZE)
 * 4. MIME 타입 검증 (image/jpeg, image/png, image/webp)
 * 5. Magic bytes 검증 (실제 파일 콘텐츠 검사)
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */
@Injectable()
export class FileValidationPipe implements PipeTransform {
  transform(files: Express.Multer.File[]): Express.Multer.File[] {
    // 파일 배열 존재 여부 확인
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new BadRequestException(
        createErrorResponse(
          'EMPTY_FILE',
          '업로드할 파일이 없습니다.',
        ),
      );
    }

    // 1. 배치 최대 10개 제한 (Requirement 1.7)
    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new BadRequestException(
        createErrorResponse(
          'TOO_MANY_FILES',
          `한 요청당 최대 ${MAX_FILES_PER_REQUEST}개의 파일만 업로드할 수 있습니다.`,
          { maxFiles: MAX_FILES_PER_REQUEST, received: files.length },
        ),
      );
    }

    // 2~5. 각 파일에 대해 독립적으로 검증 (Requirement 1.4)
    for (const file of files) {
      this.validateFile(file);
    }

    return files;
  }

  /**
   * 개별 파일 검증
   * 빈 파일 → 크기 초과 → MIME 타입 → Magic bytes 순서로 검증
   */
  private validateFile(file: Express.Multer.File): void {
    // 2. 빈 파일 거부 (Requirement 1.6)
    if (!file.buffer || file.size === 0) {
      throw new BadRequestException(
        createErrorResponse(
          'EMPTY_FILE',
          `파일이 비어 있습니다: ${file.originalname}`,
          { fileName: file.originalname },
        ),
      );
    }

    // 3. 파일 크기 검증 (Requirement 1.2)
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        createErrorResponse(
          'FILE_TOO_LARGE',
          `파일 크기가 15MB를 초과합니다: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
          {
            fileName: file.originalname,
            fileSize: file.size,
            maxSize: MAX_FILE_SIZE,
          },
        ),
      );
    }

    // 4. MIME 타입 검증 (Requirement 1.1, 1.3)
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_MIME_TYPES[number])) {
      throw new BadRequestException(
        createErrorResponse(
          'UNSUPPORTED_FORMAT',
          `지원하지 않는 파일 형식입니다: ${file.originalname} (${file.mimetype}). 지원 형식: JPEG, PNG, WebP`,
          {
            fileName: file.originalname,
            receivedMime: file.mimetype,
            supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
          },
        ),
      );
    }

    // 5. Magic bytes 검증 (Requirement 1.5)
    if (!this.validateMagicBytes(file.buffer)) {
      throw new BadRequestException(
        createErrorResponse(
          'INVALID_CONTENT',
          `파일 내용이 지원되는 이미지 형식과 일치하지 않습니다: ${file.originalname}`,
          { fileName: file.originalname },
        ),
      );
    }
  }

  /**
   * Magic bytes를 검사하여 파일이 실제로 지원되는 이미지 형식인지 확인
   * JPEG: FF D8 FF
   * PNG: 89 50 4E 47 0D 0A 1A 0A
   * WebP: RIFF....WEBP (offset 0: RIFF, offset 8: WEBP)
   */
  private validateMagicBytes(buffer: Buffer): boolean {
    if (!buffer || buffer.length === 0) {
      return false;
    }

    for (const signature of MAGIC_BYTES) {
      const offset = signature.offset ?? 0;

      // 버퍼 길이가 시그니처보다 짧으면 스킵
      if (buffer.length < offset + signature.bytes.length) {
        continue;
      }

      // 기본 바이트 매칭
      let matches = true;
      for (let i = 0; i < signature.bytes.length; i++) {
        if (buffer[offset + i] !== signature.bytes[i]) {
          matches = false;
          break;
        }
      }

      if (!matches) {
        continue;
      }

      // 추가 검증이 있으면 수행 (WebP의 경우)
      if (signature.additionalCheck) {
        if (signature.additionalCheck(buffer)) {
          return true;
        }
        continue;
      }

      return true;
    }

    return false;
  }
}
