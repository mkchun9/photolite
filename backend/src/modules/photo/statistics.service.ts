import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Photo } from './entities/photo.entity';
import { StatisticsResponse } from './dto/photo-response.dto';

/**
 * StatisticsService - 이미지 최적화 통계 조회 서비스
 *
 * 총 원본 크기, 총 최적화 크기, 총 절약 바이트, 절약 퍼센트,
 * 총 이미지 수, 중복 이미지 수를 계산하여 반환한다.
 */
@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
  ) {}

  /**
   * 전체 이미지 최적화 통계를 조회한다.
   *
   * - 총 이미지 수, 총 원본 크기, 총 최적화 크기, 절약 바이트, 절약 퍼센트
   * - 중복 이미지 수 (동일 hash가 2개 이상 존재하는 photo 수)
   * - 이미지가 0개일 경우 모든 값 0 반환
   * - DB 오류 시 503 SERVICE_UNAVAILABLE 응답
   */
  async getStatistics(): Promise<StatisticsResponse> {
    try {
      // 집계 쿼리: count, sum(originalBytes), sum(optimizedBytes)
      const aggregateResult = await this.photoRepository
        .createQueryBuilder('photo')
        .select('COUNT(photo.id)', 'count')
        .addSelect('COALESCE(SUM(photo.originalBytes), 0)', 'totalOriginalBytes')
        .addSelect('COALESCE(SUM(photo.optimizedBytes), 0)', 'totalOptimizedBytes')
        .getRawOne();

      const count = Number(aggregateResult.count) || 0;
      const totalOriginalBytes =
        Number(aggregateResult.totalOriginalBytes) || 0;
      const totalOptimizedBytes =
        Number(aggregateResult.totalOptimizedBytes) || 0;

      // 이미지가 0개인 경우 모든 값 0 반환 (나눗셈 방지)
      if (count === 0) {
        const emptyResponse = new StatisticsResponse();
        emptyResponse.count = 0;
        emptyResponse.totalOriginalBytes = 0;
        emptyResponse.totalOptimizedBytes = 0;
        emptyResponse.savedBytes = 0;
        emptyResponse.savedPercent = 0;
        emptyResponse.duplicateCount = 0;
        return emptyResponse;
      }

      // 중복 이미지 수: hash가 2개 이상 존재하는 photo 수
      const duplicateResult = await this.photoRepository
        .createQueryBuilder('photo')
        .select('SUM(sub.cnt)', 'duplicateCount')
        .from((subQuery) => {
          return subQuery
            .select('photo.hash', 'hash')
            .addSelect('COUNT(photo.id)', 'cnt')
            .from(Photo, 'photo')
            .groupBy('photo.hash')
            .having('COUNT(photo.id) > 1');
        }, 'sub')
        .getRawOne();

      const duplicateCount = Number(duplicateResult?.duplicateCount) || 0;

      // 절약 계산
      const savedBytes = totalOriginalBytes - totalOptimizedBytes;
      const savedPercent =
        Math.round(((savedBytes / totalOriginalBytes) * 100) * 100) / 100;

      const response = new StatisticsResponse();
      response.count = count;
      response.totalOriginalBytes = totalOriginalBytes;
      response.totalOptimizedBytes = totalOptimizedBytes;
      response.savedBytes = savedBytes;
      response.savedPercent = savedPercent;
      response.duplicateCount = duplicateCount;

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve statistics',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
