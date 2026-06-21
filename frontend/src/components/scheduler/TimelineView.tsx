"use client";

import { useState, useEffect } from "react";
import { Lock, Unlock, AlertTriangle, Clock, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useSchedule } from "@/hooks/useSchedule";
import type { TimeBlock, UnscheduledTask } from "@/hooks/useSchedule";

/** 블록 종류별 색상 */
const KIND_COLORS: Record<string, string> = {
  FIXED: "bg-slate-100 border-slate-300 text-slate-700",
  TASK: "bg-indigo-100 border-indigo-300 text-indigo-700",
  RESEARCH_RESERVED: "bg-green-100 border-green-300 text-green-700",
};

/** 블록 종류 한글 라벨 */
const KIND_LABELS: Record<string, string> = {
  FIXED: "고정",
  TASK: "태스크",
  RESEARCH_RESERVED: "연구 보호",
};

/** 남은 기한 뱃지 색상 */
const REMAINING_BADGE_COLORS: Record<string, string> = {
  OVERDUE: "bg-red-500 text-white",
  CRITICAL: "bg-orange-500 text-white",
  WARNING: "bg-yellow-400 text-yellow-900",
  NORMAL: "bg-green-500 text-white",
};

export function TimelineView() {
  const {
    plan,
    status,
    error,
    serverNow,
    generateSchedule,
    fetchSchedule,
    lockAllocation,
    unlockAllocation,
    fetchNow,
  } = useSchedule();

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return formatDateLocal(today);
  });
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [generating, setGenerating] = useState(false);

  // 초기 로드: 서버 시각 및 일정 조회
  useEffect(() => {
    fetchNow();
    const start = selectedDate;
    const end = addDays(selectedDate, 1);
    fetchSchedule(start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  /** 일정 생성 */
  async function handleGenerate() {
    setGenerating(true);
    await generateSchedule(horizonDays);
    setGenerating(false);
  }

  /** 잠금 토글 */
  async function handleLockToggle(block: TimeBlock) {
    if (!block.id) return;
    if (block.locked) {
      await unlockAllocation(block.id);
    } else {
      await lockAllocation(block.id);
    }
  }

  /** 날짜 이동 */
  function goToPrevDay() {
    setSelectedDate(addDays(selectedDate, -1));
  }

  function goToNextDay() {
    setSelectedDate(addDays(selectedDate, 1));
  }

  /** 선택된 날짜의 블록 필터링 */
  const dayAllocations = plan?.allocations.filter((a) => {
    const blockDate = new Date(a.start).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const selDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return blockDate === selDate;
  }) ?? [];

  return (
    <div className="space-y-4">
      {/* 서버 현재 시각 */}
      {serverNow && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
          <Clock className="w-3.5 h-3.5" />
          <span>서버 시각: {formatDateTime(serverNow.now)} ({serverNow.timezone})</span>
        </div>
      )}

      {/* 일정 생성 컨트롤 */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <label htmlFor="horizon-days" className="text-sm font-medium text-gray-700">
            계획 기간
          </label>
          <input
            id="horizon-days"
            type="number"
            min={1}
            max={30}
            value={horizonDays}
            onChange={(e) => setHorizonDays(Math.max(1, Math.min(30, Number(e.target.value))))}
            className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <span className="text-sm text-gray-500">일</span>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "생성 중..." : "일정 생성"}
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 날짜 선택 */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={goToPrevDay}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="이전 날짜"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={goToNextDay}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="다음 날짜"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* 타임라인 */}
      {status === "loading" && !plan ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <span className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm">일정을 불러오는 중...</span>
          </div>
        </div>
      ) : dayAllocations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <Clock className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-base font-medium text-gray-600 mb-1">
            이 날짜에 배치된 일정이 없습니다
          </h3>
          <p className="text-sm text-gray-400">
            &quot;일정 생성&quot; 버튼을 눌러 일정을 생성해보세요.
          </p>
        </div>
      ) : (
        <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* 시간 스케일 + 블록 */}
          <div className="divide-y divide-gray-100">
            {dayAllocations.map((block, idx) => (
              <TimelineBlock
                key={block.id ?? `${block.start}-${idx}`}
                block={block}
                onLockToggle={handleLockToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* 용량 경고 */}
      {plan && plan.dayCapacityWarnings && plan.dayCapacityWarnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">⚠️ 용량 경고</h4>
          {plan.dayCapacityWarnings.map((w, i) => (
            <div
              key={`warn-${i}`}
              className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>{w.date}</strong>: {w.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 미배치 태스크 (at-risk) */}
      {plan && plan.atRisk && plan.atRisk.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-700">🚨 미배치 태스크 (위험)</h4>
          <div className="space-y-2">
            {plan.atRisk.map((task) => (
              <AtRiskCard key={task.taskId} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 개별 타임라인 블록 */
function TimelineBlock({
  block,
  onLockToggle,
}: {
  block: TimeBlock;
  onLockToggle: (block: TimeBlock) => void;
}) {
  const startTime = formatTime(block.start);
  const endTime = formatTime(block.end);

  return (
    <div className="flex items-stretch">
      {/* 시간 라벨 */}
      <div className="w-20 shrink-0 px-3 py-3 flex flex-col justify-center text-xs text-gray-500 border-r border-gray-100 bg-gray-50/50">
        <span className="font-medium">{startTime}</span>
        <span className="text-gray-400">~{endTime}</span>
      </div>

      {/* 블록 내용 */}
      <div className={`flex-1 px-4 py-3 border-l-4 ${KIND_COLORS[block.kind]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-white/60">
              {KIND_LABELS[block.kind]}
            </span>
            <span className="text-sm font-medium truncate">{block.title}</span>
          </div>

          {/* 잠금 토글 (TASK 블록만) */}
          {block.kind === "TASK" && block.id && (
            <button
              type="button"
              onClick={() => onLockToggle(block)}
              className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                block.locked
                  ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }`}
              aria-label={block.locked ? "잠금 해제" : "잠금"}
              title={block.locked ? "잠금 해제" : "잠금"}
            >
              {block.locked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 미배치 태스크 카드 */
function AtRiskCard({ task }: { task: UnscheduledTask }) {
  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-red-800 truncate">{task.title}</p>
          <p className="text-xs text-red-600 mt-1">
            미배치: {task.unplacedMinutes}분 | 사유: {task.reason}
          </p>
        </div>
      </div>
      <p className="text-xs text-red-500 mt-1.5 italic">💡 {task.suggestion}</p>
    </div>
  );
}

/** 유틸: ISO 문자열에서 시각(HH:mm) 추출 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** 유틸: ISO 문자열을 날짜+시각 포맷 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  const secs = d.getSeconds().toString().padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day} ${hours}:${mins}:${secs}`;
}

/** 유틸: YYYY-MM-DD 형식으로 포맷 */
function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 유틸: YYYY-MM-DD에 일수 추가 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDateLocal(d);
}
