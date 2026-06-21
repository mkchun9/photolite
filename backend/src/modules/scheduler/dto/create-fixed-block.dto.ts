import {
  IsEnum,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { FixedBlockType } from '../scheduler.constants';

export class CreateFixedBlockDto {
  @IsEnum(FixedBlockType)
  type: FixedBlockType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(127)
  daysOfWeek?: number;

  @IsOptional()
  @IsDateString()
  specificDate?: string;

  @IsBoolean()
  isRecurring: boolean;
}
