"use client";

import { useEffect, useCallback } from "react";
import { X, Copy, HardDrive, Shrink, TrendingDown } from "lucide-react";
import { GalleryImage } from "@/hooks/useGallery";
import { formatFileSize } from "@/utils/api";

interface PhotoDetailProps {
  image: GalleryImage;
  onClose: () => void;
}

export function PhotoDetail({ image, onClose }: PhotoDetailProps) {
  // ESC 키로 닫기
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // 스크롤 방지
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  // 배경 클릭으로 닫기
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const uploadDate = new Date(image.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${image.fileName} 상세보기`}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {image.fileName}
            </h2>
            {image.isDuplicate && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full shrink-0">
                <Copy className="w-3 h-3" />
                중복
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 이미지 영역 */}
        <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4">
          <img
            src={image.fullUrl}
            alt={image.fileName}
            className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
          />
        </div>

        {/* 메타데이터 */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* 원본 크기 */}
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <HardDrive className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">원본 크기</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatFileSize(image.originalBytes)}
                </p>
              </div>
            </div>

            {/* 최적화 크기 */}
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Shrink className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">최적화 크기</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatFileSize(image.optimizedBytes)}
                </p>
              </div>
            </div>

            {/* 절약률 */}
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingDown className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">절약률</p>
                <p className="text-sm font-medium text-green-600">
                  {image.savingsPercent.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* 업로드 날짜 */}
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <span className="text-sm">📅</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">업로드 날짜</p>
                <p className="text-sm font-medium text-gray-900">
                  {uploadDate}
                </p>
              </div>
            </div>
          </div>

          {/* 해상도 정보 */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              해상도: {image.width} × {image.height}px
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
