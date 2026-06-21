"use client";

import { useState, useEffect } from "react";
import { X, Save, Plus } from "lucide-react";
import type { FixedBlock, FixedBlockType, FixedBlockInput } from "@/hooks/useFixedBlocks";

/** 타입 옵션 */
const TYPE_OPTIONS: { value: FixedBlockType; label: string }[] = [
  { value: "SLEEP", label: "수면" },
  { value: "MEAL", label: "식사" },
  { value: "EXERCISE", label: "운동" },
  { value: "CLASS", label: "수업" },
  { value: "CUSTOM", label: "사용자 정의" },
];

/** 요일 목록 (일~토) */
const DAYS_OF_WEEK = [
  { bit: 0, label: "일" },
  { bit: 1, label: "월" },
  { bit: 2, label: "화" },
  { bit: 3, label: "수" },
  { bit: 4, label: "목" },
  { bit: 5, label: "금" },
  { bit: 6, label: "토" },
];

/** minutes from midnight → "HH:MM" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** "HH:MM" → minutes from midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

interface FixedBlockFormProps {
  editBlock?: FixedBlock | null;
  onSubmit: (data: FixedBlockInput) => Promise<void>;
  onClose: () => void;
}

export function FixedBlockForm({ editBlock, onSubmit, onClose }: FixedBlockFormProps) {
  const [type, setType] = useState<FixedBlockType>("CUSTOM");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isRecurring, setIsRecurring] = useState(true);
  const [daysOfWeek, setDaysOfWeek] = useState<number>(0b0111110); // 평일 기본
  const [specificDate, setSpecificDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 수정 모드일 때 기존 값 세팅
  useEffect(() => {
    if (editBlock) {
      setType(editBlock.type);
      setTitle(editBlock.title);
      setStartTime(minutesToTime(editBlock.startMinute));
      setEndTime(minutesToTime(editBlock.endMinute));
      setIsRecurring(editBlock.isRecurring);
      setDaysOfWeek(editBlock.daysOfWeek ?? 0b0111110);
      setSpecificDate(editBlock.specificDate ?? "");
    }
  }, [editBlock]);

  function toggleDay(bit: number) {
    setDaysOfWeek((prev) => prev ^ (1 << bit));
  }

  function isDaySelected(bit: number): boolean {
    return (daysOfWeek & (1 << bit)) !== 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError("제목을 입력해주세요.");
      return;
    }
    if (!startTime) {
      setValidationError("시작 시간을 입력해주세요.");
      return;
    }
    if (!endTime) {
      setValidationError("종료 시간을 입력해주세요.");
      return;
    }
    if (isRecurring && daysOfWeek === 0) {
      setValidationError("반복 요일을 하나 이상 선택해주세요.");
      return;
    }
    if (!isRecurring && !specificDate) {
      setValidationError("날짜를 선택해주세요.");
      return;
    }

    const data: FixedBlockInput = {
      type,
      title: title.trim(),
      startMinute: timeToMinutes(startTime),
      endMinute: timeToMinutes(endTime),
      isRecurring,
    };

    if (isRecurring) {
      data.daysOfWeek = daysOfWeek;
      data.specificDate = null;
    } else {
      data.daysOfWeek = null;
      data.specificDate = specificDate;
    }

    setSubmitting(true);
    try {
      await onSubmit(data);
    } catch {
      setValidationError("저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const isOvernight = timeToMinutes(endTime) <= timeToMinutes(startTime);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <h2 className="text-lg font-semibold text-gray-900">
            {editBlock ? "고정 블록 수정" : "새 고정 블록 추가"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 타입 */}
          <div>
            <label htmlFor="block-type" className="block text-sm font-medium text-gray-700 mb-1">
              유형 <span className="text-red-500">*</span>
            </label>
            <select
              id="block-type"
              value={type}
              onChange={(e) => setType(e.target.value as FixedBlockType)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 제목 */}
          <div>
            <label htmlFor="block-title" className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="block-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 취침, 점심, 헬스장"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
            />
          </div>

          {/* 시작/종료 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="block-start" className="block text-sm font-medium text-gray-700 mb-1">
                시작 시간 <span className="text-red-500">*</span>
              </label>
              <input
                id="block-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label htmlFor="block-end" className="block text-sm font-medium text-gray-700 mb-1">
                종료 시간 <span className="text-red-500">*</span>
              </label>
              <input
                id="block-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* 자정 넘김 안내 */}
          {isOvernight && (
            <div className="px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-600">
              종료 시간이 시작 시간보다 빠르면 자정을 넘어 다음 날까지 이어집니다
            </div>
          )}

          {/* 반복 토글 */}
          <div className="flex items-center gap-3">
            <label htmlFor="block-recurring" className="text-sm font-medium text-gray-700">
              반복
            </label>
            <button
              id="block-recurring"
              type="button"
              role="switch"
              aria-checked={isRecurring}
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isRecurring ? "bg-indigo-500" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isRecurring ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-xs text-gray-500">
              {isRecurring ? "매주 반복" : "일회성"}
            </span>
          </div>

          {/* 반복: 요일 선택 */}
          {isRecurring && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                반복 요일 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1.5">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.bit}
                    type="button"
                    onClick={() => toggleDay(day.bit)}
                    className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${
                      isDaySelected(day.bit)
                        ? "bg-indigo-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 일회성: 날짜 선택 */}
          {!isRecurring && (
            <div>
              <label htmlFor="block-date" className="block text-sm font-medium text-gray-700 mb-1">
                날짜 <span className="text-red-500">*</span>
              </label>
              <input
                id="block-date"
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
              />
            </div>
          )}

          {/* 검증 에러 */}
          {validationError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {validationError}
            </div>
          )}

          {/* 제출 버튼 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : editBlock ? (
                <Save className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {editBlock ? "저장" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
