"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/v1";

/** 태스크 카테고리 */
export type TaskCategory =
  | "DOCUMENT"
  | "ASSIGNMENT"
  | "PERSONAL_RESEARCH"
  | "STUDY"
  | "CLASS_PREP"
  | "EXAM"
  | "OTHER";

/** 남은 기한 분류 */
export type RemainingClassification = "OVERDUE" | "CRITICAL" | "WARNING" | "NORMAL";

/** 우선순위 상세 */
export interface PriorityBreakdown {
  score: number;
  urgency: number;
  effortDensity: number;
  normalizedImportance: number;
  remainingMinutes: number;
  minutesUntilDeadline: number;
  overdue: boolean;
}

/** AI 추천 */
export interface AiRecommendation {
  taskId: string;
  recommended: boolean;
  suitabilityScore: number;
  useType?: string;
  prompt?: string;
  rationale: string;
}

/** 남은 기한 정보 */
export interface RemainingInfo {
  totalMinutes: number;
  days: number;
  hours: number;
  minutes: number;
  classification: RemainingClassification;
}

/** 태스크 응답 타입 */
export interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  importance: number;
  deadline: string;
  estimatedMinutes: number;
  completedMinutes: number;
  earliestStart?: string;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  remaining: RemainingInfo;
  priority: PriorityBreakdown;
  ai: AiRecommendation;
  createdAt: string;
  updatedAt: string;
}

/** 태스크 생성/수정 입력 */
export interface TaskInput {
  title: string;
  description?: string;
  category: TaskCategory;
  importance: number;
  deadline: string;
  estimatedMinutes: number;
  completedMinutes?: number;
  earliestStart?: string;
}

type SchedulerStatus = "idle" | "loading" | "success" | "error";

export function useScheduler() {
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [status, setStatus] = useState<SchedulerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/tasks`);
      if (!res.ok) {
        throw new Error(`태스크 목록을 불러올 수 없습니다. (${res.status})`);
      }
      const rawData = await res.json();
      // API가 { task: {...}, remaining, priority, ai } 형태로 반환하므로 플랫하게 변환
      const data: TaskResponse[] = rawData.map((item: any) => {
        if (item.task) {
          return {
            ...item.task,
            remaining: item.remaining,
            priority: item.priority,
            ai: item.ai,
          };
        }
        return item;
      });
      setTasks(data);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
      setStatus("error");
    }
  }, []);

  const createTask = useCallback(
    async (input: TaskInput): Promise<TaskResponse | null> => {
      try {
        const res = await fetch(`${API_BASE}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            errData?.message || `태스크 생성에 실패했습니다. (${res.status})`
          );
        }
        const created: TaskResponse = await res.json();
        await fetchTasks();
        return created;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "태스크 생성 중 오류가 발생했습니다.";
        setError(message);
        return null;
      }
    },
    [fetchTasks]
  );

  const updateTask = useCallback(
    async (id: string, input: Partial<TaskInput>): Promise<TaskResponse | null> => {
      try {
        const res = await fetch(`${API_BASE}/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            errData?.message || `태스크 수정에 실패했습니다. (${res.status})`
          );
        }
        const updated: TaskResponse = await res.json();
        await fetchTasks();
        return updated;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "태스크 수정 중 오류가 발생했습니다.";
        setError(message);
        return null;
      }
    },
    [fetchTasks]
  );

  const deleteTask = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE}/tasks/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error(`태스크 삭제에 실패했습니다. (${res.status})`);
        }
        await fetchTasks();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "태스크 삭제 중 오류가 발생했습니다.";
        setError(message);
        return false;
      }
    },
    [fetchTasks]
  );

  const toggleDone = useCallback(
    async (id: string): Promise<boolean> => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return false;

      const newStatus = task.status === "DONE" ? "PENDING" : "DONE";
      try {
        const res = await fetch(`${API_BASE}/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          throw new Error(`상태 변경에 실패했습니다. (${res.status})`);
        }
        await fetchTasks();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "상태 변경 중 오류가 발생했습니다.";
        setError(message);
        return false;
      }
    },
    [fetchTasks, tasks]
  );

  // 초기 로딩
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    status,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    toggleDone,
  };
}
