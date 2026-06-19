# Implementation Plan: PhotoLite

## Overview

PhotoLite 사진 최적화 및 정리 웹 서비스의 구현 계획. 백엔드(NestJS + TypeORM + sharp), 프론트엔드(Next.js + shadcn/ui), 인프라(Docker Compose + nginx)를 순차적 의존성 기반으로 구현한다.

## Tasks

- [x] 1. 백엔드 프로젝트 초기화 및 Photo Entity 생성
  - [x] 1.1 NestJS 백엔드 프로젝트 구조 및 Photo 모듈 초기화
    - `backend/src/modules/photo/` 디렉토리 구조 생성
    - `photo.module.ts` NestJS 모듈 정의
    - TypeORM 설정 및 PostgreSQL 연결 구성 (`backend/src/app.module.ts`)
    - _Requirements: 2.5, 4.1_
  - [x] 1.2 Photo Entity 구현 (`backend/src/modules/photo/entities/photo.entity.ts`)
    - UUID PK, fileName, hash(CHAR 16), originalBytes, optimizedBytes, width, height, createdAt 컬럼 정의
    - hash 컬럼에 INDEX 생성
    - createdAt DESC INDEX 생성
    - _Requirements: 2.5, 3.1, 4.1_
  - [x] 1.3 인터페이스 정의 (`backend/src/modules/photo/interfaces/`)
    - `optimization-result.interface.ts`: OptimizationResult 인터페이스
    - `duplicate-result.interface.ts`: DuplicateResult 인터페이스
    - _Requirements: 2.1, 3.1_

- [x] 2. 이미지 최적화 엔진 구현
  - [x] 2.1 OptimizationEngine 서비스 구현 (`backend/src/modules/photo/optimization.engine.ts`)
    - sharp 라이브러리를 사용한 WebP 변환 (quality 80)
    - 리사이즈 로직: 너비 1920px 초과 시 축소, 높이 1080px 초과 시 축소 (비율 유지, `fit: 'inside'`)
    - 원본 WebP가 더 작은 경우 원본 유지 로직 (`skipped: true`)
    - 손상된 이미지 처리 시 에러 반환
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_
  - [x]* 2.2 Property test: 이미지 최적화 불변식
    - **Property 4: 이미지 최적화 불변식**
    - sharp로 랜덤 크기/포맷 이미지 생성 → 최적화 후 WebP 포맷, 1920×1080 이내, 비율 보존 검증
    - **Validates: Requirements 2.1, 2.3, 2.4**
  - [x]* 2.3 Property test: 원본 메타데이터 보존
    - **Property 5: 원본 메타데이터 보존**
    - 랜덤 이미지 → 처리 → originalBytes/optimizedBytes 정확성 검증
    - **Validates: Requirements 2.5**
  - [x]* 2.4 Property test: 이미 최적 WebP 보존
    - **Property 6: 이미 최적 WebP 보존**
    - 작은 WebP 파일 생성 → 재인코딩 결과가 원본보다 크면 원본 유지 검증
    - **Validates: Requirements 2.6**

- [x] 3. 중복 감지 모듈 구현
  - [x] 3.1 DuplicateDetector 서비스 구현 (`backend/src/modules/photo/duplicate.detector.ts`)
    - aHash 생성: sharp로 8×8 리사이즈 → 그레이스케일 → 평균값 → 64-bit hash (16자 hex)
    - Hamming Distance 계산 함수
    - Similarity Score 계산: `1 - (hammingDistance / 64)`
    - DB에서 기존 hash 목록 조회 및 비교
    - threshold 0.9 이상 시 duplicate 판정, 유사 이미지 최대 10개 반환 (score 내림차순)
    - 타임아웃(5초) 처리: `status: 'timeout'`
    - 해시 생성 실패 시: `status: 'skipped'`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x]* 3.2 Property test: 중복 감지 threshold 분류 및 정렬
    - **Property 7: 중복 감지 threshold 분류 및 정렬**
    - 랜덤 64-bit 해시 쌍 → similarity score 0.9 기준 분류 정확성 및 정렬 검증
    - **Validates: Requirements 3.3, 3.4**

