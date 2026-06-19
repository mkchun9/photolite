import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { Photo } from './entities/photo.entity';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let mockQueryBuilder: any;
  let mockRepository: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };

    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        {
          provide: getRepositoryToken(Photo),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatistics', () => {
    it('이미지가 0개일 때 모든 값 0을 반환한다', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        count: '0',
        totalOriginalBytes: '0',
        totalOptimizedBytes: '0',
      });

      const result = await service.getStatistics();

      expect(result.count).toBe(0);
      expect(result.totalOriginalBytes).toBe(0);
      expect(result.totalOptimizedBytes).toBe(0);
      expect(result.savedBytes).toBe(0);
      expect(result.savedPercent).toBe(0);
      expect(result.duplicateCount).toBe(0);
    });

    it('이미지가 있을 때 정확한 통계를 계산한다', async () => {
      // 첫 번째 쿼리: 집계
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        count: '5',
        totalOriginalBytes: '10000',
        totalOptimizedBytes: '7000',
      });

      // 두 번째 쿼리: 중복 수
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        duplicateCount: '2',
      });

      const result = await service.getStatistics();

      expect(result.count).toBe(5);
      expect(result.totalOriginalBytes).toBe(10000);
      expect(result.totalOptimizedBytes).toBe(7000);
      expect(result.savedBytes).toBe(3000);
      expect(result.savedPercent).toBe(30);
      expect(result.duplicateCount).toBe(2);
    });

    it('savedPercent를 소수점 2자리로 반올림한다', async () => {
      // savedBytes = 3333, totalOriginalBytes = 10000
      // savedPercent = (3333 / 10000) * 100 = 33.33
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        count: '3',
        totalOriginalBytes: '10000',
        totalOptimizedBytes: '6667',
      });

      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        duplicateCount: '0',
      });

      const result = await service.getStatistics();

      expect(result.savedPercent).toBe(33.33);
    });

    it('중복 이미지가 없을 때 duplicateCount가 0이다', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        count: '3',
        totalOriginalBytes: '9000',
        totalOptimizedBytes: '6000',
      });

      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        duplicateCount: null,
      });

      const result = await service.getStatistics();

      expect(result.duplicateCount).toBe(0);
    });

    it('DB 오류 시 503 SERVICE_UNAVAILABLE을 throw한다', async () => {
      mockQueryBuilder.getRawOne.mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      await expect(service.getStatistics()).rejects.toThrow(HttpException);
      await expect(service.getStatistics()).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });
});
