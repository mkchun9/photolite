import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FixedBlock } from './entities/fixed-block.entity';
import { CreateFixedBlockDto } from './dto/create-fixed-block.dto';
import { FixedBlockType } from './scheduler.constants';

/**
 * FixedBlockService — 고정 시간 블록 CRUD, 충돌 검증, 기본 시드 관리
 *
 * overnight wrap(endMinute <= startMinute) 블록은 두 세그먼트로 분리하여
 * 충돌 검출 시 올바르게 비교합니다.
 */
@Injectable()
export class FixedBlockService implements OnModuleInit {
  constructor(
    @InjectRepository(FixedBlock)
    private readonly fixedBlockRepository: Repository<FixedBlock>,
  ) {}

  /**
   * 모듈 초기화 시 기본 고정 블록 시드
   */
  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  /**
   * 고정 블록 생성
   */
  async create(dto: CreateFixedBlockDto): Promise<FixedBlock> {
    const block = this.fixedBlockRepository.create(dto);
    await this.checkConflicts(block);
    return this.fixedBlockRepository.save(block);
  }

  /**
   * 모든 고정 블록 조회
   */
  async findAll(): Promise<FixedBlock[]> {
    return this.fixedBlockRepository.find();
  }

  /**
   * ID로 고정 블록 조회
   */
  async findOne(id: string): Promise<FixedBlock> {
    const block = await this.fixedBlockRepository.findOne({ where: { id } });
    if (!block) {
      throw new NotFoundException(`FixedBlock with id "${id}" not found`);
    }
    return block;
  }

