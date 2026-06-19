# PhotoLite — 프로젝트 개요서

---

## 1. 프로젝트 간단 소개

**PhotoLite**는 사진을 업로드하면 자동으로 용량을 최적화하고, 비슷한 사진을 중복으로 감지하며,
절약된 저장 용량을 통계로 보여주는 웹 서비스입니다.

- 업로드된 사진을 **WebP로 변환**하고 최대 너비 2000px 기준으로 **Resize**하여 용량을 줄여줍니다.
- 지각 해시(Average Hash, 64-bit)로 **비슷한 사진을 중복 감지**하여 불필요한 중복 저장을 방지합니다.
- 갤러리에서 정리된 사진과 **총 절약 용량·절약률**을 한눈에 확인할 수 있습니다.

한 학기 동안 학습한 **클라우드 3-Tier 아키텍처**(프론트엔드 · 백엔드 · 데이터베이스)와 **AWS EC2 배포**,
**Docker Compose** 컨테이너 운영을 kiro를 이용하여 구현해 보았습니다.

---

## 2. 타겟 (주요 사용자)

- 사진이 너무 많아 휴대폰·클라우드 드라이브 **용량이 부족한 사용자**
- 블로그·쇼핑몰 등에서 **이미지 용량을 줄여 페이지 로딩을 개선**하려는 사이트 운영자
- 비슷한 사진이 쌓여 **중복 정리가 어렵고 번거로운 사용자**

---

## 3. 유저 시나리오

1. 사용자가 갤러리 화면에서 정리하고 싶은 **사진 여러 장을 업로드** 합니다 (최대 10장, 각 15MB 이하).
2. 시스템이 각 사진을 자동으로 **최적화(WebP 변환·리사이즈)** 하고, 기존 사진과 비슷하면 **"중복"으로 표시** 합니다.
3. 사용자는 **절약된 총 용량**과 정리된 **갤러리**를 한 화면에서 확인할 수 있습니다.

---

## 4. 사용 기술 / 아키텍처

| 계층 | 기술 스택 |
|------|-----------|
| **프론트엔드** | Next.js 15, React 19, Tailwind CSS 4, Lucide React |
| **백엔드** | NestJS 11, TypeORM, sharp (이미지 처리), class-validator |
| **데이터베이스** | PostgreSQL 16 |
| **보안** | helmet, CORS, @nestjs/throttler (Rate Limiting) |
| **인프라** | AWS EC2 (Amazon Linux 2023), Docker Compose, nginx (리버스 프록시) |
| **패키지 매니저** | pnpm |
| **런타임** | Node.js 22 (Alpine) |

### 아키텍처 다이어그램

```
[브라우저] ─:80─▶ [nginx]
                    ├─ /         ─▶ [Next.js :3000]
                    ├─ /api/*    ─▶ [NestJS :3001] ─▶ [PostgreSQL :5432]
                    └─ /uploads/ ─▶ [NestJS :3001] ─▶ 최적화 이미지 (Docker Volume)
```

### Docker Compose 서비스 구성

| 서비스 | 이미지 | 포트 | 역할 |
|--------|--------|------|------|
| `nginx` | nginx:alpine | 80 (외부) | 리버스 프록시, 정적 캐싱 |
| `frontend` | photolite-frontend | 3000 (내부) | Next.js standalone 서버 |
| `backend` | photolite-backend | 3001 (내부) | NestJS API 서버 |
| `db` | postgres:16-alpine | 5432 | PostgreSQL 데이터베이스 |

---

## 5. 주요 기능

### 5-1. 이미지 업로드 & 검증
- 지원 포맷: JPEG, PNG, WebP (Magic bytes 기반 검증)
- 최대 파일 크기: 15MB
- 한 번에 최대 10장 업로드
- 빈 파일·위조 MIME 거부

### 5-2. 이미지 최적화
- WebP 변환 (quality: 80)
- 최대 너비 2000px 리사이즈 (비율 유지, `fit: inside`)
- EXIF 자동 회전 (`.rotate()`)
- 이미 최적인 WebP는 원본 유지 (재인코딩 안 함)
- EC2(m.large) 기준 5초 이내 처리

### 5-3. 중복 감지 (Average Hash)
- 8×8 그레이스케일 → 64-bit perceptual hash 생성
- Hamming Distance ≤ 5 → 중복 판정 (similarity ≥ 92.2%)
- 유사 이미지 목록 최대 10개 반환 (score 내림차순)
- 타임아웃(5초) 시 업로드는 계속, 비동기 재처리

### 5-4. 갤러리 조회
- 페이지네이션 (기본 20개, 최대 100개)
- 업로드일 내림차순 정렬
- 썸네일 (최대 300px) + 원본 상세 보기
- 중복 그룹 표시

### 5-5. 절약 통계
- 총 원본 크기 / 최적화 크기 / 절약 용량 / 절약률(%)
- 총 업로드 수 / 중복 감지 수

---

