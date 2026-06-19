import {
  Controller,
  Get,
  Param,
  Res,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

/** 업로드 디렉토리 절대 경로 */
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/** 썸네일 디렉토리 절대 경로 */
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

/** 썸네일 최대 크기 (px) - Requirement 4.7: 최대 300px, 비율 유지 */
const THUMBNAIL_MAX_SIZE = 300;

/**
 * UUID v4 형식 검증 정규식
 * 경로 순회 공격 방지: UUID 형식만 허용하여 ../나 절대경로 등 차단
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ThumbnailController - 썸네일 이미지 서빙을 담당하는 컨트롤러
 *
 * - GET /uploads/thumbnails/:id.webp 요청 처리
 * - 썸네일이 디스크에 없으면 원본에서 on-the-fly 생성
 * - 생성된 썸네일은 디스크에 캐시하여 이후 express.static으로 서빙 가능
 * - 경로 순회 공격 방지: UUID 형식만 허용
 *
 * Validates: Requirements 4.7
 */
@Controller()
export class ThumbnailController {
  private readonly logger = new Logger(ThumbnailController.name);

  /**
   * 썸네일 이미지 서빙
   *
   * express.static이 먼저 처리하지 못한 경우 (파일이 없는 경우)에만 이 핸들러로 진입.
   * 원본 이미지에서 썸네일을 생성하고 캐시한 후 응답.
   *
   * @param filename - 파일명 (예: "uuid.webp")
   * @param res - Express Response 객체
   */
  @Get('uploads/thumbnails/:filename')
  async serveThumbnail(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    // 1. 파일명에서 ID 추출 및 보안 검증
    const id = this.extractAndValidateId(filename);

    // 2. 썸네일 파일 경로 결정
    const thumbnailPath = path.join(THUMBNAILS_DIR, `${id}.webp`);

    // 3. 썸네일이 이미 존재하면 바로 서빙
    if (fs.existsSync(thumbnailPath)) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.sendFile(thumbnailPath);
      return;
    }

    // 4. 원본 이미지 확인
    const originalPath = path.join(UPLOADS_DIR, `${id}.webp`);
    if (!fs.existsSync(originalPath)) {
      throw new NotFoundException(`이미지를 찾을 수 없습니다: ${id}`);
    }

    // 5. 썸네일 생성 (최대 300px, 비율 유지)
    try {
      await this.generateThumbnail(originalPath, thumbnailPath);
    } catch (error) {
      this.logger.error(
        `썸네일 생성 실패 (id: ${id}): ${error instanceof Error ? error.message : error}`,
      );
      throw new NotFoundException(`썸네일을 생성할 수 없습니다: ${id}`);
    }

    // 6. 생성된 썸네일 서빙
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(thumbnailPath);
  }

  /**
   * 파일명에서 ID를 추출하고 보안 검증 수행
   *
   * 보안 조치:
   * - ".." 포함 여부 확인 (경로 순회 공격 방지)
   * - "/" 또는 "\" 포함 여부 확인 (디렉토리 탈출 방지)
   * - UUID 형식인지 검증 (예측 가능한 형식만 허용)
   * - .webp 확장자 검증
   *
   * @param filename - 요청된 파일명
   * @returns 유효한 UUID ID
   * @throws BadRequestException - 잘못된 파일명
   */
  private extractAndValidateId(filename: string): string {
    // 경로 순회 공격 방지: ".." 포함 시 거부
    if (filename.includes('..')) {
      throw new BadRequestException('잘못된 파일 경로입니다.');
    }

    // 디렉토리 구분자 포함 시 거부
    if (filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('잘못된 파일 경로입니다.');
    }

    // .webp 확장자 검증
    if (!filename.endsWith('.webp')) {
      throw new BadRequestException('지원하지 않는 파일 형식입니다.');
    }

    // ID 추출 (확장자 제거)
    const id = filename.slice(0, -5); // ".webp" = 5글자

    // UUID 형식 검증
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('잘못된 이미지 ID입니다.');
    }

    return id;
  }

  /**
   * 원본 이미지에서 썸네일 생성
   *
   * - 최대 300px (가로/세로 중 긴 쪽 기준)
   * - 원본 비율 유지 (fit: 'inside')
   * - WebP 포맷 유지 (quality 80)
   * - 썸네일 디렉토리가 없으면 자동 생성
   *
   * @param originalPath - 원본 이미지 절대 경로
   * @param thumbnailPath - 저장할 썸네일 절대 경로
   */
  private async generateThumbnail(
    originalPath: string,
    thumbnailPath: string,
  ): Promise<void> {
    // 썸네일 디렉토리 생성 (존재하지 않으면)
    if (!fs.existsSync(THUMBNAILS_DIR)) {
      fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    }

    // sharp로 썸네일 생성: 최대 300px, 비율 유지
    await sharp(originalPath)
      .resize(THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);
  }
}
