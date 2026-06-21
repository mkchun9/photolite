"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/v1";

/** 고정 블록 타입 */
export type FixedBlockType = "SLEEP" | "MEAL" | "EXERCISE" | "CLASS" | "CUSTOM";

/** 고정 블록 응답 타입 */
export interface FixedBlock {
  id: string;
  type: FixedBlockType;
  title: string;
  startMinute: number;
  endMinute: number;
  daysOfWeek: number | null;
  specificDate: string | null;
  isRecurring: boolean;
  createdAt: string;
}

/** 고정 블록 생성/수정 입력 */
export interface FixedBlockInput {
  type: FixedBlockType;
  title: string;
  startMinute: number;
  endMinute: number;
  isRecurring: boolean;
  daysOfWeek?: number | null;
  specificDate?: string | null;
}

type FixedBlockStatus = "idle" | "loading" | "success" | "error";

export function useFixedBlocks() {
  const [blocks, setBlocks] = useState<FixedBlock[]>([]);
  const [status, setStatus] = useState<FixedBlockStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/fixed-blocks`);
      if (!res.ok) {
        throw new Error(`고정 블록을 불러올 수 없습니다. (${res.status})`);
      }
      const data: FixedBlock[] = await res.json();
      setBlocks(data);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
      setStatus("error");
    }
  }, []);

  const createBlock = useCallback(
    async (input: FixedBlockInput): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch(`${API_BASE}/fixed-blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          if (res.status === 409) {
            return {
              success: false,
              error: errData?.message || "시간이 겹치는 고정 블록이 있습니다.",
            };
          }
          throw new Error(
            errData?.message || `고정 블록 생성에 실패했습니다. (${res.status})`
          );
        }
        await fetchBlocks();
        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "고정 블록 생성 중 오류가 발생했습니다.";
        setError(message);
        return { success: false, error: message };
      }
    },
    [fetchBlocks]
  );

  const updateBlock = useCallback(
    async (
      id: string,
      input: Partial<FixedBlockInput>
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch(`${API_BASE}/fixed-blocks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          if (res.status === 409) {
            return {
              success: false,
              error: errData?.message || "시간이 겹치는 고정 블록이 있습니다.",
            };
          }
          throw new Error(
            errData?.message || `고정 블록 수정에 실패했습니다. (${res.status})`
          );
        }
        await fetchBlocks();
        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "고정 블록 수정 중 오류가 발생했습니다.";
        setError(message);
        return { success: false, error: message };
      }
    },
    [fetchBlocks]
  );

  const deleteBlock = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE}/fixed-blocks/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error(`고정 블록 삭제에 실패했습니다. (${res.status})`);
        }
        await fetchBlocks();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "고정 블록 삭제 중 오류가 발생했습니다.";
        setError(message);
        return false;
      }
    },
    [fetchBlocks]
  );

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  return {
    blocks,
    status,
    error,
    fetchBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
  };
}
