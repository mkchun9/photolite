import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseFilters,
} from '@nestjs/common';
import { FixedBlockService } from './fixed-block.service';
import { CreateFixedBlockDto } from './dto/create-fixed-block.dto';
import { FixedBlock } from './entities/fixed-block.entity';
import { SchedulerExceptionFilter } from './filters/scheduler-exception.filter';

/**
 * FixedBlockController — 고정 시간 블록 REST API
 *
 * 엔드포인트:
 * - POST   /api/v1/fixed-blocks      → 고정 블록 생성
 * - GET    /api/v1/fixed-blocks      → 전체 고정 블록 조회
 * - PATCH  /api/v1/fixed-blocks/:id  → 고정 블록 수정
 * - DELETE /api/v1/fixed-blocks/:id  → 고정 블록 삭제
 */
@Controller('v1/fixed-blocks')
@UseFilters(new SchedulerExceptionFilter())
export class FixedBlockController {
  constructor(private readonly fixedBlockService: FixedBlockService) {}

  @Post()
  async create(@Body() dto: CreateFixedBlockDto): Promise<FixedBlock> {
    return this.fixedBlockService.create(dto);
  }

  @Get()
  async findAll(): Promise<FixedBlock[]> {
    return this.fixedBlockService.findAll();
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateFixedBlockDto>,
  ): Promise<FixedBlock> {
    return this.fixedBlockService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.fixedBlockService.remove(id);
  }
}
