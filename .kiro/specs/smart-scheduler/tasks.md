# Implementation Plan: SmartScheduler (업무 우선순위 자동 관리)

## Overview

PhotoLite 기존 앱에 추가되는 SmartScheduler 기능의 구현 계획. 대학원 생활의 필수 시간(연구·취침·식사·운동)을 보호한 채, 마감 기한과 중요도로 유동 업무를 자동 분할·배치하고, 남은 기한을 표시하며, 업무별 AI 에이전트 프롬프트를 추천한다. 핵심 로직은 DI 없는 순수 함수(`priority.util.ts`, `scheduling.util.ts`, `ai-recommender.util.ts`)로 구현하여 fast-check property test로 검증한다. 백엔드(NestJS + TypeORM)는 기존 `backend/`에 `scheduler` 모듈로 추가하고, 프론트엔드는 기존 `frontend/`에 `/schedule` 페이지를 추가하며, 인프라는 기존 nginx·Docker Compose 구성을 확장한다. 백엔드 → 프론트엔드 → 인프라 순서로 의존성 기반으로 구현한다.

## Tasks

- [x] 1. 스케줄러 모듈 초기화 및 엔티티 생성
  - [x] 1.1 scheduler 모듈 구조 및 NestJS 모듈 정의
    - `backend/src/modules/scheduler/` 디렉토리 구조 생성
    - `scheduler.module.ts` NestJS 모듈 정의 (엔티티 등록, 서비스 provider 와이어링)
    - `app.module.ts`에 SchedulerModule 등록 (기존 PhotoModule과 공존)
    - _Requirements: 9.6_
  - [x] 1.2 엔티티 4종 구현 (`backend/src/modules/scheduler/entities/`)
    - `task.entity.ts`: UUID PK, title, category, importance(1~5), deadline(TIMESTAMPTZ), estimatedMinutes, completedMinutes, earliestStart(nullable TIMESTAMPTZ), status, createdAt
    - `fixed-block.entity.ts`: UUID PK, type, title, startMinute, endMinute(end≤start = overnight wrap), daysOfWeek(bitmask, nullable), oneOffDate(nullable), createdAt
    - `schedule-allocation.entity.ts`: UUID PK, taskId(nullable, 연구 보호 블록은 null), generationId, startTime/endTime(TIMESTAMPTZ), kind, locked(boolean), createdAt
    - `scheduler-settings.entity.ts`: 단일 행 — researchQuotaMin, bufferMin, windDownMin, minChunkMin, maxFocusMin, urgencyWeight, importanceWeight, aiThreshold, timezone
    - deadline·generationId·startTime INDEX 생성
    - _Requirements: 1.1, 2.1, 5.5, 8.1_
  - [x] 1.3 상수 및 인터페이스 정의
    - `scheduler.constants.ts`: 기본값 전체 (RESEARCH_QUOTA_MIN=180, BUFFER_MIN=10, WIND_DOWN_MIN=30, MIN_CHUNK_MIN=25, MAX_FOCUS_MIN=120, URGENCY_WEIGHT=0.6, IMPORTANCE_WEIGHT=0.4, URGENCY_CAP=2.0, AI_THRESHOLD=0.5, DEFAULT_TZ='Asia/Seoul', CRITICAL_HOURS=24, WARNING_HOURS=72), 카테고리/타입 enum, AI 카테고리 베이스 점수·키워드 가중치 테이블
    - `interfaces/`: `priority.interface.ts`(PriorityBreakdown), `schedule.interface.ts`(TimeBlock, FreeInterval, SchedulePlan, UnscheduledTask), `ai.interface.ts`(AiRecommendation), `index.ts` barrel
    - _Requirements: 3.5, 4.1, 7.1_

- [x] 2. 우선순위 엔진 구현
  - [x] 2.1 priority.util.ts 순수 함수 구현 (`backend/src/modules/scheduler/priority.util.ts`)
    - `effortDensity(remainingMinutes, minutesUntilDeadline)`: 남은 노력 / 남은 기한
    - `computePriority(task, now, settings)`: urgency = clamp(density, 0, URGENCY_CAP); 마감≤now면 urgency=URGENCY_CAP + overdue 플래그; score = urgencyWeight·urgency + importanceWeight·(importance/5); PriorityBreakdown 반환
    - `comparePriority(a, b)`: score desc → deadline asc → importance desc → createdAt asc → id asc
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x]* 2.2 Property test: 우선순위 점수 단조성
    - **Property 6: 우선순위 점수 단조성**
    - 랜덤 태스크 쌍 생성 → 다른 조건 동일·중요도만 높은 태스크의 score가 더 크거나 같음, density 높은 태스크가 더 크거나 같음, 동점 시 tie-break 순서 검증
    - **Validates: Requirements 3.2, 3.6**

