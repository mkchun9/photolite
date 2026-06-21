# Implementation Plan: SmartScheduler Upgrade

## Overview

기존 PhotoLite SmartScheduler를 5가지 영역(UI/UX, 알림, 통계, AI, 반복 태스크)으로 확장하는 업그레이드 구현 계획. 백엔드 인프라 → AI/NLP 서비스 → 프론트엔드 기능 → 통합/인프라 순으로 진행한다. 기존 `backend/src/modules/scheduler/` 모듈을 확장하며, 프론트엔드는 `frontend/src/components/scheduler/` 하위에 신규 컴포넌트를 추가한다.

## Tasks

- [ ] 1. 백엔드 인프라 기반 구축
  - [ ] 1.1 RecurringRule 엔티티 및 DB 마이그레이션 생성
    - `backend/src/modules/scheduler/entities/recurring-rule.entity.ts` 생성
    - Task 엔티티에 `recurringRuleId`, `instanceSequence` 컬럼 추가
    - TypeORM 마이그레이션 파일 생성 (recurring_rule 테이블 + task 컬럼 확장)
    - _Requirements: 9.1, 9.8_

  - [ ] 1.2 SchedulerSettings 엔티티 확장
    - `gemmaApiKey`, `llmEnabled`, `morningSummaryMinute`, `notificationPollIntervalMin`, `recurringGenerationHorizonDays` 컬럼 추가
    - TypeORM 마이그레이션 파일 생성
    - SettingsController에 신규 필드 CRUD 반영
    - _Requirements: 8.7, 5.1, 9.2_

  - [ ] 1.3 신규 DTO 및 인터페이스 파일 생성
    - `dto/analytics-report.dto.ts` — WeeklyReport, MonthlyReport, CategoryTimeReport
    - `dto/create-recurring-rule.dto.ts`, `dto/update-recurring-rule.dto.ts`
    - `dto/nlp-parse-request.dto.ts`, `dto/nlp-parse-response.dto.ts`, `dto/nlp-confirm-request.dto.ts`
    - `dto/update-allocation.dto.ts` (DnD 시간 변경용)
    - `interfaces/analytics.interface.ts`, `interfaces/recurring.interface.ts`, `interfaces/nlp.interface.ts`
    - _Requirements: 6.5, 7.5, 9.1, 12.2, 1.2_

  - [ ] 1.4 SchedulerModule 등록 업데이트
    - 신규 엔티티(RecurringRule)를 TypeOrmModule.forFeature에 추가
    - 신규 컨트롤러(AnalyticsController, RecurringController, NlpController) 등록
    - 신규 서비스(AnalyticsService, RecurringTaskService, LlmRecommenderService, NlpTaskParserService) 등록
    - _Requirements: 6.5, 7.5, 9.1, 8.1, 12.2_

