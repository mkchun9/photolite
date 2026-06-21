import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

/**
 * SchedulerSettings 엔티티 - 스케줄러 설정 (단일 행 테이블)
 *
 * 테이블: scheduler_settings
 *
 * 연구 쿼터, 버퍼, 우선순위 가중치 등 스케줄링 파라미터를 관리한다.
 * 단일 사용자(single-tenant) 구조이므로 1행만 존재한다.
 */
@Entity('scheduler_settings')
export class SchedulerSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40, default: 'Asia/Seoul' })
  timezone: string;

  @Column({ type: 'integer', default: 180 })
  researchQuotaMin: number;

  @Column({ type: 'integer', default: 10 })
  bufferMin: number;

  @Column({ type: 'integer', default: 30 })
  windDownMin: number;

  @Column({ type: 'integer', default: 25 })
  minChunkMin: number;

  @Column({ type: 'integer', default: 120 })
  maxFocusMin: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.6 })
  urgencyWeight: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.4 })
  importanceWeight: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  aiThreshold: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
