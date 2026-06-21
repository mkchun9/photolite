import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsNumber,
  Max,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  researchQuotaMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  windDownMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minChunkMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxFocusMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  urgencyWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  importanceWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiThreshold?: number;
}
