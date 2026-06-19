import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Photo } from './entities/photo.entity';
import { OptimizationEngine } from './optimization.engine';
import { DuplicateDetector } from './duplicate.detector';
import { OptimizationResult } from './interfaces/optimization-result.interface';
import { DuplicateResult } from './interfaces/duplicate-result.interface';
import { StatisticsResponse } from './dto/photo-response.dto';

/** 업로드 디렉토리 경로 */
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * 개별 파일 업로드 결과 인터페이스
 */
export interface FileUploadResult {
  /** 성공 여부 */
  success: boolean;
  /** 저장된 photo ID (성공 시) */
  id?: string;
  /** 원본 파일명 */
  fileName: string;
  /** 원본 파일 크기 (bytes) */
  originalBytes: number;
  /** 최적화 후 파일 크기 (bytes, 성공 시) */
  optimizedBytes?: number;
  /** 최적화 이미지 너비 (px, 성공 시) */
  width?: number;
  /** 최적화 이미지 높이 (px, 성공 시) */
  height?: number;
  /** 중복 여부 */
  isDuplicate?: boolean;
  /** 유사 이미지 목록 */
  similarImages?: Array<{ id: string; similarityScore: number }>;
  /** 중복 감지 상태 */
  duplicateStatus?: 'completed' | 'skipped' | 'timeout' | 'deferred';
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 에러 코드 (실패 시) */
  errorCode?: string;
}

/**
 * 업로드 전체 응답 인터페이스
 */
export interface UploadResponse {
  /** 업로드된 전체 파일 수 */
  totalFiles: number;
  /** 성공한 파일 수 */
  successCount: number;
  /** 실패한 파일 수 */
  failureCount: number;
  /** 개별 파일 결과 */
  results: FileUploadResult[];
}

/**
 * PhotoService - 업로드 오케스트레이션 및 비즈니스 로직 서비스
 *
 * 업로드 플로우: 검증 → 최적화 → 중복 감지 → 저장
 * - 검증은 FileValidationPipe에서 수행됨
 * - 이 서비스는 최적화, 중복 감지, 파일 저장, DB CRUD를 담당
 *
 * Validates: Requirements 1.1~1.7, 2.1~2.8, 3.5, 6.1~6.8
 */