- [x] 3. 시간 서비스 구현
  - [x] 3.1 TimeService 구현 (`backend/src/modules/scheduler/time.service.ts`)
    - `now(timezone)`: 서버 시스템 클럭 기준 현재 시각을 설정된 타임존으로 반환
    - `remainingUntil(deadline, now)`: deadline − now (밀리초/분)
    - `classify(deadline, now)`: OVERDUE/CRITICAL(≤24h)/WARNING(≤72h)/NORMAL 순수 헬퍼
    - `format(remainingMinutes)`: 일·시·분 포맷
    - 소스 미확정 시 시스템 클럭 폴백 + 플래그 (순수 헬퍼와 I/O 분리)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 9.4_
  - [x]* 3.2 Property test: 남은 기한 분류 정확성
    - **Property 9: 남은 기한 분류 정확성**
    - 랜덤 deadline·now 쌍 → 경계값(정확히 24h, 72h) 포함 분류 정확성 및 OVERDUE 판정 검증
    - **Validates: Requirements 6.3**

- [x] 4. 고정 블록 및 설정 서비스 구현
  - [x] 4.1 DTO 정의 (`backend/src/modules/scheduler/dto/`)
    - `create-task.dto.ts` / `update-task.dto.ts`: title, category, importance(1~5), deadline, estimatedMinutes(>0), completedMinutes, earliestStart 검증
    - `create-fixed-block.dto.ts`: type, title, start/end, recurrence(daysOfWeek 또는 oneOffDate) 검증
    - `update-settings.dto.ts`: 모든 설정 필드 선택적 검증 (가중치 합·양수 제약)
    - `generate-schedule.dto.ts`: horizonDays 또는 start/end
    - `response.dto.ts`: TaskResponse, SchedulePlanResponse, PriorityBreakdown, AiRecommendation
    - _Requirements: 1.1, 2.1, 2.2, 5.5_
  - [x] 4.2 FixedBlockService 구현 (`backend/src/modules/scheduler/fixed-block.service.ts`)
    - CRUD (TypeORM Repository 패턴)
    - overnight wrap 해석 (end ≤ start면 익일로 확장)
    - 공유 요일 상의 시간 중첩 충돌 검증 → 충돌 블록 식별 에러
    - 최초 초기화 시 수면·3식·운동 기본 블록 시드 (편집/삭제 가능)
    - 삭제 시 잠긴 할당은 유지
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 4.3 SettingsService 구현 (`backend/src/modules/scheduler/settings.service.ts`)
    - 단일 행 조회/수정, 미존재 시 기본값으로 시드
    - _Requirements: 5.5_
  - [x]* 4.4 Unit test: 고정 블록 overnight wrap 및 충돌 감지
    - 23:00–07:00 같은 자정 횡단 블록 해석, 공유 요일 중첩 충돌 탐지, 비충돌 통과 시나리오 검증
    - _Requirements: 1.2, 1.3_

