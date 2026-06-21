import { IsOptional, IsInt, Min, Max, IsISO8601 } from 'class-validator';

export class GenerateScheduleDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  horizonDays?: number;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
