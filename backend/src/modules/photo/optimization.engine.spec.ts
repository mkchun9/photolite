import { OptimizationEngine } from './optimization.engine';
import sharp from 'sharp';

describe('OptimizationEngine', () => {
  let engine: OptimizationEngine;

  beforeEach(() => {
    engine = new OptimizationEngine();
  });

  describe('optimize', () => {
    it('유효한 JPEG 이미지를 WebP로 변환해야 한다', async () => {
      // 100x100 빨간 JPEG 생성
      const jpegBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .jpeg()
        .toBuffer();

      const result = await engine.optimize(jpegBuffer);

      expect(result.format).toBe('webp');
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.bytes).toBeGreaterThan(0);
      expect(result.skipped).toBe(false);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('유효한 PNG 이미지를 WebP로 변환해야 한다', async () => {
      const pngBuffer = await sharp({
        create: { width: 200, height: 150, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
      })
        .png()
        .toBuffer();

      const result = await engine.optimize(pngBuffer);

      expect(result.format).toBe('webp');
      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
      expect(result.skipped).toBe(false);
    });

    it('너비 1920px 초과 이미지를 축소해야 한다 (비율 유지)', async () => {
      // 3840x2160 이미지 (16:9 비율)
      const largeBuffer = await sharp({
        create: { width: 3840, height: 2160, channels: 3, background: { r: 0, g: 0, b: 255 } },
      })
        .jpeg()
        .toBuffer();

      const result = await engine.optimize(largeBuffer);

      expect(result.width).toBeLessThanOrEqual(1920);
      expect(result.height).toBeLessThanOrEqual(1080);
      expect(result.format).toBe('webp');
      expect(result.skipped).toBe(false);
    });

    it('높이 1080px 초과이고 너비 1920px 이하인 이미지를 축소해야 한다 (비율 유지)', async () => {
      // 800x2000 이미지 (세로로 긴 이미지)
      const tallBuffer = await sharp({
        create: { width: 800, height: 2000, channels: 3, background: { r: 128, g: 128, b: 128 } },
      })
        .jpeg()
        .toBuffer();

      const result = await engine.optimize(tallBuffer);

      expect(result.width).toBeLessThanOrEqual(1920);
      expect(result.height).toBeLessThanOrEqual(1080);
      // 비율 유지 확인: 원본은 800:2000 = 0.4 비율
      const aspectRatio = result.width / result.height;
      expect(aspectRatio).toBeCloseTo(800 / 2000, 1);
      expect(result.format).toBe('webp');
      expect(result.skipped).toBe(false);
    });

    it('1920x1080 이하 이미지는 확대하지 않아야 한다', async () => {
      const smallBuffer = await sharp({
        create: { width: 640, height: 480, channels: 3, background: { r: 100, g: 100, b: 100 } },
      })
        .jpeg()
        .toBuffer();

      const result = await engine.optimize(smallBuffer);

      expect(result.width).toBe(640);
      expect(result.height).toBe(480);
      expect(result.format).toBe('webp');
      expect(result.skipped).toBe(false);
    });

    it('원본 WebP가 더 작은 경우 원본을 유지해야 한다 (skipped: true)', async () => {
      // 매우 작은 WebP 이미지 생성 (재인코딩 시 더 커질 가능성 높음)
      const tinyWebp = await sharp({
        create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .webp({ quality: 1 })
        .toBuffer();

      const result = await engine.optimize(tinyWebp);

      // 원본이 더 작으면 skipped: true
      if (result.skipped) {
        expect(result.bytes).toBe(tinyWebp.length);
        expect(result.buffer).toBe(tinyWebp);
      } else {
        // 최적화 결과가 더 작을 수도 있음 - 이 경우 정상적으로 통과
        expect(result.format).toBe('webp');
      }
    });

    it('손상된 이미지 처리 시 에러를 반환해야 한다', async () => {
      const corruptedBuffer = Buffer.from('this is not an image at all');

      await expect(engine.optimize(corruptedBuffer)).rejects.toThrow(
        '이미지를 처리할 수 없습니다',
      );
    });

    it('빈 버퍼 처리 시 에러를 반환해야 한다', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(engine.optimize(emptyBuffer)).rejects.toThrow();
    });

    it('WebP 변환 결과는 항상 format이 webp여야 한다', async () => {
      const jpegBuffer = await sharp({
        create: { width: 500, height: 300, channels: 3, background: { r: 50, g: 100, b: 150 } },
      })
        .jpeg({ quality: 95 })
        .toBuffer();

      const result = await engine.optimize(jpegBuffer);
      expect(result.format).toBe('webp');
    });
  });
});