- [x] 5. TaskService 비즈니스 로직 구현
  - [x] 5.1 TaskService 구현 (`backend/src/modules/scheduler/task.service.ts`)
    - 태스크 CRUD (TypeORM Repository 패턴)
    - 진행률 기록: remainingMinutes = estimatedMinutes − completedMinutes (0 하한 클램프)
    - 마감 < 현재 시각 태스크 수락 + overdue 마킹
    - done 태스크는 이후 일정 생성에서 제외
    - 목록 반환 시 우선순위·남은 기한·AI 추천 병합 (priority.util, time.service, ai-recommender.service 조합)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 6. Checkpoint - 도메인 기반 로직 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 스케줄링 엔진 구현
  - [x] 7.1 scheduling.util.ts 순수 함수 구현 (`backend/src/modules/scheduler/scheduling.util.ts`)
    - `materializeFixedBlocks(blocks, horizon, tz)`: 호라이즌 내 고정 블록 occurrence 타임라인 전개 (DST-safe, overnight wrap 반영)
    - `deriveFreeIntervals(fixedBlocks, horizon, now, settings)`: 기상 시간 − 고정 블록 − 버퍼 − 취침 전 wind-down − 과거 시간
    - `reserveResearchQuota(freeIntervals, settings)`: 일자별 연구 쿼터를 다른 카테고리보다 먼저 예약, 쿼터 > 가용 시 전량 예약 + 부족분 보고
    - `allocateTasks(freeIntervals, tasks, locks, now, settings)`: 시간순 free interval에 우선순위 greedy 배치, 세션 분할(MIN_CHUNK ≤ len ≤ MAX_FOCUS, 세션 종료 ≤ deadline), eligibility(earliestStart 경과 & deadline > slotStart), 잠긴 윈도우 보존, 미배치분은 atRisk + 사유
    - `generateSchedule(...)`: 위 단계 오케스트레이션 → SchedulePlan(allocations + atRisk)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 6.5_
  - [x]* 7.2 Property test: 고정 블록 불가침성
    - **Property 1: 고정 블록 불가침성**
    - 랜덤 고정 블록·태스크 집합 → 생성된 모든 태스크 세션이 어떤 고정 블록 시간 범위와도 겹치지 않음 검증
    - **Validates: Requirements 1.5, 4.1**
  - [x]* 7.3 Property test: 수면 시간 및 필수 블록 보호
    - **Property 2: 수면 시간 및 필수 블록 보호**
    - 랜덤 입력 → SLEEP/MEAL/EXERCISE 블록 내부에 태스크 세션이 배치되지 않음 검증
    - **Validates: Requirements 5.3, 4.1**
  - [x]* 7.4 Property test: 할당 비중첩
    - **Property 3: 할당 비중첩**
    - 랜덤 입력 → 버퍼 적용 후 어떤 두 할당(고정·태스크)도 시간 인스턴트를 공유하지 않음 검증
    - **Validates: Requirements 4.7**
  - [x]* 7.5 Property test: 마감 준수 또는 보고
    - **Property 4: 마감 준수 또는 보고**
    - 랜덤 입력 → 모든 배치 세션 종료 ≤ 해당 태스크 deadline, 마감 전 배치 불가분은 atRisk에 사유와 함께 보고 검증
    - **Validates: Requirements 4.3, 4.5**
  - [x]* 7.6 Property test: 노력량 보존
    - **Property 5: 노력량 보존**
    - 랜덤 입력 → 각 태스크의 (배치 세션 합 + atRisk 미배치 잔량) == 남은 노력량 검증
    - **Validates: Requirements 4.6**
  - [x]* 7.7 Property test: 연구 시간 쿼터 확보
    - **Property 7: 연구 시간 쿼터 확보**
    - 랜덤 입력 → 가용 시간이 쿼터 이상인 날마다 연구용으로 최소 쿼터 분량이 비연구 태스크보다 먼저 확보됨 검증
    - **Validates: Requirements 5.1, 5.2**
  - [x]* 7.8 Property test: 포커스 세션 경계
    - **Property 8: 포커스 세션 경계**
    - 랜덤 입력 → 모든 세션 길이가 MAX_FOCUS 이하·MIN_CHUNK 이상(마지막 잔여 세션 제외) 검증
    - **Validates: Requirements 4.4**
  - [x]* 7.9 Property test: 결정성 및 멱등성
    - **Property 11: 결정성 및 멱등성**
    - 동일 태스크·고정 블록·설정·잠금·현재 시각 입력에 대해 두 번 생성 시 동일 플랜 산출, 재실행 멱등성 검증
    - **Validates: Requirements 4.8**

