"use client";

import { useState } from "react";
import { Moon, UtensilsCrossed, Dumbbell, GraduationCap, Tag, Pencil, Trash2, Clock } from "lucide-react";
import type { FixedBlock, FixedBlockType } from "@/hooks/useFixedBlocks";
import { useFixedBlocks } from "@/hooks/useFixedBlocks";
import { FixedBlockForm } from "./FixedBlockForm";

/** 타입별 색상 */
const TYPE_COLORS: Record<FixedBlockType, string> = {
  SLEEP: "bg-indigo-100 text-indigo-700 border-indigo-200",
  MEAL: "bg-amber-100 text-amber-700 border-amber-200",
  EXERCISE: "bg-green-100 text-green-700 border-green-200",
  CLASS: "bg-purple-100 text-purple-700 border-purple-200",
  CUSTOM: "bg-gray-100 text-gray-700 border-gray-200",
};

/** 타입별 한글 라벨 */
const TYPE_LABELS: Record<FixedBlockType, string> = {
  SLEEP: "수면",
  MEAL: "식사",
  EXERCISE: "운동",
  CLASS: "수업",
  CUSTOM: "사용자 정의",
};

/** 타입별 아이콘 */
function TypeIcon({ type, className }: { type: FixedBlockType; className?: string }) {
  const iconClass = className || "w-4 h-4";
  switch (type) {
    case "SLEEP":
      return <Moon className={iconClass} />;
    case "MEAL":
      return <UtensilsCrossed className={iconClass} />;
    case "EXERCISE":
      return <Dumbbell className={iconClass} />;
    case "CLASS":
      return <GraduationCap className={iconClass} />;
    case "CUSTOM":
      return <Tag className={iconClass} />;
  }
}

/** minutes from midnight → "HH:MM" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** 요일 비트마스크 → 한글 요일 텍스트 */
function formatDaysOfWeek(bitmask: number): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const selected: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (bitmask & (1 << i)) {
      selected.push(days[i]);
    }
  }
  if (selected.length === 7) return "매일";
  if (selected.length === 5 && !(bitmask & 1) && !(bitmask & 64)) return "평일";
  if (selected.length === 2 && (bitmask & 1) && (bitmask & 64)) return "주말";
  return selected.join(", ");
}

export function FixedBlockList() {
  const { blocks, status, error, createBlock, updateBlock, deleteBlock } =
    useFixedBlocks();
  const [showForm, setShowForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState<FixedBlock | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  function handleAddClick() {
    setEditingBlock(null);
    setConflictError(null);
    setShowForm(true);
  }

  function handleEditClick(block: FixedBlock) {
    setEditingBlock(block);
    setConflictError(null);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingBlock(null);
    setConflictError(null);
  }

  async function handleDelete(blockId: string) {
    if (window.confirm("이 고정 블록을 삭제하시겠습니까?")) {
      await deleteBlock(blockId);
    }
  }

  if (status === "loading" && blocks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <span className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">고정 블록을 불러오는 중...</span>
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
          새 고정 블록 추가
        </button>
      </div>

      {/* 충돌 에러 표시 */}
      {conflictError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          ⚠️ {conflictError}
        </div>
      )}

      {/* 블록 목록 */}
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <Clock className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-1">
            등록된 고정 블록이 없습니다
          </h3>
          <p className="text-sm text-gray-400">
            &quot;새 고정 블록 추가&quot; 버튼을 눌러 필수 시간 블록을 등록해보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => (
            <FixedBlockCard
              key={block.id}
              block={block}
              onEdit={() => handleEditClick(block)}
              onDelete={() => handleDelete(block.id)}
            />
          ))}
        </div>
      )}

      {/* 폼 모달 */}
      {showForm && (
        <FixedBlockForm
          editBlock={editingBlock}
          onSubmit={async (data) => {
            let result: { success: boolean; error?: string };
            if (editingBlock) {
              result = await updateBlock(editingBlock.id, data);
            } else {
              result = await createBlock(data);
            }
            if (result.success) {
              handleCloseForm();
            } else if (result.error) {
              setConflictError(result.error);
            }
          }}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}

/** 개별 고정 블록 카드 */
function FixedBlockCard({
  block,
  onEdit,
  onDelete,
}: {
  block: FixedBlock;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isOvernight = block.endMinute <= block.startMinute;
  const timeRange = `${minutesToTime(block.startMinute)}-${minutesToTime(block.endMinute)}`;

  return (
    <div className="w-full p-4 bg-white rounded-xl border border-gray-200/80 transition-all hover:shadow-md hover:border-indigo-200">
      <div className="flex items-center gap-3">
        {/* 타입 아이콘 + 뱃지 */}
        <div
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${TYPE_COLORS[block.type]}`}
        >
          <TypeIcon type={block.type} className="w-3.5 h-3.5" />
          {TYPE_LABELS[block.type]}
        </div>

        {/* 제목 + 정보 */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {block.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            {/* 시간 범위 */}
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {timeRange}
              {isOvernight && (
                <span className="ml-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium">
                  (자정 넘김)
                </span>
              )}
            </span>

            {/* 반복 정보 */}
            <span>
              {block.isRecurring
                ? block.daysOfWeek !== null
                  ? formatDaysOfWeek(block.daysOfWeek)
                  : "매일"
                : block.specificDate
                ? `${block.specificDate}`
                : "일회성"}
            </span>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="p-2 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
            aria-label="편집"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
