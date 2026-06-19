import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Photo } from './entities/photo.entity';
import { GalleryQueryDto } from './dto/gallery-query.dto';
import {
  PaginatedGalleryResponse,
  PaginationMeta,
  PhotoResponse,
} from './dto/photo-response.dto';

/**
 * GalleryService - 갤러리 목록 조회 및 상세 조회를 담당하는 서비스
 *
 * 기능:
 * - 페이지네이션 기반 갤러리 목록 조회 (createdAt DESC)
 * - 개별 사진 상세 조회
 * - 중복 이미지 표시 (같은 hash가 DB에 2개 이상 존재)
 * - 절약률 계산 (소수점 1자리)
 * - 썸네일/풀사이즈 URL 제공
 */
@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
  ) {}

  /**
   * 갤러리 목록 페이지네이션 조회
   * - 정렬: createdAt DESC
   * - 범위 외 페이지 요청 시 빈 목록 반환
   * - 중복 indicator 포함
   */
  async getGallery(query: GalleryQueryDto): Promise<PaginatedGalleryResponse> {
    const { page, pageSize } = query;

    // 전체 이미지 수 조회
    const totalCount = await this.photoRepository.count();

    // totalPages 계산
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);

    // 페이지네이션 메타데이터 구성
    const pagination: PaginationMeta = {
      totalCount,
      currentPage: page,
      totalPages,
      pageSize,
    };

    // 범위 외 페이지: 빈 목록 반환
    if (page < 1 || page > totalPages) {
      return { images: [], pagination };
    }

    // skip/take 계산 및 조회
    const skip = (page - 1) * pageSize;
    const photos = await this.photoRepository.find({
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    // 중복 해시 목록 조회 (한 번의 쿼리로 효율적 처리)
    const duplicateHashes = await this.findDuplicateHashes();

    // PhotoResponse 매핑
    const images: PhotoResponse[] = photos.map((photo) =>
      this.mapToPhotoResponse(photo, duplicateHashes),
    );

    return { images, pagination };
  }

  /**
   * 사진 상세 조회
   * - fileName, createdAt, originalBytes, optimizedBytes, savingsPercent
   * - thumbnailUrl, fullUrl
   * - isDuplicate
   */
  async getPhotoDetail(id: string): Promise<PhotoResponse> {
    const photo = await this.photoRepository.findOne({ where: { id } });

    if (!photo) {
      throw new NotFoundException(`Photo with id '${id}' not found`);
    }

    const duplicateHashes = await this.findDuplicateHashes();
    return this.mapToPhotoResponse(photo, duplicateHashes);
  }

  /**
   * DB에서 2개 이상 존재하는 hash 목록을 조회
   * (중복 판별용: 같은 hash가 2개 이상이면 중복)
   */
  private async findDuplicateHashes(): Promise<Set<string>> {
    const result = await this.photoRepository
      .createQueryBuilder('photo')
      .select('photo.hash', 'hash')
      .groupBy('photo.hash')
      .having('COUNT(*) > 1')
      .getRawMany<{ hash: string }>();

    return new Set(result.map((row) => row.hash));
  }

  /**
   * Photo 엔티티를 PhotoResponse DTO로 매핑
   */
  private mapToPhotoResponse(
    photo: Photo,
    duplicateHashes: Set<string>,
  ): PhotoResponse {
    const response = new PhotoResponse();
    response.id = photo.id;
    response.fileName = photo.fileName;
    response.hash = photo.hash;
    response.originalBytes = photo.originalBytes;
    response.optimizedBytes = photo.optimizedBytes;
    response.width = photo.width;
    response.height = photo.height;
    response.createdAt = photo.createdAt;
    response.thumbnailUrl = `/uploads/thumbnails/${photo.id}.webp`;
    response.fullUrl = `/uploads/${photo.id}.webp`;
    response.savingsPercent = this.calculateSavingsPercent(
      photo.originalBytes,
      photo.optimizedBytes,
    );
    response.isDuplicate = duplicateHashes.has(photo.hash);
    return response;
  }

  /**
   * 절약률 계산: ((originalBytes - optimizedBytes) / originalBytes) * 100
   * 소수점 1자리로 반올림
   */
  private calculateSavingsPercent(
    originalBytes: number,
    optimizedBytes: number,
  ): number {
    if (originalBytes === 0) {
      return 0;
    }
    const savings =
      ((originalBytes - optimizedBytes) / originalBytes) * 100;
    return Math.round(savings * 10) / 10;
  }
}
