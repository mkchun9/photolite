"use client";

import { useState, useCallback } from "react";

const API_BASE = "/api/v1";

/** 타임 블록 타입 */
export interface TimeBlock {
  id?: string;
  kind: "FIXED" | "TASK" | "RESEARCH_RESERVED";
  taskId?: string;
  fixedBlockId?: string;
  title: string;
  start: string;
  end: string;
  locked: boolean;
}

/** 미배치 태스크 */
export interface UnscheduledTask {
  taskId: string;
  title: string;
  unplacedMinutes: number;
  reason: string;
  suggestion: string;
}

/** 스케줄 플랜 */
export interface SchedulePlan {
  generatedAt: string;
  horizonStart: string;
  horizonEnd: string;
  allocations: TimeBlock[];
  atRisk: UnscheduledTask[];
  dayCapacityWarnings: { date: string; message: string }[];
}

/** 서버 현재 시각 응답 */
export interface ServerNowResponse {
  now: string;
  timezone: string;
}

type ScheduleStatus = "idle" | "loading" | "success" | "error";

export function useSchedule() {
  const [plan, setPlan] = useState<SchedulePlan | null>(null);
  const [status, setStatus] = useState<ScheduleStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState<ServerNowResponse | null>(null);

  /** 일정 생성 */
  const generateSchedule = useCallback(async (horizonDays?: number): Promise<boolean> => {
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/schedule/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizonDays: horizonDays ?? 7 }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.message || `일정 생성에 실패했습니다. (${res.status})`
        );
      }
      const data: SchedulePlan = await res.json();
      setPlan(data);
      setStatus("success");
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "일정 생성 중 오류가 발생했습니다.";
      setError(message);
      setStatus("error");
      return false;
    }
  }, []);

  /** 일정 조회 */
  const fetchSchedule = useCallback(async (startDate: string, endDate: string): Promise<boolean> => {
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/schedule?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.message || `일정을 불러올 수 없습니다. (${res.status})`
        );
      }
      const rawData = await res.json();
      // findByRange API는 { allocations, atRisk } 만 반환하므로 SchedulePlan 형태로 보충
      const data: SchedulePlan = {
        generatedAt: new Date().toISOString(),
        horizonStart: startDate,
        horizonEnd: endDate,
        allocations: rawData.allocations ?? [],
        atRisk: rawData.atRisk ?? [],
        dayCapacityWarnings: rawData.dayCapacityWarnings ?? [],
      };
      setPlan(data);
      setStatus("success");
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "일정 조회 중 오류가 발생했습니다.";
      setError(message);
      setStatus("error");
      return false;
    }
  }, []);

  /** 배치 잠금 */
  const lockAllocation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/schedule/allocations/${id}/lock`, {
        method: "POST",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.message || `잠금에 실패했습니다. (${res.status})`
        );
      }
      // 플랜 내 해당 allocation 잠금 상태 업데이트
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          allocations: prev.allocations.map((a) =>
            a.id === id ? { ...a, locked: true } : a
          ),
        };
      });
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "잠금 중 오류가 발생했습니다.";
      setError(message);
      return false;
    }
  }, []);

  /** 잠금 해제 */
  const unlockAllocation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/schedule/allocations/${id}/lock`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.message || `잠금 해제에 실패했습니다. (${res.status})`
        );
      }
      // 플랜 내 해당 allocation 잠금 상태 업데이트
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          allocations: prev.allocations.map((a) =>
            a.id === id ? { ...a, locked: false } : a
          ),
        };
      });
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "잠금 해제 중 오류가 발생했습니다.";
      setError(message);
      return false;
    }
  }, []);

  /** 서버 현재 시각 조회 */
  const fetchNow = useCallback(async (): Promise<ServerNowResponse | null> => {
    try {
      const res = await fetch(`${API_BASE}/scheduler/now`);
      if (!res.ok) {
        throw new Error(`현재 시각을 불러올 수 없습니다. (${res.status})`);
      }
      const data: ServerNowResponse = await res.json();
      setServerNow(data);
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "시각 조회 중 오류가 발생했습니다.";
      setError(message);
      return null;
    }
  }, []);

  return {
    plan,
    status,
    error,
    serverNow,
    generateSchedule,
    fetchSchedule,
    lockAllocation,
    unlockAllocation,
    fetchNow,
  };
}
