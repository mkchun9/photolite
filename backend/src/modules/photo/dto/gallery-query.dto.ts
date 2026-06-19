import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../photo.constants';

/**
 * 갤러리 조회 쿼리 파라미터 DTO
 * - page: 페이지 번호 (최소 1)
 * - pageSize: 페이지당 이미지 수 (기본 20, 최대 100)
 */
export class GalleryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}