  /**
   * 고정 블록 수정
   */
  async update(
    id: string,
    dto: Partial<CreateFixedBlockDto>,
  ): Promise<FixedBlock> {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...dto };
    await this.checkConflicts(merged, id);
    Object.assign(existing, dto);
    return this.fixedBlockRepository.save(existing);
  }

  /**
   * 고정 블록 삭제 (잠금된 allocation은 유지됨)
   */
  async remove(id: string): Promise<void> {
    const block = await this.findOne(id);
    await this.fixedBlockRepository.remove(block);
  }

  /**
   * Overnight wrap을 고려하여 블록의 유효 시간 범위를 반환합니다.
   *
   * - endMinute > startMinute: 단일 세그먼트 [startMinute, endMinute)
   * - endMinute <= startMinute: 두 세그먼트 [startMinute, 1440) + [0, endMinute)
   */
  getEffectiveRanges(
    block: Partial<FixedBlock>,
  ): { startMinute: number; endMinute: number }[] {
    const start = block.startMinute!;
    const end = block.endMinute!;

    if (end > start) {
      return [{ startMinute: start, endMinute: end }];
    }

    // overnight wrap: 자정을 넘어감
    const ranges: { startMinute: number; endMinute: number }[] = [];
    // Day D: [startMinute, 1440)
    ranges.push({ startMinute: start, endMinute: 1440 });
    // Day D+1: [0, endMinute)
    if (end > 0) {
      ranges.push({ startMinute: 0, endMinute: end });
    }
    return ranges;
  }

  /**
   * 충돌 검증: 블록의 시간이 기존 블록과 겹치는지 확인
   *
   * 두 블록이 충돌하려면:
   * 1. 공유하는 요일이 있어야 함 (recurring: daysOfWeek 비트마스크 교집합,
   *    one-off: specificDate의 요일이 recurring 블록의 daysOfWeek에 포함)
   * 2. 시간 범위가 겹쳐야 함 (overnight wrap 고려)
   */
  async checkConflicts(
    block: Partial<FixedBlock>,
    excludeId?: string,
  ): Promise<void> {
    const allBlocks = await this.fixedBlockRepository.find();
    const blockRanges = this.getEffectiveRanges(block);

    for (const existing of allBlocks) {
      // 자기 자신은 제외
      if (excludeId && existing.id === excludeId) {
        continue;
      }

      // 1. 요일 공유 여부 확인
      if (!this.sharesDay(block, existing)) {
        continue;
      }

      // 2. 시간 범위 겹침 확인
      const existingRanges = this.getEffectiveRanges(existing);
      if (this.rangesOverlap(blockRanges, existingRanges)) {
        throw new ConflictException({
          error: 'FIXED_BLOCK_CONFLICT',
          conflictId: existing.id,
        });
      }
    }
  }

  /**
   * 두 블록이 공유하는 요일이 있는지 확인
   */
  private sharesDay(
    blockA: Partial<FixedBlock>,
    blockB: Partial<FixedBlock>,
  ): boolean {
    // 둘 다 recurring인 경우: daysOfWeek 비트마스크 교집합
    if (blockA.isRecurring && blockB.isRecurring) {
      const daysA = blockA.daysOfWeek ?? 0;
      const daysB = blockB.daysOfWeek ?? 0;
      return (daysA & daysB) !== 0;
    }

    // 둘 다 one-off인 경우: 같은 날짜인지 확인
    if (!blockA.isRecurring && !blockB.isRecurring) {
      return blockA.specificDate === blockB.specificDate;
    }

    // 하나는 recurring, 하나는 one-off인 경우
    const recurring = blockA.isRecurring ? blockA : blockB;
    const oneOff = blockA.isRecurring ? blockB : blockA;

    if (!oneOff.specificDate || recurring.daysOfWeek == null) {
      return false;
    }

    // specificDate의 요일을 계산하여 recurring의 daysOfWeek에 포함되는지 확인
    const date = new Date(oneOff.specificDate);
    const dayOfWeek = date.getUTCDay(); // 0=일, 1=월, ..., 6=토
    const dayBit = 1 << dayOfWeek;
    return (recurring.daysOfWeek & dayBit) !== 0;
  }

  /**
   * 두 시간 범위 집합이 겹치는지 확인
   */
  private rangesOverlap(
    rangesA: { startMinute: number; endMinute: number }[],
    rangesB: { startMinute: number; endMinute: number }[],
  ): boolean {
    for (const a of rangesA) {
      for (const b of rangesB) {
        // 두 구간 [a.start, a.end)와 [b.start, b.end)가 겹치는지 확인
        if (a.startMinute < b.endMinute && b.startMinute < a.endMinute) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 기본 고정 블록 시드
   * 모듈 초기화 시 블록이 없으면 기본 블록을 생성합니다.
   */
  async seedDefaults(): Promise<void> {
    const count = await this.fixedBlockRepository.count();
    if (count > 0) {
      return;
    }

    const defaults: Partial<FixedBlock>[] = [
      // SLEEP: 수면 23:00–07:00 (overnight wrap)
      {
        type: FixedBlockType.SLEEP,
        title: '수면',
        startMinute: 1380, // 23:00
        endMinute: 420, // 07:00
        daysOfWeek: 127, // 매일 (0b1111111)
        isRecurring: true,
      },
      // MEAL: 아침 07:00–07:30
      {
        type: FixedBlockType.MEAL,
        title: '아침',
        startMinute: 420, // 07:00
        endMinute: 450, // 07:30
        daysOfWeek: 127,
        isRecurring: true,
      },
      // MEAL: 점심 12:00–13:00
      {
        type: FixedBlockType.MEAL,
        title: '점심',
        startMinute: 720, // 12:00
        endMinute: 780, // 13:00
        daysOfWeek: 127,
        isRecurring: true,
      },
      // MEAL: 저녁 18:00–19:00
      {
        type: FixedBlockType.MEAL,
        title: '저녁',
        startMinute: 1080, // 18:00
        endMinute: 1140, // 19:00
        daysOfWeek: 127,
        isRecurring: true,
      },
      // EXERCISE: 운동 06:30–07:00
      {
        type: FixedBlockType.EXERCISE,
        title: '운동',
        startMinute: 390, // 06:30
        endMinute: 420, // 07:00
        daysOfWeek: 127,
        isRecurring: true,
      },
    ];

    const entities = defaults.map((d) => this.fixedBlockRepository.create(d));
    await this.fixedBlockRepository.save(entities);
  }
}