- [ ] 2. 반복 태스크 서비스 구현
  - [ ] 2.1 RecurringTaskService 핵심 로직 구현
    - `backend/src/modules/scheduler/recurring-task.service.ts` 생성
    - 반복 규칙 생성 시 14일 선행 인스턴스 자동 생성 (`generateInstances`)
    - DAILY: 매일 1개, WEEKLY: 해당 요일에만 생성
    - 인스턴스 마감 = instanceDate + deadlineTimeOffset
    - horizon 도달 시 자동 배치 생성 로직
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 2.2 반복 인스턴스 수정/삭제 로직 구현
    - 단일 인스턴스 수정: 해당 인스턴스만 업데이트
    - 규칙 수정: 미래 PENDING 인스턴스만 일괄 업데이트
    - 규칙 삭제: 미래 PENDING 삭제, IN_PROGRESS/DONE 보존
    - 만료 규칙 처리 (endDate < today → EXPIRED)
    - _Requirements: 9.5, 9.6, 9.7, 11.5_

  - [ ] 2.3 RecurringController REST API 구현
    - `backend/src/modules/scheduler/recurring.controller.ts` 생성
    - POST `/api/v1/recurring-rules` — 규칙 생성
    - GET `/api/v1/recurring-rules` — 규칙 목록
    - PATCH `/api/v1/recurring-rules/:id` — 규칙 수정
    - DELETE `/api/v1/recurring-rules/:id` — 규칙 삭제
    - GET `/api/v1/recurring-rules/:id/instances` — 인스턴스 목록
    - _Requirements: 9.1, 9.5, 9.6, 9.7, 9.8_

  - [ ] 2.4 스케줄링 엔진에 반복 인스턴스 통합
    - ScheduleService에서 반복 인스턴스를 독립 태스크로 취급하여 우선순위 산정
    - 동일 규칙의 인스턴스는 마감 순서대로 스케줄링
    - OVERDUE 인스턴스 독립 처리 로직
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 2.5 Property test: 반복 인스턴스 생성 정확성 (P15)
    - **Property 15: 반복 인스턴스 생성 정확성**
    - **Validates: Requirements 9.2, 9.3**

  - [ ]* 2.6 Property test: 반복 인스턴스 독립성 (P16)
    - **Property 16: 반복 인스턴스 독립성 (단일 수정)**
    - **Validates: Requirements 9.5**

  - [ ]* 2.7 Property test: 반복 규칙 수정 범위 제한 (P17)
    - **Property 17: 반복 규칙 수정 범위 제한**
    - **Validates: Requirements 9.6**

  - [ ]* 2.8 Property test: 반복 규칙 삭제 시 인스턴스 보존 (P18)
    - **Property 18: 반복 규칙 삭제 시 인스턴스 보존**
    - **Validates: Requirements 9.7**

  - [ ]* 2.9 Property test: 반복 인스턴스 데드라인 순서 스케줄링 (P19)
    - **Property 19: 반복 인스턴스 데드라인 순서 스케줄링**
    - **Validates: Requirements 10.2, 10.3**

  - [ ]* 2.10 Property test: 만료된 반복 규칙 인스턴스 비생성 (P20)
    - **Property 20: 만료된 반복 규칙 인스턴스 비생성**
    - **Validates: Requirements 11.5**

- [ ] 3. 통계/분석 서비스 구현
  - [ ] 3.1 AnalyticsService 구현
    - `backend/src/modules/scheduler/analytics.service.ts` 생성
    - `analytics.util.ts` 순수 함수: 트렌드 계산, 완료율, 일평균
    - getWeeklyReport: 7일 카테고리별 시간 집계 (TypeORM QueryBuilder)
    - getMonthlyReport: 30일 카테고리별 시간 집계
    - getCategoryDetailReport: 카테고리별 상세 + 주간 트렌드 + 요일별 분포
    - 데이터 없는 기간 → 0 반환 (에러 아님)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.4, 11.3_

  - [ ] 3.2 AnalyticsController REST API 구현
    - `backend/src/modules/scheduler/analytics.controller.ts` 생성
    - GET `/api/v1/analytics/weekly` — 주간 리포트
    - GET `/api/v1/analytics/monthly` — 월간 리포트
    - GET `/api/v1/analytics/categories?period=7|30` — 카테고리 상세
    - _Requirements: 6.5, 7.5_

  - [ ]* 3.3 Property test: 시간 사용 분석 카테고리별 집계 (P10)
    - **Property 10: 시간 사용 분석 카테고리별 집계**
    - **Validates: Requirements 6.1, 6.2, 7.4**

  - [ ]* 3.4 Property test: 분석 파생 지표 일관성 (P11)
    - **Property 11: 분석 파생 지표 일관성**
    - **Validates: Requirements 6.3, 6.4**

  - [ ]* 3.5 Property test: 카테고리 주간 트렌드 계산 정확성 (P12)
    - **Property 12: 카테고리 주간 트렌드 계산 정확성**
    - **Validates: Requirements 7.2**

