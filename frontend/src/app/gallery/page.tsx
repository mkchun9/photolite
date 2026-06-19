"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useGallery, GalleryImage } from "@/hooks/useGallery";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { Pagination } from "@/components/gallery/Pagination";
import { PhotoDetail } from "@/components/gallery/PhotoDetail";

export default function GalleryPage() {
  const { images, pagination, status, errorMessage, goToPage, refresh } =
    useGallery();
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  const handleImageClick = (image: GalleryImage) => {
    setSelectedImage(image);
  };

  const handleCloseDetail = () => {
    setSelectedImage(null);
  };

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              홈으로
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">갤러리</h1>
              {status === "success" && pagination.totalCount > 0 && (
                <p className="text-sm text-gray-500">
                  전체 {pagination.totalCount}장
                </p>
              )}
            </div>
          </div>

          {/* 새로고침 버튼 */}
          <div className="flex items-center gap-2">
            <Link
              href="/statistics"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              통계
            </Link>
            <button
              type="button"
              onClick={refresh}
              disabled={status === "loading"}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              aria-label="갤러리 새로고침"
            >
              <RefreshCw
                className={`w-4 h-4 ${status === "loading" ? "animate-spin" : ""}`}
              />
              새로고침
            </button>
          </div>
        </header>

        {/* 로딩 상태 */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-sm text-gray-500">갤러리를 불러오는 중...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md">
              <p className="text-sm text-red-700 mb-4">{errorMessage}</p>
              <button
                type="button"
                onClick={refresh}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                다시 시도
              </button>
            </div>
          </div>
        )}

        {/* 갤러리 그리드 */}
        {status === "success" && (
          <>
            <GalleryGrid images={images} onImageClick={handleImageClick} />
            <Pagination pagination={pagination} onPageChange={goToPage} />
          </>
        )}

        {/* 상세 모달 */}
        {selectedImage && (
          <PhotoDetail image={selectedImage} onClose={handleCloseDetail} />
        )}
      </div>
    </main>
  );
}
