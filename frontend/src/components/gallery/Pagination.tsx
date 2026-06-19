"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PaginationMeta } from "@/hooks/useGallery";

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { currentPage, totalPages } = pagination;

  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav
      className="flex items-center justify-center gap-1.5 mt-8"
      aria-label="갤러리 페이지네이션"
    >
      {/* 이전 버튼 */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        aria-label="이전 페이지"
      >
        <ChevronLeft className="w-4 h-4" />
        이전
      </button>

      {/* 페이지 번호 */}
      <div className="flex items-center gap-1">
        {pages.map((page, idx) =>
          page === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 py-2 text-sm text-gray-400"
            >
              ···
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page as number)}
              className={`min-w-[36px] px-3 py-2 text-sm font-medium rounded-xl transition-all ${
                page === currentPage
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "text-gray-600 bg-white border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 shadow-sm"
              }`}
              aria-label={`${page} 페이지`}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </button>
          )
        )}
      </div>

      {/* 다음 버튼 */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        aria-label="다음 페이지"
      >
        다음
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}

function getPageNumbers(
  currentPage: number,
  totalPages: number
): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];
  pages.push(1);

  if (currentPage > 3) {
    pages.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  pages.push(totalPages);
  return pages;
}
