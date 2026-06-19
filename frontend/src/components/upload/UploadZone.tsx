"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, ImagePlus, Loader2 } from "lucide-react";
import { useUpload } from "@/hooks/useUpload";
import { UPLOAD_CONSTANTS, formatFileSize } from "@/utils/api";
import { UploadResult } from "./UploadResult";

export function UploadZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { status, progress, response, validationErrors, errorMessage, upload, reset } =
    useUpload();

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        upload(droppedFiles);
      }
    },
    [upload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
      if (selectedFiles.length > 0) {
        upload(selectedFiles);
      }
      // input 값 초기화 (같은 파일 재선택 가능하도록)
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [upload]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const isUploading = status === "uploading";
  const showResults = status === "complete" || status === "error";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* 드래그 앤 드롭 영역 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="사진 업로드 영역. 클릭하거나 파일을 드래그해서 업로드하세요."
        className={`
          relative flex flex-col items-center justify-center
          w-full min-h-[240px] p-8
          border-2 border-dashed rounded-xl
          cursor-pointer transition-all duration-200
          ${
            isDragOver
              ? "border-blue-500 bg-blue-50 scale-[1.01]"
              : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"
          }
          ${isUploading ? "pointer-events-none opacity-70" : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* 아이콘 */}
        <div className="mb-4">
          {isUploading ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          ) : isDragOver ? (
            <ImagePlus className="w-12 h-12 text-blue-500" />
          ) : (
            <Upload className="w-12 h-12 text-gray-400" />
          )}
        </div>

        {/* 텍스트 */}
        {isUploading ? (
          <div className="text-center space-y-3 w-full">
            <p className="text-sm font-medium text-gray-700">업로드 중...</p>
            {/* 프로그레스 바 */}
            <div className="w-full max-w-xs mx-auto">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>진행률</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-gray-700">
              {isDragOver ? "여기에 놓으세요!" : "사진을 드래그하거나 클릭하여 업로드"}
            </p>
            <p className="text-xs text-gray-500">
              JPEG, PNG, WebP • 최대 {UPLOAD_CONSTANTS.MAX_FILES}개 •{" "}
              {formatFileSize(UPLOAD_CONSTANTS.MAX_FILE_SIZE)} 이하
            </p>
          </div>
        )}

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* 검증 에러 표시 */}
      {validationErrors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            일부 파일을 업로드할 수 없습니다:
          </p>
          <ul className="space-y-1">
            {validationErrors.map((err, idx) => (
              <li key={idx} className="text-xs text-yellow-700">
                <span className="font-medium">{err.fileName}</span>: {err.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 에러 메시지 표시 */}
      {errorMessage && !response && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* 업로드 결과 */}
      {showResults && response && (
        <UploadResult response={response} onReset={reset} />
      )}

      {/* 완료 후 새로 업로드 버튼 (에러 시) */}
      {status === "error" && !response && (
        <button
          onClick={reset}
          className="w-full py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
