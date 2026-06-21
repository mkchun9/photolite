"use client";

import { useState } from "react";
import { X, Copy, Check, Sparkles, ThumbsDown } from "lucide-react";
import type { AiRecommendation } from "@/hooks/useScheduler";

interface AiPromptModalProps {
  recommendation: AiRecommendation;
  taskTitle: string;
  onClose: () => void;
}

export function AiPromptModal({ recommendation, taskTitle, onClose }: AiPromptModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!recommendation.prompt) return;
    try {
      await navigator.clipboard.writeText(recommendation.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 접근 실패 시 무시
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="AI 추천 프롬프트"
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">AI 추천</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-4">
          {/* 태스크 정보 */}
          <div>
            <p className="text-sm text-gray-500">태스크</p>
            <p className="text-base font-medium text-gray-900">{taskTitle}</p>
          </div>

          {/* 적합도 점수 */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-gray-500">적합도 점수</p>
              <p className="text-2xl font-bold text-indigo-600">
                {(recommendation.suitabilityScore * 100).toFixed(0)}%
              </p>
            </div>
            {recommendation.recommended && recommendation.useType && (
              <div>
                <p className="text-sm text-gray-500">사용 유형</p>
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-indigo-50 text-indigo-700 rounded-lg">
                  {recommendation.useType}
                </span>
              </div>
            )}
          </div>

          {/* 추천 여부에 따른 콘텐츠 */}
          {recommendation.recommended ? (
            <>
              {/* 프롬프트 */}
              {recommendation.prompt && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">AI 프롬프트</p>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          복사됨
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          복사
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {recommendation.prompt}
                  </div>
                </div>
              )}

              {/* 추천 사유 */}
              <div>
                <p className="text-sm text-gray-500">추천 사유</p>
                <p className="text-sm text-gray-700 mt-1">{recommendation.rationale}</p>
              </div>
            </>
          ) : (
            /* 비추천 */
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <ThumbsDown className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">AI 추천 없음</p>
                <p className="text-sm text-gray-600">{recommendation.rationale}</p>
              </div>
            </div>
          )}
        </div>

        {/* 하단 */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