- [ ] 4. Checkpoint - 백엔드 기반 검증
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. AI/NLP 서비스 구현 (Gemma 4 연동)
  - [ ] 5.1 LlmRecommenderService 구현
    - `backend/src/modules/scheduler/llm-recommender.service.ts` 생성
    - Google AI Studio REST API 호출 (Gemma 4 모델)
    - 시스템 메시지 구성: 태스크 제목, 카테고리, 마감, 잔여 노력
    - 500 토큰 제한, 10초 타임아웃
    - 캐시 구현 (taskId + updatedAt 키)
    - API 에러/타임아웃 → 규칙 기반 폴백
    - API 키 미설정 → 규칙 기반 폴백 + 로그
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 11.1_

  - [ ] 5.2 NlpTaskParserService 구현
    - `backend/src/modules/scheduler/nlp-task-parser.service.ts` 생성
    - `backend/src/modules/scheduler/nlp-parser.util.ts` 순수 함수
    - Gemma 4 API 호출 (JSON 모드, 한국어 특화 시스템 프롬프트)
    - 파싱 결과 필드 검증 (importance 1-5, estimatedMinutes > 0)
    - 기본값 적용 (importance=3, category=OTHER)
    - 다중 태스크 분리 (쉼표/줄바꿈 구분)
    - 과거 마감 경고 + 미래 날짜 제안
    - 불확실 입력 → clarificationNeeded 필드
    - 키워드 기반 폴백 파서 (API 실패 시)
    - _Requirements: 12.2, 12.3, 12.6, 12.7, 12.8, 13.1, 13.2, 13.3, 13.4_

  - [ ] 5.3 NlpController REST API 구현
    - `backend/src/modules/scheduler/nlp.controller.ts` 생성
    - POST `/api/v1/nlp/parse` — 자연어 파싱 (Gemma 4 호출)
    - POST `/api/v1/nlp/confirm` — 파싱 결과 확인 → 태스크/반복 규칙 생성
    - confirm 시 TaskService.create + RecurringTaskService.createRule (반복 시)
    - confirm 후 ScheduleService.regenerate() 호출
    - _Requirements: 12.2, 12.5, 12.9_

  - [ ]* 5.4 Property test: LLM 시스템 메시지 필수 필드 포함 (P13)
    - **Property 13: LLM 시스템 메시지 필수 필드 포함**
    - **Validates: Requirements 8.2**

  - [ ]* 5.5 Property test: LLM 캐시 일관성 및 응답 구조 (P14)
    - **Property 14: LLM 캐시 일관성 및 응답 구조**
    - **Validates: Requirements 8.5, 8.6**

  - [ ]* 5.6 Property test: NLP 파싱 결과 유효성 및 기본값 적용 (P21)
    - **Property 21: NLP 파싱 결과 유효성 및 기본값 적용**
    - **Validates: Requirements 12.2, 12.3, 13.3**

  - [ ]* 5.7 Property test: 한국어 시간 표현 파싱 정확성 (P22)
    - **Property 22: 한국어 시간 표현 파싱 정확성**
    - **Validates: Requirements 12.8**

  - [ ]* 5.8 Property test: 반복 패턴 키워드 인식 (P23)
    - **Property 23: 반복 패턴 키워드 인식**
    - **Validates: Requirements 12.6**

  - [ ]* 5.9 Property test: NLP 폴백 파서 시간 추출 (P24)
    - **Property 24: NLP 폴백 파서 시간 추출**
    - **Validates: Requirements 12.7**

  - [ ]* 5.10 Property test: NLP 다중 태스크 분리 (P25)
    - **Property 25: NLP 다중 태스크 분리**
    - **Validates: Requirements 13.2**

  - [ ]* 5.11 Property test: NLP 과거 마감 경고 (P26)
    - **Property 26: NLP 과거 마감 경고**
    - **Validates: Requirements 13.4**

