"use client";

import { useState, useCallback } from "react";
import {
  UPLOAD_CONSTANTS,
  validateFiles,
  type UploadResponse,
  type FileValidationError,
} from "@/utils/api";

export type UploadStatus = "idle" | "validating" | "uploading" | "complete" | "error";

export interface UploadState {
  status: UploadStatus;
  progress: number; // 0~100
  response: UploadResponse | null;
  validationErrors: FileValidationError[];
  errorMessage: string | null;
}

const initialState: UploadState = {
  status: "idle",
  progress: 0,
  response: null,
  validationErrors: [],
  errorMessage: null,
};

export function useUpload() {
  const [state, setState] = useState<UploadState>(initialState);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const upload = useCallback(async (files: File[]) => {
    // 검증 단계
    setState((prev) => ({
      ...prev,
      status: "validating",
      progress: 0,
      response: null,
      validationErrors: [],
      errorMessage: null,
    }));

    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0) {
      setState((prev) => ({
        ...prev,
        validationErrors: errors,
      }));
    }

    if (validFiles.length === 0) {
      setState((prev) => ({
        ...prev,
        status: errors.length > 0 ? "error" : "idle",
        errorMessage: errors.length > 0 ? "업로드 가능한 파일이 없습니다." : null,
      }));
      return;
    }

    // 업로드 단계
    setState((prev) => ({
      ...prev,
      status: "uploading",
      progress: 0,
    }));

    const formData = new FormData();
    validFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await uploadWithProgress(
        UPLOAD_CONSTANTS.UPLOAD_ENDPOINT,
        formData,
        (progress) => {
          setState((prev) => ({
            ...prev,
            progress,
          }));
        }
      );

      setState((prev) => ({
        ...prev,
        status: "complete",
        progress: 100,
        response,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다.";
      setState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: message,
      }));
    }
  }, []);

  return { ...state, upload, reset };
}

/** XMLHttpRequest를 사용한 업로드 (progress 이벤트 지원) */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data: UploadResponse = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new Error("서버 응답을 파싱할 수 없습니다."));
        }
      } else if (xhr.status === 413) {
        reject(new Error("파일 크기가 서버 제한을 초과했습니다."));
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.message || `업로드 실패 (${xhr.status})`));
        } catch {
          reject(new Error(`업로드 실패 (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("네트워크 오류가 발생했습니다. 연결을 확인해주세요."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("업로드가 취소되었습니다."));
    });

    xhr.open("POST", url);
    xhr.send(formData);
  });
}