- [x] 4. DTO 및 업로드 검증 구현
  - [x] 4.1 DTO 정의
    - `backend/src/modules/photo/dto/upload-photo.dto.ts`: 멀티파트 업로드 요청 검증
    - `backend/src/modules/photo/dto/gallery-query.dto.ts`: page, pageSize 쿼리 파라미터 (pageSize 기본 20, 최대 100)
    - `backend/src/modules/photo/dto/photo-response.dto.ts`: PhotoResponse, PaginatedGalleryResponse, StatisticsResponse DTO
    - _Requirements: 1.4, 4.2, 4.3, 5.1_
  - [x] 4.2 파일 업로드 검증 파이프/가드 구현
    - MIME 타입 검증 (image/jpeg, image/png, image/webp)
    - Magic bytes 검증 (실제 파일 콘텐츠 검사)
    - 파일 크기 검증 (15MB 상한)
    - 빈 파일 거부
    - 배치 최대 10개 제한
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [x]* 4.3 Property test: 파일 타입 검증 일관성
    - **Property 1: 파일 타입 검증 일관성**
    - 랜덤 MIME 타입 + 파일 데이터 → 지원 포맷만 수락, 나머지 거부 검증
    - **Validates: Requirements 1.1, 1.3, 1.4**
  - [x]* 4.4 Property test: 파일 크기 제한
    - **Property 2: 파일 크기 제한**
    - 랜덤 바이트 크기 (0 ~ 20MB) → 15MB 초과 거부 검증
    - **Validates: Requirements 1.2**
  - [x]* 4.5 Property test: Magic bytes 무결성 검증
    - **Property 3: Magic bytes 무결성 검증**
    - 랜덤 바이트 배열 → 실제 magic bytes 기반 판단 검증
    - **Validates: Requirements 1.5**

- [x] 5. PhotoService 비즈니스 로직 구현
  - [x] 5.1 PhotoService 구현 (`backend/src/modules/photo/photo.service.ts`)
    - 업로드 오케스트레이션: 검증 → 최적화 → 중복 감지 → 저장
    - Photo 엔티티 CRUD (TypeORM Repository 패턴)
    - 파일 저장: `/uploads` 디렉토리에 최적화 이미지 저장 (UUID 기반 파일명)
    - 에러 처리: DB 연결 실패 시 503, 스토리지 부족 시 거부, 임시 파일 정리
    - 동일 fileName 독립 저장 (UUID로 구분)
    - _Requirements: 1.1~1.7, 2.1~2.8, 3.5, 6.1~6.8_
  - [x]* 5.2 Property test: 파일명 독립성
    - **Property 11: 파일명 독립성**
    - 동일 fileName으로 N회 업로드 → 각각 고유 UUID 저장 검증
    - **Validates: Requirements 6.5**

- [x] 6. Checkpoint - 백엔드 핵심 로직 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. PhotoController REST API 구현
  - [x] 7.1 PhotoController 구현 (`backend/src/modules/photo/photo.controller.ts`)
    - `POST /api/photos/upload`: 멀티파트 파일 업로드 (최대 10개), Multer 인터셉터
    - `GET /api/photos`: 갤러리 조회 (페이지네이션, createdAt DESC)
    - `GET /api/photos/:id`: 개별 사진 상세 조회
    - `GET /api/photos/statistics`: 절약 통계 조회
    - 에러 응답 공통 구조: `{ error, message, details?, timestamp }`
    - _Requirements: 1.1~1.7, 4.1~4.8, 5.1~5.8, 6.1~6.8_
  - [x]* 7.2 Unit test: PhotoController 엔드포인트 테스트
    - 정상 업로드, 검증 실패, 갤러리 조회, 통계 조회 시나리오 테스트
    - _Requirements: 1.1~1.7, 4.1, 5.1_

- [x] 8. GalleryService 및 StatisticsService 구현
  - [x] 8.1 GalleryService 구현 (`backend/src/modules/photo/gallery.service.ts`)
    - 페이지네이션 조회: createdAt DESC, 기본 pageSize 20, 최대 100
    - pagination 메타데이터: totalCount, currentPage, totalPages, pageSize
    - 범위 외 페이지 요청 시 빈 목록 반환
    - 중복 이미지 duplicate indicator 포함
    - 상세 조회: fileName, createdAt, originalBytes, optimizedBytes, savings percentage (소수점 1자리)
    - 썸네일 URL (최대 300px) 및 풀사이즈 URL 제공
    - _Requirements: 4.1~4.8_
  - [x]* 8.2 Property test: 갤러리 페이지네이션 정확성
    - **Property 8: 갤러리 페이지네이션 정확성**
    - 랜덤 레코드 수 + pageSize + page → 정렬, totalPages, 페이지 크기 제한 검증
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [x]* 8.3 Property test: Savings percentage 계산 정확성
    - **Property 9: Savings percentage 계산 정확성**
    - 랜덤 originalBytes/optimizedBytes 쌍 → 계산 공식 정확성 검증
    - **Validates: Requirements 4.6**
  - [x] 8.4 StatisticsService 구현 (`backend/src/modules/photo/statistics.service.ts`)
    - 총 원본 크기, 총 최적화 크기, 총 절약 바이트, 절약 퍼센트 (소수점 2자리)
    - 총 이미지 수, 중복 이미지 수
    - 이미지 0개 시 모든 값 0 반환 (나눗셈 방지)
    - DB 오류 시 에러 응답
    - _Requirements: 5.1~5.8_
  - [x]* 8.5 Property test: 통계 집계 정확성
    - **Property 10: 통계 집계 정확성**
    - 랜덤 photo 레코드 배열 → 합계, 퍼센트, 중복 수 정확성 검증
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 9. 정적 파일 서빙 설정
  - [x] 9.1 이미지 파일 서빙 구성
    - `/uploads` 디렉토리 정적 파일 서빙 설정 (NestJS ServeStaticModule 또는 nginx)
    - 썸네일 생성 및 서빙 로직 (최대 300px, 비율 유지)
    - 파일 경로 보안: 경로 순회 공격 방지
    - _Requirements: 4.7_

