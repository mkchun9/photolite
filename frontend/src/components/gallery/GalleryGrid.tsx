"use client";

import { useState } from "react";
import { Copy, ImageOff, ImageIcon } from "lucide-react";
import { GalleryImage } from "@/hooks/useGallery";
import { formatFileSize } from "@/utils/api";

interface GalleryGridProps {
  images: GalleryImage[];
  onImageClick: (image: GalleryImage) => void;
}

export function GalleryGrid({ images, onImageClick }: GalleryGridProps) {
  if (images.length === 0) {
    return <EmptyGallery />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {images.map((image) => (
        <ThumbnailCard
          key={image.id}
          image={image}
          onClick={() => onImageClick(image)}
        />
      ))}
    </div>
  );
}

/** 빈 갤러리 상태 */
function EmptyGallery() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 bg-gray-100 rounded-full mb-4">
        <ImageOff className="w-10 h-10 text-gray-300" />
      </div>
      <h3 className="text-lg font-medium text-gray-600 mb-1">
        아직 업로드된 사진이 없습니다
      </h3>
      <p className="text-sm text-gray-400">
        홈에서 사진을 업로드하면 여기에 표시됩니다.
      </p>
    </div>
  );
}

/** 썸네일 카드 */
function ThumbnailCard({
  image,
  onClick,
}: {
  image: GalleryImage;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200/80 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-100 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      onClick={onClick}
      aria-label={`${image.fileName} 상세보기`}
    >
      {/* 썸네일 이미지 */}
      {!imgError ? (
        <img
          src={image.thumbnailUrl}
          alt={image.fileName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
          <ImageIcon className="w-8 h-8 text-gray-300" />
        </div>
      )}

      {/* 중복 인디케이터 뱃지 */}
      {image.isDuplicate && (
        <span
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-amber-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-lg shadow-sm"
          title="중복 이미지"
        >
          <Copy className="w-3 h-3" />
          중복
        </span>
      )}

      {/* 절약률 뱃지 */}
      {image.savingsPercent > 0 && (
        <span className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-lg shadow-sm">
          -{image.savingsPercent.toFixed(0)}%
        </span>
      )}

      {/* 하단 오버레이 (호버 시 표시) */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-xs text-white font-medium truncate">
          {image.fileName}
        </p>
        <p className="text-xs text-gray-300 mt-0.5">
          {formatFileSize(image.optimizedBytes)}
        </p>
      </div>
    </button>
  );
}