- [x] 8. ScheduleService 및 잠금 구현
  - [x] 8.1 ScheduleService 구현 (`backend/src/modules/scheduler/schedule.service.ts`)
    - 일정 생성 오케스트레이션: 설정·고정 블록·태스크·잠금 로드 → generateSchedule 호출 → allocation 영속화(generationId 부여)
    - 날짜 범위 조회: 범위 내 allocation을 startTime asc 정렬 + atRisk 목록 반환
    - horizon end < now면 검증 에러
    - _Requirements: 4.1, 8.4, 9.1, 9.5_
  - [x] 8.2 잠금/해제 로직 구현
    - 잠금: 잠긴 시간 윈도우 영속화 + 이후 재생성에서 immovable 처리
    - 해제: 다음 생성에서 재배치 허용
    - 재생성 시 잠긴 할당을 정확히 보존하고 나머지를 그 주변으로 비중첩 배치
    - _Requirements: 8.1, 8.2, 8.3_
  - [x]* 8.3 Property test: 잠금 보존
    - **Property 12: 잠금 보존**
    - 랜덤 입력에서 일부 할당 잠금 → 재생성 후 모든 잠긴 윈도우가 변경 없이 보존되고 나머지 배치와 비중첩 검증
    - **Validates: Requirements 8.2**

- [x] 9. AI 추천 구현
  - [x] 9.1 ai-recommender.util.ts 순수 함수 구현 (`backend/src/modules/scheduler/ai-recommender.util.ts`)
    - `computeSuitability(task)`: 카테고리 베이스 점수 + 제목·설명 키워드 가중치/페널티 → 0~1 클램프
    - `buildPrompt(task)`: 카테고리별 템플릿에 title·description·deadline·deliverable 보간 (프롬프트에 title 포함 보장)
    - 적합 시 rationale + AI 사용 유형(문서 작성/문헌 요약/코드 보조 등) 반환, 부적합 시 사유
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 9.2 AiRecommenderService 구현 (`backend/src/modules/scheduler/ai-recommender.service.ts`)
    - 단일/배치 태스크 적합도 산정 및 프롬프트 생성 오케스트레이션 (threshold는 settings에서 주입)
    - _Requirements: 7.2, 7.5_
  - [x]* 9.3 Property test: AI 적합도 분류 및 프롬프트 일관성
    - **Property 10: AI 적합도 분류 및 프롬프트 일관성**
    - 랜덤 태스크 → suitability ≥ threshold일 때만 프롬프트 추천, 추천 프롬프트가 항상 태스크 title 포함, 동일 입력 동일 출력(결정성) 검증
    - **Validates: Requirements 7.2, 7.3**

- [x] 10. Checkpoint - 스케줄링/AI 엔진 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. REST 컨트롤러 및 에러 처리 구현
  - [x] 11.1 컨트롤러 4종 구현
    - `task.controller.ts`: `POST/GET/GET :id/PATCH :id/DELETE :id /api/v1/tasks` (목록은 우선순위 desc + 남은 기한 + AI 추천 포함), `GET /api/v1/tasks/:id/ai-recommendation`, `GET /api/v1/tasks/ai-recommendations`
    - `fixed-block.controller.ts`: `POST/GET/PATCH :id/DELETE :id /api/v1/fixed-blocks`
    - `schedule.controller.ts`: `POST /api/v1/schedule/generate`, `GET /api/v1/schedule`, `POST·DELETE /api/v1/schedule/allocations/:id/lock`, `GET /api/v1/scheduler/now`
    - `settings.controller.ts`: `GET·PATCH /api/v1/scheduler/settings`
    - 공통 에러 응답 구조 `{ error, message, details?, timestamp }` (PhotoLite와 동일)
    - _Requirements: 6.1, 8.4_
  - [x] 11.2 에러 처리 및 엣지 케이스
    - 스케줄 불가분 태스크에 사유 + 처방(마감 연장/범위 축소/호라이즌 확장) 보고
    - 가용 시간 0인 날 보고, 빈 태스크셋 시 고정·연구 블록만 반환
    - DB 불가 시 503, horizon end < now 검증 에러, DST 횡단 타임존 인지 산술
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6, 9.7_
  - [x]* 11.3 Unit test: 컨트롤러 엔드포인트
    - 태스크 생성/검증 실패, 일정 생성, 일정 조회, 잠금/해제, 설정 수정, AI 추천 조회 시나리오 검증
    - _Requirements: 6.1, 8.4_

- [x] 12. Checkpoint - 백엔드 전체 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. 프론트엔드 태스크 관리 UI 구현
  - [x] 13.1 `/schedule` 페이지 및 태스크 CRUD UI 구현
    - `frontend/`에 `/schedule` 라우트 추가 (기존 shadcn/ui 구성 재사용)
    - 태스크 생성/수정 폼 (제목·카테고리·중요도 1~5·마감·예상 소요·earliest start), 진행률 입력, done 토글
    - 태스크 목록 (우선순위 desc 정렬, 우선순위 breakdown 노출)
    - API 호출: `/api/v1/tasks` 계열
    - _Requirements: 2.1, 2.4, 2.5, 3.5_

