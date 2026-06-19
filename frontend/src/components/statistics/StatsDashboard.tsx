"use client";

import { useStatistics } from "@/hooks/useStatistics";
import { formatFileSize } from "@/utils/api";
import { BarChart3, RefreshCw, AlertCircle, ImageIcon, Copy, HardDrive, TrendingDown } from "lucide-react";

/** 절약률에 따른 프로그레스 바 색상 결정 */
function getProgressColor(percent: number): string {
  if (percent >= 50) return "bg-green-500";
  if (percent >= 30) return "bg-emerald-500";
  if (percent >= 15) return "bg-yellow-500";
  return "bg-orange-500";
}

/** 로딩 스켈레톤 */
function StatsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
            <div className="h-7 bg-gray-200 rounded w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 에러 상태 */
function StatsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-800 mb-2">통계 조회 실패</h3>
      <p className="text-sm text-gray-600 mb-6 max-w-md">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        다시 시도
      </button>
    </div>
  );
}

/** 빈 상태 (이미지 없음) */
function StatsEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <ImageIcon className="w-12 h-12 text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-800 mb-2">아직 업로드된 사진이 없어요</h3>
      <p className="text-sm text-gray-600">사진을 업로드하면 절약 통계를 확인할 수 있습니다.</p>
    </div>
  );
}

/** 통계 카드 */
function StatCard({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
    </div>
  );
}

/** 절약률 프로그레스 바 */
function SavingsProgressBar({ percent }: { percent: number }) {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const colorClass = getProgressColor(clampedPercent);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-green-600" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">절약률</span>
        </div>
        <span className="text-lg font-bold text-gray-900">{clampedPercent.toFixed(1)}%</span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        원본 대비 {clampedPercent.toFixed(1)}% 용량을 절약했습니다
      </p>
    </div>
  );
}

export function StatsDashboard() {
  const { statistics, status, errorMessage, retry } = useStatistics();

  if (status === "idle" || status === "loading") {
    return <StatsSkeleton />;
  }

  if (status === "error") {
    return <StatsError message={errorMessage ?? "알 수 없는 오류"} onRetry={retry} />;
  }

  if (!statistics || statistics.count === 0) {
    return <StatsEmpty />;
  }

  return (
    <div className="space-y-6">
      {/* 절약률 프로그레스 바 */}
      <SavingsProgressBar percent={statistics.savedPercent} />

      {/* 통계 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<ImageIcon className="w-4 h-4 text-blue-600" />}
          label="총 이미지"
          value={`${statistics.count}장`}
        />
        <StatCard
          icon={<HardDrive className="w-4 h-4 text-purple-600" />}
          label="원본 크기"
          value={formatFileSize(statistics.totalOriginalBytes)}
        />
        <StatCard
          icon={<HardDrive className="w-4 h-4 text-indigo-600" />}
          label="최적화 크기"
          value={formatFileSize(statistics.totalOptimizedBytes)}
        />
        <StatCard
          icon={<TrendingDown className="w-4 h-4 text-green-600" />}
          label="절약 용량"
          value={formatFileSize(statistics.savedBytes)}
        />
        <StatCard
          icon={<BarChart3 className="w-4 h-4 text-amber-600" />}
          label="절약 퍼센트"
          value={`${statistics.savedPercent.toFixed(1)}%`}
        />
        <StatCard
          icon={<Copy className="w-4 h-4 text-red-500" />}
          label="중복 이미지"
          value={`${statistics.duplicateCount}장`}
        />
      </div>
    </div>
  );
}