- [ ] 6. Checkpoint - AI/NLP 서비스 검증
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. DnD 일정 조정 API 및 프론트엔드 구현
  - [ ] 7.1 ScheduleController에 DnD PATCH 엔드포인트 추가
    - PATCH `/api/v1/schedule/allocations/:id` — startAt, endAt 업데이트 + 자동 locked=true
    - 충돌 검증 (고정 블록/잠금 블록 겹침 시 400 반환)
    - _Requirements: 1.2, 1.4_

  - [ ] 7.2 DnD 프론트엔드 훅 및 컴포넌트 구현
    - `frontend/src/hooks/useDragDrop.ts` — DnD 상태 관리 훅
    - `frontend/src/components/scheduler/DragDropWrapper.tsx` — DnD 컨텍스트
    - `frontend/src/components/scheduler/DraggableBlock.tsx` — 드래그 가능 블록
    - `frontend/src/components/scheduler/DropSlot.tsx` — 드롭 타겟 슬롯
    - HTML5 Drag and Drop API 사용
    - 잠금/고정 블록 드래그 방지 + 잠금 아이콘 표시
    - 드래그 중 실시간 시간 미리보기
    - 충돌 시 원위치 복원 + 에러 토스트
    - 성공 시 낙관적 업데이트 + 자동 잠금
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 11.4_

  - [ ]* 7.3 Property test: DnD 블록 이동 시 시간 보존 (P1)
    - **Property 1: 드래그 앤 드롭 블록 이동 시 시간 보존**
    - **Validates: Requirements 1.2**

  - [ ]* 7.4 Property test: DnD 충돌 검출 정확성 (P2)
    - **Property 2: 드래그 앤 드롭 충돌 검출 정확성**
    - **Validates: Requirements 1.3, 1.5**

  - [ ]* 7.5 Property test: 드래그 가능 여부 판별 (P3)
    - **Property 3: 드래그 가능 여부 판별**
    - **Validates: Requirements 1.5**

- [ ] 8. 캘린더 뷰 프론트엔드 구현
  - [ ] 8.1 캘린더 뷰 핵심 컴포넌트 구현
    - `frontend/src/components/scheduler/CalendarView.tsx` — 뷰 모드 전환 (주간/월간)
    - `frontend/src/components/scheduler/CalendarWeekView.tsx` — 7일 × 24시간 그리드
    - `frontend/src/components/scheduler/CalendarMonthView.tsx` — 월간 일별 요약
    - `frontend/src/hooks/useCalendar.ts` — 날짜 네비게이션, 범위 계산
    - 색상 코딩: 고정=회색, 연구예약=초록, 태스크=카테고리별 색상
    - 현재 시각 "now" 인디케이터 라인 (주간 뷰)
    - 오늘 날짜 하이라이트
    - 월간 뷰 날짜 클릭 → 주간 뷰 네비게이션
    - DnD 통합 (DraggableBlock + DropSlot 재사용)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 8.2 ScheduleTabs에 캘린더 탭 통합
    - 기존 `ScheduleTabs.tsx`에 캘린더 뷰 탭 추가 (기존 타임라인과 별개)
    - 타임라인 뷰에도 DnD 기능 적용
    - _Requirements: 2.1, 1.6_

  - [ ]* 8.3 Property test: 캘린더 블록 위치 계산 정확성 (P4)
    - **Property 4: 캘린더 블록 위치 계산 정확성**
    - **Validates: Requirements 2.2**

  - [ ]* 8.4 Property test: 월간 캘린더 일별 요약 집계 (P5)
    - **Property 5: 월간 캘린더 일별 요약 집계**
    - **Validates: Requirements 2.3**

  - [ ]* 8.5 Property test: 캘린더 날짜 범위 네비게이션 (P6)
    - **Property 6: 캘린더 날짜 범위 네비게이션**
    - **Validates: Requirements 2.6**

