import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UploadedFiles,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PhotoService } from './photo.service';
import { GalleryService } from './gallery.service';
import { StatisticsService } from './statistics.service';
import { FileValidationPipe } from './pipes/file-validation.pipe';
import { GalleryQueryDto } from './dto/gallery-query.dto';
import { MAX_FILES_PER_REQUEST } from './photo.constants';
import {
  PaginatedGalleryResponse,
  PhotoResponse,
  StatisticsResponse,
} from './dto/photo-response.dto';
import { UploadResponse } from './photo.service';

/**
 * PhotoController - REST API 엔드포인트
 *
 * 라우트 경로 (전역 prefix 'api' 적용):
 * - POST   /api/photos/upload      → 멀티파트 파일 업로드 (최대 10개)
 * - GET    /api/photos             → 갤러리 조회 (페이지네이션, createdAt DESC)
 * - GET    /api/photos/statistics  → 절약 통계 조회
 * - GET    /api/photos/:id         → 개별 사진 상세 조회
 *
 * 주의: statistics 라우트는 :id 라우트보다 위에 선언되어야 함
 *       (NestJS가 "statistics"를 UUID 파라미터로 해석하지 않도록)
 *
 * Validates: Requirements 1.1~1.7, 4.1~4.8, 5.1~5.8, 6.1~6.8
 */
@Controller('photos')
export class PhotoController {
  constructor(
    private readonly photoService: PhotoService,
    private readonly galleryService: GalleryService,
    private readonly statisticsService: StatisticsService,
  ) {}

  /**
   * POST /api/photos/upload
   * 멀티파트 파일 업로드 (최대 10개)
   *
   * - Multer FilesInterceptor로 'files' 필드에서 최대 10개 파일 추출
   * - FileValidationPipe로 MIME, magic bytes, 크기, 개수 검증
   * - PhotoService.processUpload()로 최적화 → 중복 감지 → 저장
   *
   * Validates: Requirements 1.1~1.7, 6.1~6.8
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_REQUEST))
  async upload(
    @UploadedFiles(FileValidationPipe)
    files: Express.Multer.File[],
  ): Promise<UploadResponse> {
    return this.photoService.processUpload(files);
  }

  /**
   * GET /api/photos
   * 갤러리 목록 조회 (페이지네이션)
   *
   * - GalleryQueryDto로 page, pageSize 쿼리 파라미터 검증
   * - createdAt DESC 정렬
   * - 범위 외 페이지 요청 시 빈 목록 반환
   *
   * Validates: Requirements 4.1~4.8
   */
  @Get()
  async getGallery(
    @Query() query: GalleryQueryDto,
  ): Promise<PaginatedGalleryResponse> {
    return this.galleryService.getGallery(query);
  }

  /**
   * GET /api/photos/statistics
   * 절약 통계 조회
   *
   * - 전체 이미지 수, 원본/최적화 크기 합계, 절약 용량/비율 계산
   * - 이미지가 없으면 모든 값 0 반환
   *
   * 주의: 이 라우트는 :id 라우트보다 위에 선언되어야 함
   *
   * Validates: Requirements 5.1~5.8
   */
  @Get('statistics')
  async getStatistics(): Promise<StatisticsResponse> {
    return this.statisticsService.getStatistics();
  }

  /**
   * GET /api/photos/:id
   * 개별 사진 상세 조회
   *
   * - UUID 형식 검증 (ParseUUIDPipe)
   * - 존재하지 않으면 404 NotFoundException
   *
   * Validates: Requirements 4.5~4.8
   */
  @Get(':id')
  async getPhotoDetail(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PhotoResponse> {
    return this.galleryService.getPhotoDetail(id);
  }
}
