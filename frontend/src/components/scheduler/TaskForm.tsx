"use client";

import { useState, useEffect } from "react";
import { X, Save, Plus } from "lucide-react";
import type { TaskCategory, TaskInput, TaskResponse } from "@/hooks/useScheduler";

/** 카테고리 옵션 */
const CATEGORY_OPTIONS: { value: TaskCategory; label: string }[] = [
  { value: "DOCUMENT", label: "서류 작업" },
  { value: "ASSIGNMENT", label: "과제" },
  { value: "PERSONAL_RESEARCH", label: "개인 연구" },
  { value: "STUDY", label: "공부" },
  { value: "CLASS_PREP", label: "수업 준비" },
  { value: "EXAM", label: "시험" },
  { value: "OTHER", label: "기타" },
];

interface TaskFormProps {
  /** 수정 모드일 때 기존 태스크 데이터 */
  editTask?: TaskResponse | null;
  /** 폼 제출 핸들러 */
  onSubmit: (data: TaskInput) => Promise<unknown>;
  /** 폼 닫기 */
  onClose: () => void;
}

export function TaskForm({ editTask, onSubmit, onClose }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategory>("OTHER");
  const [importance, setImportance] = useState(3);
  const [deadline, setDeadline] = useState("");
  const [noDeadline, setNoDeadline] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [earliestStart, setEarliestStart] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 수정 모드일 때 기존 값 세팅
  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description || "");
      setCategory(editTask.category);
      setImportance(editTask.importance);
      setDeadline(formatDateTimeLocal(editTask.deadline));
      setEstimatedMinutes(editTask.estimatedMinutes);
      setEarliestStart(
        editTask.earliestStart ? formatDateTimeLocal(editTask.earliestStart) : ""
      );
    }
  }, [editTask]);

  function formatDateTimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    // 클라이언트 기본 검증
    if (!title.trim()) {
      setValidationError("제목을 입력해주세요.");
      return;
    }
    if (!noDeadline && !deadline) {
      setValidationError("마감 기한을 입력하거나 '마감 없음'을 선택해주세요.");
      return;
    }
    if (estimatedMinutes <= 0) {
      setValidationError("예상 소요시간은 1분 이상이어야 합니다.");
      return;
    }
    if (importance < 1 || importance > 5) {
      setValidationError("중요도는 1~5 사이여야 합니다.");
      return;
    }

    // 마감 없음인 경우 30일 후를 마감으로 설정 (매일 연구 쿼터로 시간 확보)
    let finalDeadline: string;
    if (noDeadline) {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      finalDeadline = future.toISOString();
    } else {
      finalDeadline = new Date(deadline).toISOString();
    }

    const data: TaskInput = {
      title: title.trim(),
      category,
      importance,
      deadline: finalDeadline,
      estimatedMinutes,
    };

    if (description.trim()) {
      data.description = description.trim();
    }
    if (earliestStart) {
      data.earliestStart = new Date(earliestStart).toISOString();
    }

    setSubmitting(true);
    try {
      await onSubmit(data);
      onClose();
    } catch {
      setValidationError("저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <h2 className="text-lg font-semibold text-gray-900">
            {editTask ? "태스크 수정" : "새 태스크 추가"}
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
          {/* 제목 */}
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="태스크 제목을 입력하세요"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
            />
          </div>

          {/* 설명 */}
          <div>
            <label htmlFor="task-desc" className="block text-sm font-medium text-gray-700 mb-1">
              설명 <span className="text-gray-400">(선택)</span>
            </label>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="태스크에 대한 설명을 입력하세요"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm resize-none"
            />
          </div>

          {/* 카테고리 + 중요도 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-category" className="block text-sm font-medium text-gray-700 mb-1">
                카테고리 <span className="text-red-500">*</span>
              </label>
              <select
                id="task-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-importance" className="block text-sm font-medium text-gray-700 mb-1">
                중요도 <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setImportance(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                      n <= importance
                        ? "bg-indigo-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    aria-label={`중요도 ${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 마감 기한 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="task-deadline" className="text-sm font-medium text-gray-700">
                마감 기한 {!noDeadline && <span className="text-red-500">*</span>}
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noDeadline}
                  onChange={(e) => setNoDeadline(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-500">마감 없음 (매일 반복)</span>
              </label>
            </div>
            {noDeadline ? (
              <div className="px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                💡 논문 읽기, 개인 연구 등 매일 조금씩 시간을 확보하는 태스크입니다. 설정의 연구 쿼터로 매일 보호된 시간이 확보됩니다.
              </div>
            ) : (
              <input
                id="task-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
              />
            )}
          </div>

          {/* 예상 소요시간 + 가장 빠른 시작 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-est" className="block text-sm font-medium text-gray-700 mb-1">
                예상 소요 (분) <span className="text-red-500">*</span>
              </label>
              <input
                id="task-est"
                type="number"
                min={1}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label htmlFor="task-earliest" className="block text-sm font-medium text-gray-700 mb-1">
                가장 빠른 시작 <span className="text-gray-400">(선택)</span>
              </label>
              <input
                id="task-earliest"
                type="datetime-local"
                value={earliestStart}
                onChange={(e) => setEarliestStart(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
              />
            </div>
          </div>

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
              ) : editTask ? (
                <Save className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {editTask ? "저장" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