## 6. API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/photos/upload` | 이미지 업로드 (multipart/form-data) |
| `GET` | `/api/photos` | 갤러리 조회 (페이지네이션) |
| `GET` | `/api/photos/statistics` | 절약 통계 |
| `GET` | `/api/photos/:id` | 개별 이미지 상세 |
| `GET` | `/api/health` | 헬스 체크 |

---

## 7. 프로젝트 구조

```
photolite/
├── frontend/                    # Next.js 15 (App Router, standalone)
│   ├── src/
│   │   ├── app/                 # 페이지 및 레이아웃
│   │   ├── components/          # 공통 UI 컴포넌트
│   │   ├── domains/             # 도메인별 로직
│   │   ├── hooks/               # 커스텀 훅
│   │   └── utils/               # 유틸리티
│   ├── Dockerfile               # 멀티스테이지 (deps → builder → runner)
│   ├── next.config.ts
│   └── package.json
│
├── backend/                     # NestJS 11
│   ├── src/
│   │   ├── modules/photo/       # 핵심 도메인 모듈
│   │   │   ├── photo.controller.ts
│   │   │   ├── photo.service.ts
│   │   │   ├── image.util.ts         # 순수 함수 (optimizeImage, averageHash, hammingDistance)
│   │   │   ├── photo.constants.ts    # 상수 정의
│   │   │   ├── duplicate.detector.ts # 중복 감지 로직
│   │   │   ├── gallery.service.ts    # 갤러리 조회
│   │   │   ├── statistics.service.ts # 통계 서비스
│   │   │   ├── entities/             # TypeORM 엔티티
│   │   │   ├── dto/                  # DTO (요청/응답)
│   │   │   └── interfaces/           # 타입 인터페이스
│   │   ├── common/              # 필터, 인터셉터, 유틸
│   │   ├── config/              # 환경 설정
│   │   ├── app.module.ts        # 루트 모듈
│   │   └── main.ts             # 엔트리 포인트
│   ├── Dockerfile               # 멀티스테이지 (builder → runner)
│   ├── .npmrc                   # shamefully-hoist=true
│   └── package.json
│
├── nginx/
│   └── nginx.conf               # 리버스 프록시 설정
│
├── docker-compose.yml           # 전체 서비스 오케스트레이션
├── .gitignore
└── README.md
```

---

## 8. 실행 방법

### 사전 준비
- Docker & Docker Compose 설치
- (선택) pnpm 설치 (로컬 개발 시)

### Docker Compose로 전체 실행

```bash
# 프로젝트 루트에서
docker compose up -d --build

# 상태 확인
docker compose ps

# 로그 확인
docker compose logs -f backend
```

서비스가 정상 기동되면 **http://localhost** 에서 접속할 수 있습니다.

### 환경 변수 (backend)

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `DB_HOST` | localhost | PostgreSQL 호스트 |
| `DB_PORT` | 5432 | PostgreSQL 포트 |
| `DB_USERNAME` | photolite | DB 사용자명 |
| `DB_PASSWORD` | photolite_password | DB 비밀번호 |
| `DB_DATABASE` | photolite | DB 이름 |
| `DB_SYNC` | false | TypeORM 테이블 자동 동기화 (true/false) |
| `PORT` | 3001 | 백엔드 포트 |
| `NODE_ENV` | production | 실행 환경 |
| `UPLOAD_DIR` | /app/uploads | 이미지 저장 경로 |
| `MAX_FILE_SIZE` | 15728640 | 파일 최대 크기 (bytes) |
| `THROTTLE_TTL` | 60 | Rate Limit 윈도우 (초) |
| `THROTTLE_LIMIT` | 100 | Rate Limit 최대 요청 수 |

---

## 9. 실행 화면 캡처

**① 사진 업로드 + 절약 용량 표시**
`[이미지 삽입]`

**② 갤러리 (최적화된 사진)**
`[캡처 이미지 삽입]`

**③ 중복 감지 표시**
`[캡처 이미지 삽입]`

**④ 절약 통계 (총 절약 용량 / 절약률)**
`[이미지 삽입]`

---

## 10. 결과물 링크

- 배포 URL: `http://[ EC2 퍼블릭 IP ]`
- GitHub: `[ 저장소 주소 ]`

---

## 11. 한계 및 향후 과제

| 한계 | 개선 방향 |
|------|-----------|
| **중복 감지 정확도** — aHash는 빠르지만 편집된 사진은 누락/오탐 가능 | pHash, dHash 조합 또는 임계값 튜닝 |
| **원본 미보관** — 최적화본만 저장 | 원본 보존 옵션 추가 |
| **단일 인스턴스** — EC2 1대 로컬 디스크 | S3 + RDS 분리, Auto Scaling |
| **전수 비교** — 업로드마다 전체 해시 비교 | 해시 인덱싱 (B-tree, VP-tree) |
| **사용자 인증 없음** | JWT + RBAC 도입 |
| **로깅 미비** | nestjs-winston 등 중앙집중 로깅 |
