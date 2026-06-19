"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/utils/api";

/** 통계 응답 타입 */
export interface StatisticsResponse {
  count: number;
  totalOriginalBytes: number;
  totalOptimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
  duplicateCount: number;
}

/** 통계 상태 */
type StatisticsStatus = "idle" | "loading" | "success" | "error";

export function useStatistics() {
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(null);
  const [status, setStatus] = useState<StatisticsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStatistics = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/photos/statistics`);

      if (!res.ok) {
        throw new Error(`통계를 불러올 수 없습니다. (${res.status})`);
      }

      const data: StatisticsResponse = await res.json();
      setStatistics(data);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    statistics,
    status,
    errorMessage,
    retry: fetchStatistics,
  };
}
