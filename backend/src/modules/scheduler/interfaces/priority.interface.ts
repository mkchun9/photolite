export interface PriorityBreakdown {
  score: number;
  urgency: number;
  effortDensity: number;
  normalizedImportance: number;
  remainingMinutes: number;
  minutesUntilDeadline: number;
  overdue: boolean;
}
