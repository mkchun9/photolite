import {
  AI_SUITABILITY_THRESHOLD,
  CATEGORY_AI_BASE,
  AI_BOOST_KEYWORDS,
  AI_PENALTY_KEYWORDS,
} from './scheduler.constants';
import { AiRecommendation } from './interfaces/ai.interface';

/**
 * AI 적합도 점수 계산 (순수 함수, 결정적)
 *
 * - 카테고리 기본 점수에서 시작
 * - 제목+설명에서 부스트 키워드 발견 시 +0.05/개 (최대 +0.25)
 * - 제목+설명에서 페널티 키워드 발견 시 -0.05/개 (최대 -0.25)
 * - 최종 점수를 [0, 1]로 클램프
 */
export function computeSuitability(task: {
  category: string;
  title: string;
  description?: string;
}): number {
  const baseScore = CATEGORY_AI_BASE[task.category] ?? 0.4;

  const text = `${task.title} ${task.description ?? ''}`.toLowerCase();

  // 부스트 키워드 카운트 (고유 키워드당 +0.05, 최대 +0.25)
  let boostCount = 0;
  for (const keyword of AI_BOOST_KEYWORDS) {
    if (text.includes(keyword)) {
      boostCount++;
    }
  }
  const boost = Math.min(boostCount * 0.05, 0.25);

  // 페널티 키워드 카운트 (고유 키워드당 -0.05, 최대 -0.25)
  let penaltyCount = 0;
  for (const keyword of AI_PENALTY_KEYWORDS) {
    if (text.includes(keyword)) {
      penaltyCount++;
    }
  }
  const penalty = Math.min(penaltyCount * 0.05, 0.25);

  const finalScore = baseScore + boost - penalty;

  // [0, 1] 클램프
  return Math.max(0, Math.min(1, finalScore));
}

/**
 * 카테고리별 AI 사용 유형 반환 (순수 함수, 결정적)
 */
export function getUseType(category: string): string {
  switch (category) {
    case 'DOCUMENT':
      return '문서 초안 작성';
    case 'PERSONAL_RESEARCH':
      return '문헌 요약 및 분석';
    case 'ASSIGNMENT':
      return '과제 구조화 및 초안';
    case 'STUDY':
      return '학습 정리 및 복습';
    case 'CLASS_PREP':
      return '수업 자료 구조화';
    case 'EXAM':
      return '시험 대비 정리';
    default:
      return '일반 작업 보조';
  }
}

/**
 * 카테고리별 AI 에이전트 프롬프트 생성 (순수 함수, 결정적)
 *
 * - 프롬프트에 반드시 task.title이 포함됨 (Requirement 7.3)
 * - description이 없으면 해당 부분 생략
 */
export function buildPrompt(task: {
  title: string;
  description?: string;
  category: string;
  deadline: string;
}): string {
  const descPart = task.description ? ` ${task.description}.` : '';

  switch (task.category) {
    case 'DOCUMENT':
      return `다음 문서 작업을 도와주세요: '${task.title}'.${descPart} 마감: ${task.deadline}. 초안 작성, 구조화, 문법 검수를 수행해주세요.`;
    case 'PERSONAL_RESEARCH':
      return `다음 연구를 도와주세요: '${task.title}'.${descPart} 마감: ${task.deadline}. 관련 논문 요약, 핵심 포인트 정리, 연구 방향 제안을 해주세요.`;
    case 'ASSIGNMENT':
      return `다음 과제를 도와주세요: '${task.title}'.${descPart} 마감: ${task.deadline}. 핵심 요구사항 분석, 구조 설계, 초안 작성을 수행해주세요.`;
    case 'STUDY':
      return `다음 학습을 도와주세요: '${task.title}'.${descPart} 마감: ${task.deadline}. 핵심 개념 정리, 요약 노트 생성, 복습 질문을 만들어주세요.`;
    case 'CLASS_PREP':
      return `다음 수업 준비를 도와주세요: '${task.title}'.${descPart} 마감: ${task.deadline}. 발표 자료 구조화, 핵심 포인트 정리를 해주세요.`;
    case 'EXAM':
      return `다음 시험 준비를 도와주세요: '${task.title}'.${descPart} 마감: ${task.deadline}. 핵심 내용 요약, 예상 문제 생성, 약점 분석을 해주세요.`;
    default:
      return `다음 작업을 도와주세요: '${task.title}'.${descPart} 마감: ${task.deadline}.`;
  }
}

/**
 * AI 추천 결과 생성 (순수 함수, 결정적)
 *
 * - suitabilityScore >= threshold → recommended=true, prompt+useType 생성
 * - suitabilityScore < threshold → recommended=false, prompt=undefined
 */
export function getRecommendation(
  task: {
    id: string;
    title: string;
    description?: string;
    category: string;
    deadline: string;
  },
  threshold: number = AI_SUITABILITY_THRESHOLD,
): AiRecommendation {
  const suitabilityScore = computeSuitability(task);

  if (suitabilityScore >= threshold) {
    return {
      taskId: task.id,
      recommended: true,
      suitabilityScore,
      useType: getUseType(task.category),
      prompt: buildPrompt(task),
      rationale: `카테고리(${task.category}) 기본 적합도와 키워드 분석 결과 AI 보조에 적합합니다.`,
    };
  }

  // 부적합 사유 결정
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase();
  const hasPenaltyKeywords = AI_PENALTY_KEYWORDS.some((kw) => text.includes(kw));

  const rationale = hasPenaltyKeywords
    ? '실험/대면 활동은 AI 보조에 적합하지 않습니다.'
    : '카테고리 기본 적합도가 임계값 미만입니다.';

  return {
    taskId: task.id,
    recommended: false,
    suitabilityScore,
    useType: undefined,
    prompt: undefined,
    rationale,
  };
}
