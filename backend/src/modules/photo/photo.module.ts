import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoController } from './photo.controller';
import { ThumbnailController } from './thumbnail.controller';
import { PhotoService } from './photo.service';
import { OptimizationEngine } from './optimization.engine';
import { DuplicateDetector } from './duplicate.detector';
import { GalleryService } from './gallery.service';
import { StatisticsService } from './statistics.service';
import { Photo } from './entities/photo.entity';

/**
 * PhotoModule - 사진 업로드, 최적화, 중복 감지, 갤러리, 통계 기능을 담당하는 모듈
 */
@Module({
  imports: [TypeOrmModule.forFeature([Photo])],
  controllers: [PhotoController, ThumbnailController],
  providers: [PhotoService, OptimizationEngine, DuplicateDetector, StatisticsService, GalleryService],
  exports: [PhotoService, OptimizationEngine, DuplicateDetector, StatisticsService, GalleryService],
})
export class PhotoModule {}
