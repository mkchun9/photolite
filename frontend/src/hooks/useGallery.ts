"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/utils/api";

/** 갤러리 이미지 타입 */
export interface GalleryImage {
  id: string;
  fileName: string;
  hash: string;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
  createdAt: string;
  thumbnailUrl: string;
  fullUrl: string;
  savingsPercent: number;
  isDuplicate: boolean;
}

/** 페이지네이션 메타데이터 */
export interface PaginationMeta {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

/** 페이지네이션된 갤러리 응답 */
export interface PaginatedGalleryResponse {
  images: GalleryImage[];
  pagination: PaginationMeta;
}

/** 갤러리 상태 */
type GalleryStatus = "idle" | "loading" | "success" | "error";

export function useGallery(initialPage = 1, pageSize = 20) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    totalCount: 0,
    currentPage: initialPage,
    totalPages: 0,
    pageSize,
  });
  const [status, setStatus] = useState<GalleryStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchGallery = useCallback(
    async (page: number) => {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const res = await fetch(
          `${API_BASE_URL}/photos?page=${page}&pageSize=${pageSize}`
        );

        if (!res.ok) {
          throw new Error(`갤러리를 불러올 수 없습니다. (${res.status})`);
        }

        const data: PaginatedGalleryResponse = await res.json();
        setImages(data.images);
        setPagination(data.pagination);
        setStatus("success");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
        setErrorMessage(message);
        setStatus("error");
      }
    },
    [pageSize]
  );

  const goToPage = useCallback(
    (page: number) => {
      if (page < 1) return;
      fetchGallery(page);
    },
    [fetchGallery]
  );

  // 초기 로딩
  useEffect(() => {
    fetchGallery(initialPage);
  }, [fetchGallery, initialPage]);

  return {
    images,
    pagination,
    status,
    errorMessage,
    goToPage,
    refresh: () => fetchGallery(pagination.currentPage),
  };
}

/** 단일 사진 상세 정보 fetching 훅 */
export function usePhotoDetail(photoId: string | null) {
  const [photo, setPhoto] = useState<GalleryImage | null>(null);
  const [status, setStatus] = useState<GalleryStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!photoId) {
      setPhoto(null);
      setStatus("idle");
      return;
    }

    const fetchDetail = async () => {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const res = await fetch(`${API_BASE_URL}/photos/${photoId}`);

        if (!res.ok) {
          throw new Error(`사진 정보를 불러올 수 없습니다. (${res.status})`);
        }

        const data: GalleryImage = await res.json();
        setPhoto(data);
        setStatus("success");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
        setErrorMessage(message);
        setStatus("error");
      }
    };

    fetchDetail();
  }, [photoId]);

  return { photo, status, errorMessage };
}
