"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/v1";

/** 스케줄러 설정 */
export interface SchedulerSettings {
  id: string;
  timezone: string;
  researchQuotaMin: number;
  bufferMin: number;
  windDownMin: number;
  minChunkMin: number;
  maxFocusMin: number;
  urgencyWeight: number;
  importanceWeight: number;
  aiThreshold: number;
  updatedAt: string;
}

type SettingsStatus = "idle" | "loading" | "success" | "error";

export function useSettings() {
  const [settings, setSettings] = useState<SchedulerSettings | null>(null);
  const [status, setStatus] = useState<SettingsStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/scheduler/settings`);
      if (!res.ok) {
        throw new Error(`설정을 불러올 수 없습니다. (${res.status})`);
      }
      const data: SchedulerSettings = await res.json();
      setSettings(data);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
      setStatus("error");
    }
  }, []);

  const updateSettings = useCallback(
    async (data: Partial<Omit<SchedulerSettings, "id" | "updatedAt">>): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE}/scheduler/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            errData?.message || `설정 저장에 실패했습니다. (${res.status})`
          );
        }
        const updated: SchedulerSettings = await res.json();
        setSettings(updated);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "설정 저장 중 오류가 발생했습니다.";
        setError(message);
        return false;
      }
    },
    []
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    status,
    error,
    fetchSettings,
    updateSettings,
  };
}
