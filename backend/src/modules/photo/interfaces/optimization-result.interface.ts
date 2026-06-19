export interface OptimizationResult {
  /** 최적화된 이미지 버퍼 */
  buffer: Buffer;
  /** 최적화 후 너비 (px) */
  width: number;
  /** 최적화 후 높이 (px) */
  height: number;
  /** 최적화 후 파일 크기 (bytes) */
  bytes: number;
  /** 출력 포맷 */
  format: 'webp';
  /** 원본이 더 작아서 최적화를 스킵했는지 여부 */
  skipped: boolean;
}
