import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { MAX_WIDTH, MAX_HEIGHT, WEBP_QUALITY } from './photo.constants';
import { OptimizationResult } from './interfaces/optimization-result.interface';

/**
 * OptimizationEngine - 이미지 최적화 서비스
 *
 * sharp 라이브러리를 사용하여 이미지를 WebP로 변환하고 리사이즈합니다.
 * - EXIF 자동회전
 * - 너비 1920px / 높이 1080px 초과 시 축소 (비율 유지, fit: 'inside')
 * - WebP quality 80
 * - 원본 WebP가 더 작은 경우 원본 유지 (skipped: true)
 * - 손상된 이미지 처리 시 에러 반환
 */
@Injectable()
export class OptimizationEngine {
  private readonly logger = new Logger(OptimizationEngine.name);

  /**
   * 이미지를 최적화합니다.
   *
   * @param buffer - 원본 이미지 바이너리 데이터
   * @returns OptimizationResult - 최적화 결과 (buffer, width, height, bytes, format, skipped)
   * @throws Error - 손상된 이미지이거나 처리할 수 없는 경우
   */
  async optimize(buffer: Buffer): Promise<OptimizationResult> {
    // 1. 원본 메타데이터 확인 (손상 이미지 감지)
    let originalMetadata: sharp.Metadata;
    try {
      originalMetadata = await sharp(buffer).metadata();
    } catch (error) {
      this.logger.error('이미지 메타데이터 읽기 실패 (손상된 파일)', error);
      throw new Error('이미지를 처리할 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.');
    }

    if (!originalMetadata.width || !originalMetadata.height) {
      throw new Error('이미지를 처리할 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.');
    }

    const originalFormat = originalMetadata.format;

    // 2. WebP 최적화 수행: EXIF 자동회전 → 리사이즈 → WebP 변환
    let optimizedBuffer: Buffer;
    try {
      optimizedBuffer = await sharp(buffer)
        .rotate() // EXIF 자동회전
        .resize(MAX_WIDTH, MAX_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch (error) {
      this.logger.error('이미지 최적화 처리 실패', error);
      throw new Error('이미지를 처리할 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.');
    }

    // 3. 원본 WebP가 더 작은 경우 원본 유지
    if (originalFormat === 'webp' && buffer.length <= optimizedBuffer.length) {
      // 원본 WebP의 메타데이터를 다시 읽어서 실제 크기 확인
      // (EXIF 회전 적용 후 크기를 위해 rotate 후 metadata 확인)
      const rotatedMetadata = await sharp(buffer).rotate().metadata();

      return {
        buffer: buffer,
        width: rotatedMetadata.width ?? originalMetadata.width,
        height: rotatedMetadata.height ?? originalMetadata.height,
        bytes: buffer.length,
        format: 'webp',
        skipped: true,
      };
    }

    // 4. 최적화된 이미지의 메타데이터 확인
    const optimizedMetadata = await sharp(optimizedBuffer).metadata();

    return {
      buffer: optimizedBuffer,
      width: optimizedMetadata.width!,
      height: optimizedMetadata.height!,
      bytes: optimizedBuffer.length,
      format: 'webp',
      skipped: false,
    };
  }
}