- [ ] 9. 다크 모드 구현
  - [ ] 9.1 다크 모드 서비스 및 훅 구현
    - `frontend/src/lib/theme-service.ts` — localStorage 테마 읽기/쓰기/적용
    - `frontend/src/hooks/useTheme.ts` — 테마 상태 관리 + 토글
    - `frontend/src/components/scheduler/ThemeToggle.tsx` — 헤더 토글 버튼 (sun/moon 아이콘)
    - `app/layout.tsx` `<head>`에 인라인 스크립트 삽입 (flash 방지)
    - TailwindCSS `darkMode: 'class'` 설정 확인
    - 모든 scheduler 컴포넌트에 `dark:` 변형 클래스 추가
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 9.2 Property test: 테마 토글 라운드트립 (P7)
    - **Property 7: 테마 토글 라운드트립**
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [ ] 10. Checkpoint - UI/UX 기능 검증
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. 알림/리마인더 서비스 구현
  - [ ] 11.1 알림 서비스 프론트엔드 구현
    - `frontend/src/lib/notification-scheduler.ts` — 폴링 기반 알림 스케줄러
    - `frontend/src/hooks/useNotification.ts` — 알림 권한 요청 + 발송 훅
    - Browser Notifications API 연동
    - 마감 임박 알림: 24시간 threshold + 1시간 threshold
    - 중복 방지 (taskId + threshold 조합으로 세션 내 1회만)
    - 권한 거부 시 인앱 토스트 폴백
    - Notifications API 미지원 시 인앱 토스트 전용
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 11.2_

  - [ ] 11.2 매일 아침 일정 요약 구현
    - NotificationScheduler에 daily summary 트리거 (설정 시각, 기본 08:00)
    - 오늘 allocations 조회 → 총 태스크 수, 총 시간, 상위 3개 우선순위 태스크
    - 페이지 미오픈 시 → 다음 접속 때 인앱 배너 표시
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 11.3 Property test: 마감 임계값 초과 감지 정확성 (P8)
    - **Property 8: 마감 임계값 초과 감지 정확성**
    - **Validates: Requirements 4.2, 4.3, 4.5**

  - [ ]* 11.4 Property test: 일일 요약 집계 정확성 (P9)
    - **Property 9: 일일 요약 집계 정확성**
    - **Validates: Requirements 5.2**

- [ ] 12. 자연어 입력 및 통계 프론트엔드 구현
  - [ ] 12.1 NLP 자연어 입력 컴포넌트 구현
    - `frontend/src/components/scheduler/NLPInput.tsx` — chat-style 텍스트 입력
    - `frontend/src/hooks/useNlpParser.ts` — POST /nlp/parse, /nlp/confirm API 호출
    - 확인 카드 UI (파싱 결과 표시 + 필드 수정 가능 + 확인/취소 버튼)
    - 다중 태스크 시 복수 확인 카드 표시
    - 불확실 입력 시 후속 질문 표시
    - API 실패 시 폼 프리필 폴백
    - 확인 후 자동 schedule regeneration 트리거
    - 태스크 관리 탭 상단에 배치
    - _Requirements: 12.1, 12.4, 12.5, 12.9, 13.1, 13.2, 12.7_

  - [ ] 12.2 통계/분석 뷰 컴포넌트 구현
    - `frontend/src/components/scheduler/AnalyticsView.tsx` — 통계 대시보드 컨테이너
    - `frontend/src/components/scheduler/AnalyticsBarChart.tsx` — 카테고리별 시간 바 차트 (CSS/SVG)
    - `frontend/src/hooks/useAnalytics.ts` — GET /analytics/weekly, monthly, categories 호출
    - 주간/월간 토글
    - 요약 카드: 총 생산 시간, 일평균, 전체 완료율
    - 트렌드 표시: 증감 화살표 + 퍼센트
    - 요일별 분포 표시
    - _Requirements: 6.6, 7.3_

  - [ ] 12.3 반복 태스크 프론트엔드 구현
    - `frontend/src/components/scheduler/RecurringTaskForm.tsx` — 반복 규칙 생성 폼
    - `frontend/src/components/scheduler/RecurringTaskList.tsx` — 반복 태스크 목록 (그룹화 표시)
    - `frontend/src/hooks/useRecurringTasks.ts` — 반복 규칙 CRUD API 호출
    - 반복 인디케이터 아이콘 + 인스턴스 순번 표시 ("3/10", "Day 5")
    - TaskList 컴포넌트에 반복 태스크 구분 표시 통합
    - _Requirements: 9.8, 9.9_

  - [ ] 12.4 ScheduleTabs에 통계 탭 및 NLP 입력 통합
    - 기존 ScheduleTabs에 "통계" 탭 추가 (AnalyticsView 렌더)
    - 태스크 관리 탭 상단에 NLPInput 컴포넌트 배치
    - _Requirements: 6.6, 12.1_

