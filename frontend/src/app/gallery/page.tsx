"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, BarChart3, Images } from "lucide-react";
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              홈
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Images className="w-5 h-5 text-indigo-500" />
                <h1 className="text-2xl font-bold text-gray-900">갤러리</h1>
              </div>
              {status === "success" && pagination.totalCount > 0 && (
                <p className="text-sm text-gray-400 mt-0.5">
                  전체 {pagination.totalCount}장의 최적화된 사진
                </p>
              )}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2">
            <Link
              href="/statistics"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:text-indigo-600 shadow-sm transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">통계</span>
            </Link>
            <button
              type="button"
              onClick={refresh}
              disabled={status === "loading"}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 shadow-sm transition-colors"
              aria-label="갤러리 새로고침"
            >
              <RefreshCw
                className={`w-4 h-4 ${status === "loading" ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">새로고침</span>
            </button>
          </div>
        </header>

        {/* 로딩 상태 */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="p-4 bg-indigo-50 rounded-full mb-4">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
            <p className="text-sm text-gray-500">갤러리를 불러오는 중...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center max-w-md shadow-sm">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl">⚠️</span>
              </div>
              <p className="text-sm text-red-700 mb-4">{errorMessage}</p>
              <button
                type="button"
                onClick={refresh}
                className="px-5 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm"
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
