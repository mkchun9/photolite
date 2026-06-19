import { BadRequestException } from '@nestjs/common';
import { FileValidationPipe } from './file-validation.pipe';
import { MAX_FILE_SIZE, MAX_FILES_PER_REQUEST } from '../photo.constants';

describe('FileValidationPipe', () => {
  let pipe: FileValidationPipe;

  beforeEach(() => {
    pipe = new FileValidationPipe();
  });

  /**
   * 유효한 테스트용 Multer 파일 객체 생성 헬퍼
   */
  function createMockFile(
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File {
    // 기본: 유효한 JPEG 파일 (FF D8 FF magic bytes)
    const defaultBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const buffer = overrides.buffer !== undefined ? overrides.buffer : defaultBuffer;
    return {
      fieldname: 'files',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: buffer ? buffer.length : 0,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
      ...overrides,
    } as Express.Multer.File;
  }

  /**
   * PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
   */
  function createPngBuffer(): Buffer {
    return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  }

  /**
   * WebP magic bytes: RIFF....WEBP
   */
  function createWebpBuffer(): Buffer {
    const buf = Buffer.alloc(16);
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
    buf[4] = 0x00; buf[5] = 0x00; buf[6] = 0x00; buf[7] = 0x00;
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50;
    buf[12] = 0x00; buf[13] = 0x00; buf[14] = 0x00; buf[15] = 0x00;
    return buf;
  }

  /**
   * 에러 응답 추출 헬퍼
   */
  function getErrorResponse(fn: () => void): any {
    try {
      fn();
      throw new Error('Expected BadRequestException to be thrown');
    } catch (e) {
      if (e instanceof BadRequestException) {
        return e.getResponse();
      }
      throw e;
    }
  }

  describe('파일 배열 검증', () => {
    it('파일이 null이면 BadRequestException을 던져야 함', () => {
      expect(() => pipe.transform(null as any)).toThrow(BadRequestException);
    });

    it('파일이 빈 배열이면 BadRequestException을 던져야 함', () => {
      expect(() => pipe.transform([])).toThrow(BadRequestException);
    });

    it('파일이 배열이 아니면 BadRequestException을 던져야 함', () => {
      expect(() => pipe.transform(undefined as any)).toThrow(BadRequestException);
    });
  });

  describe('배치 파일 개수 제한 (Requirement 1.7)', () => {
    it(`${MAX_FILES_PER_REQUEST}개 이하의 파일은 통과해야 함`, () => {
      const files = Array.from({ length: MAX_FILES_PER_REQUEST }, () => createMockFile());
      const result = pipe.transform(files);
      expect(result).toHaveLength(MAX_FILES_PER_REQUEST);
    });

    it(`${MAX_FILES_PER_REQUEST}개 초과 시 TOO_MANY_FILES 에러를 반환해야 함`, () => {
      const files = Array.from({ length: MAX_FILES_PER_REQUEST + 1 }, () => createMockFile());
      const response = getErrorResponse(() => pipe.transform(files));
      expect(response.error).toBe('TOO_MANY_FILES');
      expect(response.details.maxFiles).toBe(MAX_FILES_PER_REQUEST);
    });
  });

  describe('빈 파일 거부 (Requirement 1.6)', () => {
    it('size가 0인 파일은 EMPTY_FILE 에러를 반환해야 함', () => {
      const file = createMockFile({ size: 0, buffer: Buffer.alloc(0) });
      const response = getErrorResponse(() => pipe.transform([file]));
      expect(response.error).toBe('EMPTY_FILE');
    });

    it('buffer가 없는 파일은 EMPTY_FILE 에러를 반환해야 함', () => {
      const file = createMockFile({ size: 0, buffer: null as any });
      const response = getErrorResponse(() => pipe.transform([file]));
      expect(response.error).toBe('EMPTY_FILE');
    });
  });

  describe('파일 크기 검증 (Requirement 1.2)', () => {
    it('15MB 이하 파일은 통과해야 함', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const file = createMockFile({ size: MAX_FILE_SIZE, buffer });
      const result = pipe.transform([file]);
      expect(result).toHaveLength(1);
    });

    it('15MB 초과 파일은 FILE_TOO_LARGE 에러를 반환해야 함', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const file = createMockFile({ size: MAX_FILE_SIZE + 1, buffer });
      const response = getErrorResponse(() => pipe.transform([file]));
      expect(response.error).toBe('FILE_TOO_LARGE');
      expect(response.details.maxSize).toBe(MAX_FILE_SIZE);
    });
  });

  describe('MIME 타입 검증 (Requirement 1.1, 1.3)', () => {
    it('image/jpeg는 통과해야 함', () => {
      const file = createMockFile({ mimetype: 'image/jpeg' });
      const result = pipe.transform([file]);
      expect(result).toHaveLength(1);
    });

    it('image/png는 통과해야 함', () => {
      const buffer = createPngBuffer();
      const file = createMockFile({ mimetype: 'image/png', buffer });
      const result = pipe.transform([file]);
      expect(result).toHaveLength(1);
    });

    it('image/webp는 통과해야 함', () => {
      const buffer = createWebpBuffer();
      const file = createMockFile({ mimetype: 'image/webp', buffer });
      const result = pipe.transform([file]);
      expect(result).toHaveLength(1);
    });

    it('지원하지 않는 MIME 타입은 UNSUPPORTED_FORMAT 에러를 반환해야 함', () => {
      const file = createMockFile({ mimetype: 'image/gif' });
      const response = getErrorResponse(() => pipe.transform([file]));
      expect(response.error).toBe('UNSUPPORTED_FORMAT');
      expect(response.details.supportedFormats).toEqual([
        'image/jpeg',
        'image/png',
        'image/webp',
      ]);
    });

    it('application/pdf는 UNSUPPORTED_FORMAT 에러를 반환해야 함', () => {
      const file = createMockFile({ mimetype: 'application/pdf' });
      const response = getErrorResponse(() => pipe.transform([file]));
      expect(response.error).toBe('UNSUPPORTED_FORMAT');
    });
  });

  describe('Magic bytes 검증 (Requirement 1.5)', () => {
    it('유효한 JPEG magic bytes (FF D8 FF)는 통과해야 함', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x00, 0x00]);
      const file = createMockFile({ buffer, mimetype: 'image/jpeg' });
      const result = pipe.transform([file]);
      expect(result).toHaveLength(1);
    });

    it('유효한 PNG magic bytes는 통과해야 함', () => {
      const buffer = createPngBuffer();
      const file = createMockFile({ buffer, mimetype: 'image/png' });
      const result = pipe.transform([file]);
      expect(result).toHaveLength(1);
    });

    it('유효한 WebP magic bytes (RIFF....WEBP)는 통과해야 함', () => {
      const buffer = createWebpBuffer();
      const file = createMockFile({ buffer, mimetype: 'image/webp' });
      const result = pipe.transform([file]);
      expect(result).toHaveLength(1);
    });

    it('잘못된 magic bytes는 INVALID_CONTENT 에러를 반환해야 함', () => {
      // 랜덤 바이트 (어떤 유효한 이미지 시그니처도 아님)
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const file = createMockFile({ buffer, mimetype: 'image/jpeg' });
      const response = getErrorResponse(() => pipe.transform([file]));
      expect(response.error).toBe('INVALID_CONTENT');
    });

    it('MIME는 image/jpeg이지만 PNG magic bytes인 경우에도 통과해야 함 (magic bytes 기준 검증)', () => {
      // magic bytes가 지원되는 이미지 형식 중 하나이면 통과
      const buffer = createPngBuffer();
      const file = createMockFile({ buffer, mimetype: 'image/jpeg' });
      const result = pipe.transform([file]);
      expect(result).toHaveLength(1);
    });

    it('RIFF 시그니처이지만 WEBP가 아닌 경우 INVALID_CONTENT를 반환해야 함', () => {
      const buf = Buffer.alloc(16);
      // "RIFF" at offset 0
      buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
      // file size
      buf[4] = 0x00; buf[5] = 0x00; buf[6] = 0x00; buf[7] = 0x00;
      // "AVI " instead of "WEBP" at offset 8
      buf[8] = 0x41; buf[9] = 0x56; buf[10] = 0x49; buf[11] = 0x20;
      const file = createMockFile({ buffer: buf, mimetype: 'image/webp' });
      const response = getErrorResponse(() => pipe.transform([file]));
      expect(response.error).toBe('INVALID_CONTENT');
    });
  });

  describe('에러 응답 구조', () => {
    it('에러 응답에 timestamp가 ISO 8601 형식으로 포함되어야 함', () => {
      const file = createMockFile({ size: 0, buffer: Buffer.alloc(0) });
      const response = getErrorResponse(() => pipe.transform([file]));
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
    });

    it('에러 응답에 error 필드와 message 필드가 포함되어야 함', () => {
      const file = createMockFile({ mimetype: 'text/plain' });
      const response = getErrorResponse(() => pipe.transform([file]));
      expect(response.error).toBeDefined();
      expect(response.message).toBeDefined();
      expect(typeof response.error).toBe('string');
      expect(typeof response.message).toBe('string');
    });
  });

  describe('복합 시나리오', () => {
    it('유효한 파일 여러 개가 모두 통과해야 함', () => {
      const jpegFile = createMockFile();
      const pngBuffer = createPngBuffer();
      const pngFile = createMockFile({ mimetype: 'image/png', buffer: pngBuffer, originalname: 'test.png' });
      const webpBuffer = createWebpBuffer();
      const webpFile = createMockFile({ mimetype: 'image/webp', buffer: webpBuffer, originalname: 'test.webp' });

      const result = pipe.transform([jpegFile, pngFile, webpFile]);
      expect(result).toHaveLength(3);
    });

    it('배치에서 하나라도 유효하지 않으면 전체 요청이 실패해야 함', () => {
      const validFile = createMockFile();
      // invalid MIME + invalid magic bytes
      const invalidBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38]); // GIF magic bytes
      const invalidFile = createMockFile({ mimetype: 'image/gif', buffer: invalidBuffer });

      expect(() => pipe.transform([validFile, invalidFile])).toThrow(BadRequestException);
    });
  });
});
