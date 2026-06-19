"use client";

import { useEffect, useCallback, useState } from "react";
import { X, Copy, HardDrive, Shrink, TrendingDown, ImageIcon } from "lucide-react";
import { GalleryImage } from "@/hooks/useGallery";
import { formatFileSize } from "@/utils/api";

interface PhotoDetailProps {
  image: GalleryImage;
  onClose: () => void;
}

export function PhotoDetail({ image, onClose }: PhotoDetailProps) {
  const [imgError, setImgError] = useState(false);

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
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${image.fileName} 상세보기`}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 이미지 영역 */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
          {!imgError ? (
            <img
              src={image.fullUrl}
              alt={image.fileName}
              className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-md"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <ImageIcon className="w-16 h-16" />
              <p className="text-sm">이미지를 불러올 수 없습니다</p>
            </div>
          )}
        </div>

        {/* 메타데이터 */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetaItem
              icon={<HardDrive className="w-4 h-4 text-gray-500" />}
              iconBg="bg-gray-100"
              label="원본 크기"
              value={formatFileSize(image.originalBytes)}
            />
            <MetaItem
              icon={<Shrink className="w-4 h-4 text-indigo-500" />}
              iconBg="bg-indigo-50"
              label="최적화 크기"
              value={formatFileSize(image.optimizedBytes)}
            />
            <MetaItem
              icon={<TrendingDown className="w-4 h-4 text-emerald-500" />}
              iconBg="bg-emerald-50"
              label="절약률"
              value={`${image.savingsPercent.toFixed(1)}%`}
              valueColor="text-emerald-600"
            />
            <MetaItem
              icon={<span className="text-sm">📅</span>}
              iconBg="bg-purple-50"
              label="업로드 날짜"
              value={uploadDate}
            />
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              해상도: {image.width} × {image.height}px
            </p>
            <p className="text-xs text-gray-400">
              ID: {image.id.slice(0, 8)}...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaItem({
  icon,
  iconBg,
  label,
  value,
  valueColor = "text-gray-900",
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`p-2 ${iconBg} rounded-lg`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-sm font-medium ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}
