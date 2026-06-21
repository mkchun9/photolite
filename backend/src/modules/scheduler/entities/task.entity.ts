import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Task 엔티티 - 마감 기한과 중요도를 가진 유동 업무(태스크)
 *
 * 테이블: task
 * 인덱스:
 *   - idx_task_deadline: deadline 컬럼 (마감순 조회 최적화)
 *   - idx_task_status: status 컬럼 (상태별 필터링 최적화)
 */
@Entity('task')
@Index('idx_task_deadline', ['deadline'])
@Index('idx_task_status', ['status'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20 })
  category: string;

  @Column({ type: 'smallint' })
  importance: number;

  @Column({ type: 'timestamptz' })
  deadline: Date;

  @Column({ type: 'integer' })
  estimatedMinutes: number;

  @Column({ type: 'integer', default: 0 })
  completedMinutes: number;

  @Column({ type: 'timestamptz', nullable: true })
  earliestStart?: Date;

  @Column({ type: 'varchar', length: 12, default: 'PENDING' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