- [ ] 13. Checkpoint - 프론트엔드 기능 검증
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. 에러 처리 및 글로벌 UI 통합
  - [ ] 14.1 프론트엔드 에러 처리 통합
    - API 페치 실패 시 에러 메시지 + 재시도 버튼 표시 (공통 컴포넌트)
    - DnD 서버 에러 → 블록 원위치 복원 + 에러 토스트
    - 토스트 알림 컴포넌트 구현 (성공/에러/경고)
    - _Requirements: 11.4, 11.6_

  - [ ] 14.2 백엔드 에러 처리 보강
    - LLM API 키 미설정/무효 → 규칙 기반 폴백 + 로그 (에러 반환 안 함)
    - Analytics 빈 기간 → 0 값 정상 응답
    - 반복 규칙 과거 종료 → EXPIRED 처리
    - 검증 실패 → 400 + 상세 사유
    - _Requirements: 11.1, 11.3, 11.5_

- [ ] 15. 인프라 및 마이그레이션
  - [ ] 15.1 Docker Compose 및 환경 설정 업데이트
    - `backend/.env.example`에 `GEMMA_API_KEY` 추가
    - `backend/package.json`에 `fast-check` devDependency 추가
    - TypeORM 마이그레이션 실행 확인
    - _Requirements: 8.7_

  - [ ] 15.2 TailwindCSS 다크 모드 설정 확인
    - tailwind 설정에서 `darkMode: 'class'` 활성화 확인
    - 기존 컴포넌트에 dark: 변형 적용되는지 확인
    - _Requirements: 3.6_

- [ ] 16. Final checkpoint - 전체 통합 검증
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- Property tests validate universal correctness properties from the design document (fast-check, numRuns: 100)
- Unit tests validate specific examples and edge cases
- Backend tasks (1-6) must complete before dependent frontend tasks (7-12)
- 기존 scheduler 모듈 코드를 확장하며, 절대 기존 파일을 삭제/교체하지 않음
- Gemma 4 API 연동은 HTTP REST 호출 (google-generativelanguage SDK 사용 안 함)
- 프론트엔드는 외부 차트 라이브러리 없이 CSS/SVG 기반 바 차트 구현

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "15.1", "15.2"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "3.3", "3.4", "3.5"] },
    { "id": 5, "tasks": ["5.1", "5.2"] },
    { "id": 6, "tasks": ["5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11"] },
    { "id": 7, "tasks": ["7.1"] },
    { "id": 8, "tasks": ["7.2", "9.1"] },
    { "id": 9, "tasks": ["7.3", "7.4", "7.5", "8.1", "9.2"] },
    { "id": 10, "tasks": ["8.2", "8.3", "8.4", "8.5"] },
    { "id": 11, "tasks": ["11.1", "11.2"] },
    { "id": 12, "tasks": ["11.3", "11.4", "12.1", "12.2", "12.3"] },
    { "id": 13, "tasks": ["12.4", "14.1", "14.2"] }
  ]
}
```