@Injectable()
export class PhotoService {
  private readonly logger = new Logger(PhotoService.name);

  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    private readonly optimizationEngine: OptimizationEngine,
    private readonly duplicateDetector: DuplicateDetector,
  ) {
    this.ensureUploadDir();
  }

  /**
   * 업로드 디렉토리 생성 (존재하지 않으면)
   */
  private ensureUploadDir(): void {
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
    } catch (error) {
      this.logger.error('업로드 디렉토리 생성 실패', error);
    }
  }

  /**
   * 파일 업로드 오케스트레이션
   * 검증된 파일 배열을 받아 최적화 → 중복 감지 → 저장 수행
   *
   * @param files - FileValidationPipe를 통과한 유효한 파일 배열
   * @returns UploadResponse - 전체 업로드 결과
   */
  async processUpload(files: Express.Multer.File[]): Promise<UploadResponse> {
    const results: FileUploadResult[] = [];

    for (const file of files) {
      const result = await this.processFile(file);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      totalFiles: files.length,
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * 개별 파일 처리: 최적화 → 중복 감지 → 파일 저장 → DB 저장
   *
   * @param file - 유효한 업로드 파일
   * @returns FileUploadResult - 개별 파일 처리 결과
   */
  private async processFile(file: Express.Multer.File): Promise<FileUploadResult> {
    let writtenFilePath: string | null = null;

    try {
      // 1. 이미지 최적화 (Requirement 2.1~2.8, 6.1)
      let optimizationResult: OptimizationResult;
      try {
        optimizationResult = await this.optimizationEngine.optimize(file.buffer);
      } catch (error) {
        // 손상된 이미지 처리 실패 (Requirement 6.1, 2.8)
        this.logger.warn(
          `이미지 최적화 실패: ${file.originalname} - ${error instanceof Error ? error.message : error}`,
        );
        return {
          success: false,
          fileName: file.originalname,
          originalBytes: file.size,
          error: '이미지를 처리할 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.',
          errorCode: 'CORRUPTED_FILE',
        };
      }

      // 2. 중복 감지 (Requirement 3.1~3.8)
      let duplicateResult: DuplicateResult;
      try {
        duplicateResult = await this.duplicateDetector.detectDuplicate(
          optimizationResult.buffer,
        );
      } catch (error) {
        // 중복 감지 실패 시에도 업로드 계속 (Requirement 3.7, 3.8)
        this.logger.warn(
          `중복 감지 실패: ${file.originalname} - ${error instanceof Error ? error.message : error}`,
        );
        duplicateResult = {
          isDuplicate: false,
          hash: '',
          similarImages: [],
          status: 'skipped',
        };
      }

      // 3. 파일 저장을 위한 임시 Photo 엔티티 생성 (UUID 생성)
      const photo = this.photoRepository.create({
        fileName: file.originalname,
        hash: duplicateResult.hash || '0000000000000000',
        originalBytes: file.size,
        optimizedBytes: optimizationResult.bytes,
        width: optimizationResult.width,
        height: optimizationResult.height,
      });

      // 4. DB에 먼저 저장하여 UUID 획득
      let savedPhoto: Photo;
      try {
        savedPhoto = await this.photoRepository.save(photo);
      } catch (error) {
        // DB 저장 실패 (Requirement 6.2)
        this.logger.error(
          `DB 저장 실패: ${file.originalname} - ${error instanceof Error ? error.message : error}`,
        );
        throw new HttpException(
          {
            error: 'SERVICE_UNAVAILABLE',
            message: '데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
            timestamp: new Date().toISOString(),
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // 5. 최적화된 이미지를 디스크에 저장 (UUID 기반 파일명)
      const filePath = path.join(UPLOADS_DIR, `${savedPhoto.id}.webp`);
      try {
        this.ensureUploadDir();
        fs.writeFileSync(filePath, optimizationResult.buffer);
        writtenFilePath = filePath;
      } catch (error) {
        // 디스크 쓰기 실패 (Requirement 6.3) → DB 레코드 롤백
        this.logger.error(
          `파일 저장 실패: ${file.originalname} - ${error instanceof Error ? error.message : error}`,
        );
        // DB에서 방금 저장한 레코드 삭제
        await this.cleanupDbRecord(savedPhoto.id);
        throw new HttpException(
          {
            error: 'INSUFFICIENT_STORAGE',
            message: '서버 스토리지가 부족합니다. 관리자에게 문의해주세요.',
            timestamp: new Date().toISOString(),
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // 6. 성공 결과 반환 (Requirement 3.5: 중복이어도 저장)
      return {
        success: true,
        id: savedPhoto.id,
        fileName: file.originalname,
        originalBytes: file.size,
        optimizedBytes: optimizationResult.bytes,
        width: optimizationResult.width,
        height: optimizationResult.height,
        isDuplicate: duplicateResult.isDuplicate,
        similarImages: duplicateResult.similarImages,
        duplicateStatus: duplicateResult.status,
      };
    } catch (error) {
      // HttpException은 그대로 전파
      if (error instanceof HttpException) {
        throw error;
      }

      // 예상치 못한 에러 → 임시 파일 정리 (Requirement 6.8)
      this.logger.error(
        `예상치 못한 에러: ${file.originalname} - ${error instanceof Error ? error.message : error}`,
      );

      if (writtenFilePath) {
        this.cleanupFile(writtenFilePath);
      }

      return {
        success: false,
        fileName: file.originalname,
        originalBytes: file.size,
        error: '파일 처리 중 알 수 없는 오류가 발생했습니다.',
        errorCode: 'PROCESSING_FAILED',
      };
    }
  }

  /**
   * ID로 Photo 조회
   *
   * @param id - Photo UUID
   * @returns Photo 엔티티
   * @throws NotFoundException - 해당 ID의 Photo가 없는 경우
   */
  async getPhotoById(id: string): Promise<Photo> {
    const photo = await this.photoRepository.findOne({ where: { id } });

    if (!photo) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: `이미지를 찾을 수 없습니다: ${id}`,
        timestamp: new Date().toISOString(),
      });
    }

    return photo;
  }

  /**
   * 통계 집계 (Requirement 5.1~5.8)
   * 전체 이미지 수, 원본/최적화 크기 합계, 절약 용량/비율 계산
   *
   * @returns StatisticsResponse - 통계 응답
   */
  async getStatistics(): Promise<StatisticsResponse> {
    try {
      const result = await this.photoRepository
        .createQueryBuilder('photo')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(photo.originalBytes), 0)', 'totalOriginalBytes')
        .addSelect('COALESCE(SUM(photo.optimizedBytes), 0)', 'totalOptimizedBytes')
        .getRawOne();

      const count = parseInt(result.count, 10) || 0;
      const totalOriginalBytes = parseInt(result.totalOriginalBytes, 10) || 0;
      const totalOptimizedBytes = parseInt(result.totalOptimizedBytes, 10) || 0;
      const savedBytes = totalOriginalBytes - totalOptimizedBytes;

      // Requirement 5.6: 이미지가 없으면 0 반환 (나누기 방지)
      const savedPercent =
        totalOriginalBytes > 0
          ? Math.round((savedBytes / totalOriginalBytes) * 10000) / 100
          : 0;

      // 중복 감지 수 계산 (간단 구현: hash가 2번 이상 등장하는 경우)
      const duplicateCountResult = await this.photoRepository
        .createQueryBuilder('photo')
        .select('COUNT(*)', 'duplicateCount')
        .where((qb) => {
          const subQuery = qb
            .subQuery()
            .select('p.hash')
            .from(Photo, 'p')
            .groupBy('p.hash')
            .having('COUNT(*) > 1')
            .getQuery();
          return 'photo.hash IN ' + subQuery;
        })
        .getRawOne();

      const duplicateCount =
        parseInt(duplicateCountResult?.duplicateCount, 10) || 0;

      return {
        count,
        totalOriginalBytes,
        totalOptimizedBytes,
        savedBytes,
        savedPercent,
        duplicateCount,
      };
    } catch (error) {
      this.logger.error(
        `통계 조회 실패: ${error instanceof Error ? error.message : error}`,
      );
      throw new HttpException(
        {
          error: 'SERVICE_UNAVAILABLE',
          message: '통계 정보를 일시적으로 이용할 수 없습니다.',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * DB 레코드 정리 (에러 복구 시 사용)
   *
   * @param id - 삭제할 Photo ID
   */
  private async cleanupDbRecord(id: string): Promise<void> {
    try {
      await this.photoRepository.delete(id);
    } catch (error) {
      this.logger.error(
        `DB 레코드 정리 실패 (id: ${id}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * 파일 정리 (에러 복구 시 사용, 60초 이내 보장 - Requirement 6.8)
   *
   * @param filePath - 삭제할 파일 경로
   */
  private cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`임시 파일 정리 완료: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(
        `파일 정리 실패: ${filePath} - ${error instanceof Error ? error.message : error}`,
      );
      // 비동기로 60초 이내 재시도 (Requirement 6.8)
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            this.logger.log(`파일 정리 재시도 성공: ${filePath}`);
          }
        } catch (retryError) {
          this.logger.error(
            `파일 정리 재시도 실패: ${filePath} - ${retryError instanceof Error ? retryError.message : retryError}`,
          );
        }
      }, 30000); // 30초 후 재시도
    }
  }
}
