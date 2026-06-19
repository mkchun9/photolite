import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Photo 엔티티 - 업로드된 이미지 메타데이터 저장
 *
 * 테이블: photo
 * 인덱스:
 *   - idx_photo_hash: hash 컬럼 (중복 감지용 조회 최적화)
 *   - idx_photo_created_at: createdAt DESC (갤러리 최신순 정렬 최적화)
 */
@Entity('photo')
@Index('idx_photo_created_at', ['createdAt'])
export class Photo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'char', length: 16 })
  @Index('idx_photo_hash')
  hash: string;

  @Column({ type: 'integer' })
  originalBytes: number;

  @Column({ type: 'integer' })
  optimizedBytes: number;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
