"use client";

import { useState } from "react";
import { CheckCircle, Circle, Trash2, Clock, Star, TrendingUp, Sparkles } from "lucide-react";
import type { TaskResponse, TaskCategory, RemainingClassification, AiRecommendation } from "@/hooks/useScheduler";
import { useScheduler } from "@/hooks/useScheduler";
import { TaskForm } from "./TaskForm";
import { AiPromptModal } from "./AiPromptModal";

/** 카테고리별 뱃지 색상 */
const CATEGORY_COLORS: Record<TaskCategory, string> = {
  DOCUMENT: "bg-blue-100 text-blue-700",
  ASSIGNMENT: "bg-purple-100 text-purple-700",
  PERSONAL_RESEARCH: "bg-green-100 text-green-700",
  STUDY: "bg-orange-100 text-orange-700",
  CLASS_PREP: "bg-pink-100 text-pink-700",
  EXAM: "bg-red-100 text-red-700",
  OTHER: "bg-gray-100 text-gray-700",
};

/** 카테고리 한글 라벨 */
const CATEGORY_LABELS: Record<TaskCategory, string> = {
  DOCUMENT: "서류",
  ASSIGNMENT: "과제",
  PERSONAL_RESEARCH: "연구",
  STUDY: "공부",
  CLASS_PREP: "수업 준비",
  EXAM: "시험",
  OTHER: "기타",
};

/** 남은 기한 분류별 뱃지 색상 */
const CLASSIFICATION_COLORS: Record<RemainingClassification, string> = {
  OVERDUE: "bg-red-100 text-red-700 border-red-200",
  CRITICAL: "bg-orange-100 text-orange-700 border-orange-200",
  WARNING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  NORMAL: "bg-green-100 text-green-700 border-green-200",
};

/** 남은 기한 분류 한글 라벨 */
const CLASSIFICATION_LABELS: Record<RemainingClassification, string> = {
  OVERDUE: "마감 초과",
  CRITICAL: "긴급",
  WARNING: "주의",
  NORMAL: "여유",
};

