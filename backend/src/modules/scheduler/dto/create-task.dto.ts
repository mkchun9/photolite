import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsISO8601,
} from 'class-validator';
import { TaskCategory } from '../scheduler.constants';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TaskCategory)
  category: TaskCategory;

  @IsInt()
  @Min(1)
  @Max(5)
  importance: number;

  @IsISO8601()
  deadline: string;

  @IsInt()
  @Min(1)
  estimatedMinutes: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  completedMinutes?: number;

  @IsOptional()
  @IsISO8601()
  earliestStart?: string;
}