- [x] 10. Checkpoint - 백엔드 전체 기능 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. 프론트엔드 업로드 컴포넌트 구현
  - [x] 11.1 Next.js 프론트엔드 프로젝트 초기화 및 업로드 컴포넌트 구현
    - `frontend/` 디렉토리에 Next.js + shadcn/ui 프로젝트 구성
    - 드래그 앤 드롭 업로드 영역 구현
    - 멀티파일 선택 (최대 10개) 지원
    - 파일 타입/크기 클라이언트 사전 검증 (JPEG, PNG, WebP, 15MB 이하)
    - 업로드 진행률 표시
    - 업로드 결과 표시 (성공/실패, 중복 감지 알림)
    - API 호출: `POST /api/photos/upload`
    - _Requirements: 1.1~1.7, 3.5_

- [x] 12. 프론트엔드 갤러리 페이지 구현
  - [x] 12.1 갤러리 그리드 및 페이지네이션 구현
    - 썸네일 그리드 레이아웃 (반응형)
    - 페이지네이션 컨트롤 (이전/다음, 페이지 번호)
    - 중복 이미지 시각적 인디케이터 (뱃지/아이콘)
    - 이미지 상세 보기 (클릭 시 원본 크기, 최적화 크기, 절약률 표시)
    - 빈 갤러리 상태 표시
    - API 호출: `GET /api/photos`, `GET /api/photos/:id`
    - _Requirements: 4.1~4.8_

- [x] 13. 프론트엔드 통계 대시보드 구현
  - [x] 13.1 절약 용량 통계 대시보드 구현
    - 총 원본 크기, 최적화 크기, 절약 바이트 표시
    - 절약 퍼센트 시각화 (프로그레스 바 또는 도넛 차트)
    - 총 이미지 수, 중복 이미지 수 표시
    - 에러 상태 처리 (통계 조회 실패 시 안내 메시지)
    - API 호출: `GET /api/photos/statistics`
    - _Requirements: 5.1~5.8_

- [x] 14. Checkpoint - 프론트엔드 전체 기능 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Docker Compose 인프라 구성
  - [x] 15.1 Docker Compose 및 Dockerfile 작성
    - `docker-compose.yml`: PostgreSQL, NestJS 백엔드, Next.js 프론트엔드 서비스 정의
    - `backend/Dockerfile`: NestJS 앱 빌드 및 실행
    - `frontend/Dockerfile`: Next.js 앱 빌드 및 실행
    - PostgreSQL 볼륨 마운트 (데이터 영속성)
    - `/uploads` 볼륨 마운트 (이미지 영속성)
    - 환경 변수 설정 (DB 접속 정보, 포트 등)
    - _Requirements: 2.7, 5.7_
  - [x] 15.2 nginx 리버스 프록시 구성
    - `nginx/nginx.conf` 작성
    - `/api/*` → 백엔드 NestJS 프록시
    - `/uploads/*` → 정적 파일 서빙
    - `/` → 프론트엔드 Next.js 프록시
    - 파일 업로드 최대 크기 설정 (client_max_body_size 160m)
    - _Requirements: 6.2, 6.3_

- [x] 16. Final Checkpoint - 전체 시스템 통합 검증
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 각 태스크는 특정 requirements를 참조하여 추적 가능
- Checkpoints에서 점진적 검증 수행
- Property tests는 fast-check 라이브러리를 사용하여 최소 100회 반복 실행
- Unit tests는 Jest를 사용
- 백엔드 → 프론트엔드 → 인프라 순서로 의존성 기반 구현
- TypeScript를 전체 프로젝트에서 사용

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "3.1", "4.2"] },
    { "id": 4, "tasks": ["3.2", "4.3", "4.4", "4.5"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2", "7.1", "8.1", "8.4"] },
    { "id": 7, "tasks": ["7.2", "8.2", "8.3", "8.5", "9.1"] },
    { "id": 8, "tasks": ["11.1"] },
    { "id": 9, "tasks": ["12.1"] },
    { "id": 10, "tasks": ["13.1"] },
    { "id": 11, "tasks": ["15.1"] },
    { "id": 12, "tasks": ["15.2"] }
  ]
}
```
