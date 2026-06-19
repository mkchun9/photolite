import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThumbnailController } from './thumbnail.controller';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

/** 테스트용 업로드 디렉토리 */
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

/** 테스트용 유효한 UUID */
const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('ThumbnailController', () => {
  let controller: ThumbnailController;
  let mockResponse: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThumbnailController],
    }).compile();

    controller = module.get<ThumbnailController>(ThumbnailController);

    // Mock Express Response
    mockResponse = {
      setHeader: jest.fn(),
      sendFile: jest.fn(),
    };
  });

  describe('경로 순회 공격 방지', () => {
    it('".." 포함 파일명은 BadRequestException 발생', async () => {
      await expect(
        controller.serveThumbnail('../etc/passwd.webp', mockResponse),
      ).rejects.toThrow(BadRequestException);
    });

    it('"/" 포함 파일명은 BadRequestException 발생', async () => {
      await expect(
        controller.serveThumbnail('../../secret/file.webp', mockResponse),
      ).rejects.toThrow(BadRequestException);
    });

    it('"\\" 포함 파일명은 BadRequestException 발생', async () => {
      await expect(
        controller.serveThumbnail('..\\windows\\system.webp', mockResponse),
      ).rejects.toThrow(BadRequestException);
    });

    it('비-UUID 형식 ID는 BadRequestException 발생', async () => {
      await expect(
        controller.serveThumbnail('not-a-valid-uuid.webp', mockResponse),
      ).rejects.toThrow(BadRequestException);
    });

    it('.webp가 아닌 확장자는 BadRequestException 발생', async () => {
      await expect(
        controller.serveThumbnail(`${VALID_UUID}.png`, mockResponse),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('썸네일 서빙', () => {
    const testImagePath = path.join(UPLOADS_DIR, `${VALID_UUID}.webp`);
    const testThumbnailPath = path.join(THUMBNAILS_DIR, `${VALID_UUID}.webp`);

    beforeAll(async () => {
      // 테스트용 이미지 생성
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      // 500x400 빨간색 이미지 생성
      const buffer = await sharp({
        create: { width: 500, height: 400, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .webp({ quality: 80 })
        .toBuffer();
      fs.writeFileSync(testImagePath, buffer);
    });

    afterAll(() => {
      // 테스트 파일 정리
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
      if (fs.existsSync(testThumbnailPath)) {
        fs.unlinkSync(testThumbnailPath);
      }
    });

    it('원본 이미지가 없으면 NotFoundException 발생', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await expect(
        controller.serveThumbnail(`${nonExistentId}.webp`, mockResponse),
      ).rejects.toThrow(NotFoundException);
    });

    it('유효한 UUID + 원본 이미지 존재 시 썸네일 생성 및 서빙', async () => {
      await controller.serveThumbnail(`${VALID_UUID}.webp`, mockResponse);

      // 썸네일 파일이 디스크에 생성되었는지 확인
      expect(fs.existsSync(testThumbnailPath)).toBe(true);

      // Response 헤더 설정 확인
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=86400',
      );
      expect(mockResponse.sendFile).toHaveBeenCalledWith(testThumbnailPath);

      // 생성된 썸네일 크기 확인 (300px 이하)
      const metadata = await sharp(testThumbnailPath).metadata();
      expect(metadata.width).toBeLessThanOrEqual(300);
      expect(metadata.height).toBeLessThanOrEqual(300);
      // 비율 유지 확인: 원본 500x400 → 썸네일은 300x240
      expect(metadata.width).toBe(300);
      expect(metadata.height).toBe(240);
    });

    it('기존 썸네일이 있으면 재생성 없이 바로 서빙', async () => {
      // 이전 테스트에서 썸네일이 이미 생성됨
      expect(fs.existsSync(testThumbnailPath)).toBe(true);

      await controller.serveThumbnail(`${VALID_UUID}.webp`, mockResponse);

      expect(mockResponse.sendFile).toHaveBeenCalledWith(testThumbnailPath);
    });
  });
});
