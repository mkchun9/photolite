import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Task } from './task.entity';
import { FixedBlock } from './fixed-block.entity';

/**
 * ScheduleAllocation 엔티티 - 일정 배치 결과 (타임 블록)
 *
 * 테이블: schedule_allocation
 * 인덱스:
 *   - idx_alloc_generation: generationId (생성 회차별 조회)
 *   - idx_alloc_start: startAt (시간순 조회)
 *
 * kind: FIXED / TASK / RESEARCH_RESERVED
 * taskId: kind=TASK 일 때 참조 (FK → task, ON DELETE CASCADE)
 * fixedBlockId: kind=FIXED 일 때 참조 (FK → fixed_block, ON DELETE SET NULL)
 */
@Entity('schedule_allocation')
@Index('idx_alloc_generation', ['generationId'])
@Index('idx_alloc_start', ['startAt'])
export class ScheduleAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  generationId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: string;

  @Column({ type: 'uuid', nullable: true })
  taskId?: string;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task?: Task;

  @Column({ type: 'uuid', nullable: true })
  fixedBlockId?: string;

  @ManyToOne(() => FixedBlock, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fixedBlockId' })
  fixedBlock?: FixedBlock;

  @Column({ type: 'timestamptz' })
  startAt: Date;

  @Column({ type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'boolean', default: false })
  locked: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
