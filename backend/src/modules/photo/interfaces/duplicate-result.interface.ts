export interface DuplicateResult {
  /** 중복 여부 */
  isDuplicate: boolean;
  /** 64-bit aHash (16자 hex string) */
  hash: string;
  /** 유사 이미지 목록 (최대 10개, score 내림차순) */
  similarImages: Array<{
    id: string;
    similarityScore: number; // 0.0 ~ 1.0
  }>;
  /** 처리 상태 */
  status: 'completed' | 'skipped' | 'timeout';
}