- [x] 14. 프론트엔드 고정 블록 및 설정 UI 구현
  - [x] 14.1 고정 블록 관리 및 설정 패널 구현
    - 고정 블록 CRUD UI (타입·요일/일자·시간, overnight wrap 안내, 충돌 에러 표시)
    - 설정 패널 (연구 쿼터·버퍼·wind-down·min chunk·max focus·가중치·AI threshold·타임존)
    - 기본 시드 블록 표시 및 편집
    - API 호출: `/api/v1/fixed-blocks`, `/api/v1/scheduler/settings`
    - _Requirements: 1.1, 1.4, 5.5_

- [x] 15. 프론트엔드 타임라인 및 조정 UI 구현
  - [x] 15.1 타임라인 뷰 + 조정 + AI 프롬프트 모달 구현
    - 일/주 타임라인에 고정 블록·연구 보호 블록·태스크 세션 시각화
    - 일정 생성/재생성 버튼 (horizon 지정), atRisk 태스크 + 사유/처방 표시
    - 할당 잠금/해제 토글, 남은 기한 뱃지(OVERDUE/CRITICAL/WARNING/NORMAL) + 일·시·분 표시
    - AI 추천 모달: 추천 프롬프트 복사, 사용 유형·rationale 노출, 부적합 사유 표시
    - 서버 현재 시각 표시 (`/api/v1/scheduler/now`)
    - API 호출: `/api/v1/schedule` 계열, `/api/v1/tasks/ai-recommendations`
    - _Requirements: 6.1, 6.3, 6.4, 7.3, 7.4, 8.1, 8.3, 8.4, 9.2_

- [x] 16. Checkpoint - 프론트엔드 전체 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. 인프라 통합
  - [x] 17.1 nginx 라우트·마이그레이션·타임존 환경변수 구성
    - `nginx/nginx.conf`에 `/schedule` 프론트엔드 라우트 확인 (기존 `/` 프록시로 커버되는지 검증, 필요 시 명시)
    - `/api/v1/*`는 기존 백엔드 프록시 재사용 (별도 변경 불필요 확인)
    - scheduler 엔티티 4종 마이그레이션 추가 및 적용
    - 백엔드 컨테이너 `TZ` / 앱 타임존 환경변수 설정 (기본 Asia/Seoul)
    - _Requirements: 9.6, 9.7_

- [x] 18. Final Checkpoint - 전체 시스템 통합 검증
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 각 태스크는 특정 requirements를 참조하여 추적 가능
- Checkpoints에서 점진적 검증 수행
- Property tests는 fast-check 라이브러리를 사용하여 최소 100회 반복 실행하고, 각 테스트에 `// Feature: smart-scheduler, Property N` 주석을 단다
- Unit tests는 Jest를 사용
- 핵심 로직(`priority.util.ts`, `scheduling.util.ts`, `ai-recommender.util.ts`)은 DI 없는 순수 함수로 구현하여 직접 테스트
- 백엔드 → 프론트엔드 → 인프라 순서로 의존성 기반 구현
- TypeScript를 전체 프로젝트에서 사용하며, 기존 PhotoLite 모듈과 동일한 `/api/v1` 접두사·포트·보안 설정을 공유
- 모든 시각 컬럼은 TIMESTAMPTZ, 스케줄링은 타임존 인지(IANA, 기본 Asia/Seoul) 산술로 DST 안전

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "4.2", "4.3"] },
    { "id": 4, "tasks": ["4.4", "5.1"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "8.1", "9.1"] },
    { "id": 7, "tasks": ["8.2", "9.2", "9.3"] },
    { "id": 8, "tasks": ["8.3", "11.1"] },
    { "id": 9, "tasks": ["11.2", "11.3"] },
    { "id": 10, "tasks": ["13.1"] },
    { "id": 11, "tasks": ["14.1"] },
    { "id": 12, "tasks": ["15.1"] },
    { "id": 13, "tasks": ["17.1"] }
  ]
}
```
