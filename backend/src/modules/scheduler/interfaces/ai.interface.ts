export interface AiRecommendation {
  taskId: string;
  recommended: boolean;
  suitabilityScore: number;
  useType?: string;
  prompt?: string;
  rationale: string;
}
