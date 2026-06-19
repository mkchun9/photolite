"use client";

import { CheckCircle2, XCircle, Copy, RotateCcw } from "lucide-react";
import { formatFileSize, type UploadResponse } from "@/utils/api";

interface UploadResultProps {
  response: UploadResponse;
  onReset: () => void;
}

export function UploadResult({ response, onReset }: UploadResultProps) {
  const { totalFiles, successCount, failureCount, results } = response;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* 요약 헤더 */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-800">업로드 결과</h3>
            <div className="flex items-center gap-3 text-xs">
              {successCount > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  성공 {successCount}개
                </span>
              )}
              {failureCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-3.5 h-3.5" />
                  실패 {failureCount}개
                </span>
              )}
              <span className="text-gray-500">총 {totalFiles}개</span>
            </div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            새로 업로드
          </button>
        </div>
      </div>

      {/* 파일별 결과 리스트 */}
      <ul className="divide-y divide-gray-100">
        {results.map((item, idx) => (
          <li
            key={idx}
            className={`p-3 flex items-center gap-3 ${
              item.success ? "" : "bg-red-50/50"
            }`}
          >
            {/* 상태 아이콘 */}
            <div className="flex-shrink-0">
              {item.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
            </div>

            {/* 파일 정보 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {item.fileName}
                </p>
                {/* 중복 감지 배지 */}
                {item.isDuplicate && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full">
                    <Copy className="w-3 h-3" />
                    중복
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">
                  {formatFileSize(item.originalBytes)}
                </span>
                {item.optimizedBytes && item.optimizedBytes < item.originalBytes && (
                  <span className="text-xs text-green-600">
                    → {formatFileSize(item.optimizedBytes)} (
                    {Math.round(
                      ((item.originalBytes - item.optimizedBytes) / item.originalBytes) *
                        100
                    )}
                    % 절약)
                  </span>
                )}
                {item.error && (
                  <span className="text-xs text-red-600">{item.error}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
