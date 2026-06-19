"use client";

import { Copy, ImageOff } from "lucide-react";
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ImageOff className="w-16 h-16 text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-600 mb-2">
        아직 업로드된 사진이 없습니다
      </h3>
      <p className="text-sm text-gray-400">
        사진을 업로드하면 여기에 표시됩니다.
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
  return (
    <button
      type="button"
      className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      onClick={onClick}
      aria-label={`${image.fileName} 상세보기`}
    >
      {/* 썸네일 이미지 */}
      <img
        src={image.thumbnailUrl}
        alt={image.fileName}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        loading="lazy"
      />

      {/* 중복 인디케이터 뱃지 */}
      {image.isDuplicate && (
        <span
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-xs font-medium rounded-full shadow-sm"
          title="중복 이미지"
        >
          <Copy className="w-3 h-3" />
          중복
        </span>
      )}

      {/* 하단 오버레이 (호버 시 표시) */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <p className="text-xs text-white truncate">{image.fileName}</p>
        <p className="text-xs text-gray-300">
          {formatFileSize(image.optimizedBytes)}
        </p>
      </div>
    </button>
  );
}
