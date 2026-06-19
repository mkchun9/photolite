import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DuplicateDetector } from './duplicate.detector';
import { Photo } from './entities/photo.entity';
import * as imageUtil from './image.util';

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector;
  let mockRepository: { find: jest.Mock };

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuplicateDetector,
        {
          provide: getRepositoryToken(Photo),
          useValue: mockRepository,
        },
      ],
    }).compile();

    detector = module.get<DuplicateDetector>(DuplicateDetector);
  });

  describe('detectDuplicate', () => {
    it('해시 생성 실패 시 status: skipped 반환', async () => {
      jest.spyOn(imageUtil, 'averageHash').mockRejectedValue(new Error('Invalid image'));

      const result = await detector.detectDuplicate(Buffer.from('invalid'));

      expect(result.status).toBe('skipped');
      expect(result.isDuplicate).toBe(false);
      expect(result.hash).toBe('');
      expect(result.similarImages).toEqual([]);
    });

    it('중복 없을 때 isDuplicate: false 반환', async () => {
      jest.spyOn(imageUtil, 'averageHash').mockResolvedValue('aaaaaaaaaaaaaaaa');
      mockRepository.find.mockResolvedValue([
        { id: 'photo-1', hash: '0000000000000000' }, // distance = 32, similarity = 0.5
      ]);

      const result = await detector.detectDuplicate(Buffer.from('test'));

      expect(result.status).toBe('completed');
      expect(result.isDuplicate).toBe(false);
      expect(result.hash).toBe('aaaaaaaaaaaaaaaa');
      expect(result.similarImages).toEqual([]);
    });

    it('유사도 0.9 이상 시 isDuplicate: true 반환', async () => {
      // 동일 hash → distance = 0, similarity = 1.0
      jest.spyOn(imageUtil, 'averageHash').mockResolvedValue('abcdef0123456789');
      mockRepository.find.mockResolvedValue([
        { id: 'photo-1', hash: 'abcdef0123456789' },
      ]);

      const result = await detector.detectDuplicate(Buffer.from('test'));

      expect(result.status).toBe('completed');
      expect(result.isDuplicate).toBe(true);
      expect(result.hash).toBe('abcdef0123456789');
      expect(result.similarImages).toHaveLength(1);
      expect(result.similarImages[0]).toEqual({
        id: 'photo-1',
        similarityScore: 1,
      });
    });

    it('유사 이미지를 score 내림차순으로 정렬하여 반환', async () => {
      jest.spyOn(imageUtil, 'averageHash').mockResolvedValue('ffffffffffffffff');
      // fffffffffffffffe → distance 1, similarity 0.984375
      // fffffffffffffffc → distance 2, similarity 0.96875
      // fffffffffffffff0 → distance 4, similarity 0.9375
      mockRepository.find.mockResolvedValue([
        { id: 'photo-low', hash: 'fffffffffffffff0' },   // similarity 0.9375
        { id: 'photo-high', hash: 'fffffffffffffffe' },  // similarity 0.984375
        { id: 'photo-mid', hash: 'fffffffffffffffc' },   // similarity 0.96875
      ]);

      const result = await detector.detectDuplicate(Buffer.from('test'));

      expect(result.isDuplicate).toBe(true);
      expect(result.similarImages).toHaveLength(3);
      expect(result.similarImages[0].id).toBe('photo-high');
      expect(result.similarImages[1].id).toBe('photo-mid');
      expect(result.similarImages[2].id).toBe('photo-low');
    });

    it('유사 이미지 최대 10개만 반환', async () => {
      jest.spyOn(imageUtil, 'averageHash').mockResolvedValue('ffffffffffffffff');

      // 12개의 동일 hash photo 생성
      const photos = Array.from({ length: 12 }, (_, i) => ({
        id: `photo-${i}`,
        hash: 'ffffffffffffffff',
      }));
      mockRepository.find.mockResolvedValue(photos);

      const result = await detector.detectDuplicate(Buffer.from('test'));

      expect(result.isDuplicate).toBe(true);
      expect(result.similarImages).toHaveLength(10);
    });

    it('타임아웃(5초) 시 status: timeout 반환', async () => {
      jest.useFakeTimers();

      // averageHash가 절대 resolve되지 않도록 설정
      jest.spyOn(imageUtil, 'averageHash').mockImplementation(
        () => new Promise(() => {}), // never resolves
      );

      const resultPromise = detector.detectDuplicate(Buffer.from('test'));

      // 5초 타이머 진행
      jest.advanceTimersByTime(5000);

      const result = await resultPromise;

      expect(result.status).toBe('timeout');
      expect(result.isDuplicate).toBe(false);
      expect(result.hash).toBe('');
      expect(result.similarImages).toEqual([]);

      jest.useRealTimers();
    });

    it('유사도 정확히 0.9인 경우 duplicate로 판정 (경계값)', async () => {
      jest.spyOn(imageUtil, 'averageHash').mockResolvedValue('ffffffffffffffff');
      // distance = 6이면 similarity = 1 - 6/64 = 0.90625 → 0.9 이상이므로 duplicate
      // distance = 7이면 similarity = 1 - 7/64 = 0.890625 → 0.9 미만이므로 not duplicate
      // 정확히 0.9를 만들려면 distance = 6.4인데 정수이므로
      // distance = 6 → similarity = 0.90625 (통과)
      mockRepository.find.mockResolvedValue([
        { id: 'photo-border', hash: 'ffffffffffffff00' }, // distance varies
      ]);

      const result = await detector.detectDuplicate(Buffer.from('test'));

      // ffffffffffffff00 vs ffffffffffffffff → XOR = 0xff → 8 bits → distance = 8
      // similarity = 1 - 8/64 = 0.875 → 0.9 미만이므로 not duplicate
      expect(result.isDuplicate).toBe(false);
    });
  });
});