export function TaskList() {
  const { tasks, status, error, createTask, updateTask, deleteTask, toggleDone } =
    useScheduler();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null);
  const [aiModal, setAiModal] = useState<{ recommendation: AiRecommendation; taskTitle: string } | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  async function handleAiClick(e: React.MouseEvent, task: TaskResponse) {
    e.stopPropagation();
    // 이미 로컬에 AI 추천 데이터가 있으면 바로 표시
    if (task.ai) {
      setAiModal({ recommendation: task.ai, taskTitle: task.title });
      return;
    }
    // 없으면 API에서 가져오기
    setAiLoading(task.id);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/ai-recommendation`);
      if (res.ok) {
        const data: AiRecommendation = await res.json();
        setAiModal({ recommendation: data, taskTitle: task.title });
      }
    } catch {
      // 실패 시 무시
    } finally {
      setAiLoading(null);
    }
  }

  function handleTaskClick(task: TaskResponse) {
    setEditingTask(task);
    setShowForm(true);
  }

  function handleAddClick() {
    setEditingTask(null);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingTask(null);
  }

  async function handleDelete(e: React.MouseEvent, taskId: string) {
    e.stopPropagation();
    if (window.confirm("이 태스크를 삭제하시겠습니까?")) {
      await deleteTask(taskId);
    }
  }

  async function handleToggleDone(e: React.MouseEvent, taskId: string) {
    e.stopPropagation();
    await toggleDone(taskId);
  }

  if (status === "loading" && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <span className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">태스크를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="px-4 py-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 추가 버튼 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleAddClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          <span className="text-lg leading-none">+</span>
          새 태스크 추가
        </button>
      </div>

      {/* 태스크 목록 */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <Clock className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-1">
            등록된 태스크가 없습니다
          </h3>
          <p className="text-sm text-gray-400">
            &quot;새 태스크 추가&quot; 버튼을 눌러 태스크를 등록해보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => handleTaskClick(task)}
              onToggleDone={(e) => handleToggleDone(e, task.id)}
              onDelete={(e) => handleDelete(e, task.id)}
              onAiClick={(e) => handleAiClick(e, task)}
              aiLoading={aiLoading === task.id}
            />
          ))}
        </div>
      )}

      {/* 폼 모달 */}
      {showForm && (
        <TaskForm
          editTask={editingTask}
          onSubmit={async (data) => {
            if (editingTask) {
              await updateTask(editingTask.id, data);
            } else {
              await createTask(data);
            }
          }}
          onClose={handleCloseForm}
        />
      )}

      {/* AI 추천 모달 */}
      {aiModal && (
        <AiPromptModal
          recommendation={aiModal.recommendation}
          taskTitle={aiModal.taskTitle}
          onClose={() => setAiModal(null)}
        />
      )}
    </div>
  );
}

/** 개별 태스크 카드 */
function TaskCard({
  task,
  onClick,
  onToggleDone,
  onDelete,
  onAiClick,
  aiLoading,
}: {
  task: TaskResponse;
  onClick: () => void;
  onToggleDone: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onAiClick: (e: React.MouseEvent) => void;
  aiLoading: boolean;
}) {
  const isDone = task.status === "DONE";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 bg-white rounded-xl border transition-all hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 ${
        isDone ? "border-gray-200 opacity-60" : "border-gray-200/80"
      }`}
      aria-label={`${task.title} 수정하기`}
    >
      <div className="flex items-start gap-3">
        {/* 완료 토글 */}
        <button
          type="button"
          onClick={onToggleDone}
          className="mt-0.5 shrink-0 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
          aria-label={isDone ? "미완료로 변경" : "완료로 변경"}
        >
          {isDone ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          )}
        </button>

        {/* 콘텐츠 */}
        <div className="flex-1 min-w-0">
          {/* 상단: 제목 + 카테고리 */}
          <div className="flex items-center gap-2 mb-1.5">
            <h3
              className={`text-sm font-semibold truncate ${
                isDone ? "line-through text-gray-400" : "text-gray-900"
              }`}
            >
              {task.title}
            </h3>
            <span
              className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-md ${
                CATEGORY_COLORS[task.category]
              }`}
            >
              {CATEGORY_LABELS[task.category]}
            </span>
          </div>

          {/* 중간: 메타 정보 */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {/* 중요도 */}
            <span className="inline-flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              {task.importance}/5
            </span>

            {/* 마감 */}
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDeadline(task.deadline)}
            </span>

            {/* 남은 시간 + 분류 뱃지 */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${
                CLASSIFICATION_COLORS[task.remaining.classification]
              }`}
            >
              {CLASSIFICATION_LABELS[task.remaining.classification]}
              {task.remaining.classification !== "OVERDUE" && (
                <span className="ml-1">
                  {formatRemaining(task.remaining)}
                </span>
              )}
            </span>

            {/* 우선순위 점수 */}
            <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              {task.priority.score.toFixed(2)}
            </span>
          </div>
        </div>

        {/* AI 추천 + 삭제 버튼 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onAiClick}
            disabled={aiLoading}
            className="p-2 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
            aria-label="AI 추천"
            title="AI 추천"
          >
            <Sparkles className={`w-4 h-4 ${aiLoading ? "animate-pulse" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="태스크 삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </button>
  );
}

/** 마감 시각 포맷 */
function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hours}:${mins}`;
}

/** 남은 시간 포맷 */
function formatRemaining(remaining: { days: number; hours: number; minutes: number }): string {
  if (remaining.days > 0) {
    return `${remaining.days}일 ${remaining.hours}시간`;
  }
  if (remaining.hours > 0) {
    return `${remaining.hours}시간 ${remaining.minutes}분`;
  }
  return `${remaining.minutes}분`;
}
