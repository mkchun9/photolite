import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * FixedBlock 엔티티 - 시간이 고정된 필수 시간 블록 (취침/식사/운동/수업/사용자정의)
 *
 * 테이블: fixed_block
 *
 * startMinute/endMinute: 자정 기준 분 단위 (0~1439 / 0~1440)
 * endMinute <= startMinute 인 경우 → 자정을 넘어 익일까지 이어지는 블록 (overnight wrap)
 * daysOfWeek: 요일 비트마스크 (0=일~6=토), isRecurring=true 시 사용
 * specificDate: 단발성 블록, isRecurring=false 시 사용
 */
@Entity('fixed_block')
export class FixedBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  type: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'smallint' })
  startMinute: number;

  @Column({ type: 'smallint' })
  endMinute: number;

  @Column({ type: 'smallint', nullable: true })
  daysOfWeek?: number;

  @Column({ type: 'date', nullable: true })
  specificDate?: string;

  @Column({ type: 'boolean' })
  isRecurring: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
