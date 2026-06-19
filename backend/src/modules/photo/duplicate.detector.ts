import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Photo } from './entities/photo.entity';
import { DuplicateResult } from './interfaces/duplicate-result.interface';
import { averageHash, hammingDistance } from './image.util';

/** 중복 판정 유사도 임계값 (0.9 이상이면 중복) */
const SIMILARITY_THRESHOLD = 0.9;

/** 유사 이미지 최대 반환 개수 */
const MAX_SIMILAR_IMAGES = 10;

/** 중복 감지 타임아웃 (ms) */
const DETECTION_TIMEOUT_MS = 5000;

/**
 * DuplicateDetector - aHash 기반 이미지 중복 감지 서비스
 *
 * 알고리즘:
 * 1. 입력 이미지의 aHash(64-bit perceptual hash) 생성
 * 2. DB에 저장된 기존 photo들의 hash와 Hamming Distance 비교
 * 3. Similarity Score = 1 - (hammingDistance / 64)
 * 4. threshold(0.9) 이상인 이미지가 있으면 duplicate 판정
 * 5. 유사 이미지 최대 10개를 score 내림차순으로 반환
 */
@Injectable()
export class DuplicateDetector {
  private readonly logger = new Logger(DuplicateDetector.name);

  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
  ) {}

  /**
   * 이미지 중복 감지 수행
   *
   * @param buffer - 이미지 바이너리 데이터
   * @returns DuplicateResult - 중복 여부, hash, 유사 이미지 목록, 상태
   */
  async detectDuplicate(buffer: Buffer): Promise<DuplicateResult> {
    return Promise.race([
      this.performDetection(buffer),
      this.createTimeoutPromise(),
    ]);
  }

  /**
   * 실제 중복 감지 로직
   */
  private async performDetection(buffer: Buffer): Promise<DuplicateResult> {
    // 1. aHash 생성
    let hash: string;
    try {
      hash = await averageHash(buffer);
    } catch (error) {
      this.logger.warn(`Hash 생성 실패: ${error instanceof Error ? error.message : error}`);
      return {
        isDuplicate: false,
        hash: '',
        similarImages: [],
        status: 'skipped',
      };
    }

    // 2. DB에서 기존 photo hash 목록 조회
    const existingPhotos = await this.photoRepository.find({
      select: { id: true, hash: true },
    });

    // 3. 각 기존 photo와 Hamming Distance 비교 → Similarity Score 계산
    const similarImages: Array<{ id: string; similarityScore: number }> = [];

    for (const photo of existingPhotos) {
      const distance = hammingDistance(hash, photo.hash);
      const similarityScore = 1 - distance / 64;

      if (similarityScore >= SIMILARITY_THRESHOLD) {
        similarImages.push({
          id: photo.id,
          similarityScore,
        });
      }
    }

    // 4. score 내림차순 정렬 후 최대 10개 반환
    similarImages.sort((a, b) => b.similarityScore - a.similarityScore);
    const topSimilarImages = similarImages.slice(0, MAX_SIMILAR_IMAGES);

    // 5. 중복 판정
    const isDuplicate = topSimilarImages.length > 0;

    return {
      isDuplicate,
      hash,
      similarImages: topSimilarImages,
      status: 'completed',
    };
  }

  /**
   * 타임아웃 Promise 생성 (5초)
   */
  private createTimeoutPromise(): Promise<DuplicateResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.logger.warn('중복 감지 타임아웃 (5초 초과)');
        resolve({
          isDuplicate: false,
          hash: '',
          similarImages: [],
          status: 'timeout',
        });
      }, DETECTION_TIMEOUT_MS);
    });
  }
}
