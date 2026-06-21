# Requirements Document

## Introduction

SmartScheduler Upgrade는 기존 PhotoLite SmartScheduler의 5가지 핵심 영역을 개선하는 기능 업그레이드이다. 기존 시스템은 태스크 CRUD, 고정 블록 관리, 우선순위 기반 그리디 일정 배치, 타임라인 뷰, 규칙 기반 AI 추천 기능을 갖추고 있으며, 이번 업그레이드는 다음을 추가한다:

1. **UI/UX 개선** — 드래그 앤 드롭 일정 조정, 캘린더 뷰, 다크 모드
2. **알림/리마인더** — 마감 임박 알림, 매일 아침 일정 요약
3. **통계/분석** — 주간/월간 시간 사용 분석, 카테고리별 투자 시간 리포트
4. **AI 강화** — Google Gemma 4 무료 API 연동으로 LLM 기반 프롬프트 생성 품질 향상 + **자연어 태스크 생성** (예: "매일 1시간씩 논문 읽기" 입력 → 자동 태스크 생성+반복 설정+일정 배치)
5. **반복 태스크 고도화** — 매일/매주 반복 태스크를 독립 인스턴스로 관리

**기존 기술 스택:**
- 프론트엔드: Next.js 15 + TailwindCSS + lucide-react (frontend/) — `/schedule` 페이지
- 백엔드: NestJS + TypeORM + PostgreSQL (backend/src/modules/scheduler/)
- 배포: Docker Compose on EC2, nginx reverse proxy

**제약 조건:**
- AI: Google AI Studio 무료 API 엔드포인트 (Gemma 4 모델)
- 알림: Browser Notifications API (푸시 서버 불필요, 프론트엔드 폴링 또는 Service Worker)
- 드래그 앤 드롭: HTML5 Drag and Drop API 또는 경량 라이브러리
- 기존 한국어 UI 스타일 유지 (TailwindCSS, lucide-react 아이콘)
- Single-tenant, 인증 없음

## Glossary

- **Scheduler_Frontend**: /schedule 페이지의 Next.js 프론트엔드 클라이언트 애플리케이션
- **Calendar_View**: 태스크와 고정 블록 배치를 월간/주간 캘린더 형태로 시각화하는 UI 컴포넌트
- **DragDrop_Controller**: 드래그 앤 드롭 인터랙션을 처리하여 일정 블록의 시간 이동을 관리하는 프론트엔드 모듈
- **Theme_Service**: 다크 모드와 라이트 모드 간 전환을 관리하는 프론트엔드 서비스 모듈
- **Notification_Service**: 마감 임박 알림과 일일 요약을 Browser Notifications API를 통해 전달하는 프론트엔드 서비스 모듈
- **Notification_Scheduler**: 알림 발송 시점을 결정하고 주기적으로 조건을 확인하는 프론트엔드 스케줄링 모듈
- **Analytics_Service**: 완료된 태스크 세션 데이터를 집계하여 시간 사용 통계를 산출하는 백엔드 서비스 모듈
- **Analytics_Controller**: 통계/분석 데이터를 조회하는 REST API 엔드포인트를 제공하는 백엔드 컨트롤러
- **LLM_Recommender**: Google Gemma 4 API를 호출하여 태스크별 AI 프롬프트를 생성하는 백엔드 서비스 모듈
- **Recurring_Task_Service**: 반복 규칙에 따라 태스크 인스턴스를 독립적으로 생성·관리하는 백엔드 서비스 모듈
- **Recurring_Rule**: 반복 태스크의 주기(매일, 매주 특정 요일), 종료 조건, 생성 규칙을 정의하는 데이터 구조
- **Task_Instance**: 반복 규칙에 의해 생성된 개별 태스크 인스턴스. 각 인스턴스는 독립적인 마감, 상태, 진행률을 가진다
- **Time_Report**: 특정 기간(주간/월간) 동안의 카테고리별 투자 시간과 완료율을 요약한 분석 데이터
- **Dark_Mode**: 어두운 색상 테마를 적용하여 야간 사용 시 눈의 피로를 줄이는 UI 모드
- **Allocation_Block**: 타임라인 또는 캘린더에서 드래그 가능한 개별 일정 블록 UI 요소
- **NLP_Task_Parser**: 자연어 입력을 Gemma 4 LLM으로 파싱하여 태스크 필드(제목, 카테고리, 소요시간, 마감, 반복 규칙 등)를 자동 추출하는 백엔드 서비스 모듈
- **Natural_Language_Input**: 사용자가 자연어로 입력한 태스크 설명 텍스트. 예: "매일 1시간씩 논문 읽기", "금요일까지 보고서 작성 3시간"
- **Work_Hours**: 사용자가 설정한 근무 시간 경계 (출근 시각~퇴근 시각). 이 범위 내에서만 업무 태스크를 배치하여 야근을 최소화한다
- **Quick_Input_Mode**: 태스크 생성 시 제목과 예상 시간만 입력하는 간소화 모드. 나머지 필드는 스마트 기본값이 자동 적용된다

## Requirements

### Requirement 1: 드래그 앤 드롭 일정 조정

**User Story:** As a user, I want to drag and drop scheduled task blocks on the timeline or calendar to adjust their time, so that I can manually fine-tune my schedule without re-entering data.

#### Acceptance Criteria

1. WHEN a User drags an unlocked task allocation block on the timeline view, THE DragDrop_Controller SHALL visually indicate the block is being moved and display the target time slot in real-time
2. WHEN a User drops a task allocation block onto a valid free time slot, THE DragDrop_Controller SHALL update the allocation start and end times to match the drop target and persist the change via the backend API
3. IF a User drops a task allocation block onto a time slot that overlaps with a fixed block or another locked allocation, THEN THE DragDrop_Controller SHALL reject the drop, return the block to its original position, and display an error message indicating the conflict
4. WHEN a User drops a task allocation block onto a valid slot, THE DragDrop_Controller SHALL automatically lock the moved allocation so that subsequent schedule regenerations preserve the user's manual adjustment
5. THE DragDrop_Controller SHALL prevent dragging of fixed blocks and locked allocations by displaying a visual indicator (lock icon) and ignoring drag attempts on those elements
6. WHEN a drag operation completes successfully, THE Scheduler_Frontend SHALL update the timeline and calendar views to reflect the new allocation position without requiring a full page reload

### Requirement 2: 캘린더 뷰

**User Story:** As a user, I want to see my schedule in a monthly and weekly calendar format, so that I can get an overview of my time allocation across days and weeks.

#### Acceptance Criteria

1. THE Scheduler_Frontend SHALL provide a calendar view with two display modes: weekly view showing 7 days with hourly time slots, and monthly view showing the full month with daily summaries
2. WHEN a User switches to the weekly calendar view, THE Scheduler_Frontend SHALL display all allocations (fixed blocks, task sessions, research reserved blocks) as color-coded blocks positioned at their scheduled times within each day column
3. WHEN a User switches to the monthly calendar view, THE Scheduler_Frontend SHALL display each day cell with a summary of total scheduled hours, the count of tasks due that day, and color indicators for at-risk tasks
4. WHEN a User clicks on a day in the monthly view, THE Scheduler_Frontend SHALL navigate to the weekly view focused on that day
5. THE Scheduler_Frontend SHALL color-code allocations by type: fixed blocks in gray, research reserved in green, and task sessions in a color corresponding to the task category
6. WHEN a User navigates to a previous or next week or month, THE Scheduler_Frontend SHALL fetch and display the allocations for the requested date range from the backend API
7. THE Scheduler_Frontend SHALL display the current day with a visual highlight and show a "now" indicator line on the weekly view at the current time position

### Requirement 3: 다크 모드

**User Story:** As a user, I want to toggle between light mode and dark mode, so that I can reduce eye strain when using the scheduler at night.

#### Acceptance Criteria

1. THE Theme_Service SHALL provide a toggle control accessible from the scheduler header that switches between light mode and dark mode
2. WHEN a User activates dark mode, THE Theme_Service SHALL apply a dark color palette to all scheduler UI components including the timeline, calendar, task list, settings panel, and modal dialogs
3. WHEN a User activates light mode, THE Theme_Service SHALL restore the original light color palette to all scheduler UI components
4. THE Theme_Service SHALL persist the selected theme preference in the browser's local storage so that the preference is retained across page reloads and sessions
5. WHEN the scheduler page loads, THE Theme_Service SHALL read the stored theme preference from local storage and apply it immediately before rendering content to prevent a flash of incorrect theme
6. THE Theme_Service SHALL implement dark mode using TailwindCSS dark variant classes so that all existing UI components receive consistent dark styling

### Requirement 4: 마감 임박 알림

**User Story:** As a user, I want to receive browser notifications when a task's deadline is approaching, so that I do not miss important deadlines while working on other things.

#### Acceptance Criteria

1. WHEN the scheduler page is loaded for the first time, THE Notification_Service SHALL request browser notification permission from the User
2. WHEN a task's remaining time transitions from more than 24 hours to 24 hours or less (CRITICAL threshold), THE Notification_Service SHALL send a browser notification containing the task title, the remaining time, and the deadline
3. WHEN a task's remaining time transitions from more than 1 hour to 1 hour or less, THE Notification_Service SHALL send a final urgent browser notification containing the task title and the exact deadline time
4. THE Notification_Scheduler SHALL check all active task deadlines at a configurable polling interval (default 5 minutes) to detect threshold crossings
5. THE Notification_Service SHALL NOT send duplicate notifications for the same task and the same threshold crossing within a single browser session
6. IF the User has denied browser notification permission, THEN THE Notification_Service SHALL display deadline warnings as in-app toast messages instead of browser notifications

### Requirement 5: 매일 아침 일정 요약 알림

**User Story:** As a user, I want to receive a daily morning summary of today's schedule, so that I can start each day knowing what is planned.

#### Acceptance Criteria

1. THE Notification_Scheduler SHALL trigger a daily summary notification at a configurable morning time (default 08:00 in the configured time zone)
2. WHEN the daily summary is triggered, THE Notification_Service SHALL send a browser notification containing the total number of tasks scheduled for today, the total scheduled hours, and the titles of the top 3 highest-priority tasks
3. IF the scheduler page is not open at the configured summary time, THEN THE Notification_Service SHALL display the daily summary as an in-app banner when the User next opens the scheduler page
4. THE Notification_Service SHALL fetch today's allocations from the backend API to compute the daily summary content
5. THE Notification_Scheduler SHALL use a Service Worker or a setInterval-based timer to trigger the daily summary check, depending on browser support

### Requirement 6: 주간/월간 시간 사용 분석

**User Story:** As a user, I want to see how I spent my time over the past week and month broken down by category, so that I can identify patterns and optimize my schedule.

#### Acceptance Criteria

1. WHEN a User requests a weekly time report, THE Analytics_Service SHALL aggregate all completed task session durations from the past 7 days, grouped by task category, and return the total minutes spent per category
2. WHEN a User requests a monthly time report, THE Analytics_Service SHALL aggregate all completed task session durations from the past 30 days, grouped by task category, and return the total minutes spent per category
3. THE Analytics_Service SHALL compute the completion rate for each category as the total completed minutes divided by the total estimated minutes of tasks in that category during the period
4. THE Analytics_Service SHALL compute the daily average productive time as the total completed session minutes divided by the number of days in the reporting period
5. THE Analytics_Controller SHALL expose GET endpoints for weekly and monthly reports at `/api/v1/analytics/weekly` and `/api/v1/analytics/monthly`
6. THE Scheduler_Frontend SHALL display the time report as a bar chart showing hours per category and a summary card showing total productive hours, daily average, and overall completion rate

### Requirement 7: 카테고리별 투자 시간 리포트

**User Story:** As a user, I want to see a detailed breakdown of time invested in each task category with trend comparison, so that I can understand where my effort is going and whether I am improving.

#### Acceptance Criteria

1. WHEN a User requests a category detail report, THE Analytics_Service SHALL return for each category: total minutes invested, number of tasks completed, number of tasks overdue, and average task completion time
2. THE Analytics_Service SHALL compute a week-over-week trend for each category as the difference in total minutes between the current week and the previous week, expressed as a percentage change
3. THE Scheduler_Frontend SHALL display category trends with directional indicators (increase or decrease arrows) and percentage values next to each category's time total
4. THE Analytics_Service SHALL include a breakdown of time by day of the week within each category so that the User can identify which days are most productive for which type of work
5. THE Analytics_Controller SHALL expose the category detail report at GET `/api/v1/analytics/categories` with an optional query parameter for the reporting period (7 or 30 days)

### Requirement 8: LLM 기반 AI 프롬프트 생성 (Gemma 4 연동)

**User Story:** As a user, I want the AI recommendation system to generate higher-quality, context-aware prompts using a real language model instead of rule-based templates, so that the AI suggestions are more useful and tailored to my specific tasks.

#### Acceptance Criteria

1. THE LLM_Recommender SHALL call the Google AI Studio free API endpoint with the Gemma 4 model to generate task-specific AI prompts when AI assistance is recommended for a task
2. WHEN generating an LLM-based prompt, THE LLM_Recommender SHALL construct a system message containing the task title, description, category, deadline, remaining effort, and the intended deliverable type, and request a structured prompt suitable for an AI assistant
3. THE LLM_Recommender SHALL enforce a maximum response token limit of 500 tokens per prompt generation request to stay within free tier usage limits
4. IF the Google AI Studio API returns an error or times out (timeout of 10 seconds), THEN THE LLM_Recommender SHALL fall back to the existing rule-based template prompt generation and include a flag indicating that the fallback was used
5. THE LLM_Recommender SHALL cache generated prompts for each task (keyed by task ID and last-updated timestamp) so that repeated requests for the same unchanged task do not consume additional API quota
6. WHEN the LLM-generated prompt is returned, THE LLM_Recommender SHALL include the model name, generation timestamp, and whether the result came from cache or a live API call
7. THE Settings_Service SHALL allow the User to configure the Google AI Studio API key and to enable or disable LLM-based prompt generation (with rule-based as the default)

### Requirement 9: 반복 태스크 관리

**User Story:** As a user, I want to define tasks that repeat daily or weekly and have each occurrence managed as an independent instance with its own deadline and progress, so that I no longer need the workaround of setting a deadline 30 days in the future.

#### Acceptance Criteria

1. WHEN a User creates a recurring task, THE Recurring_Task_Service SHALL require a recurrence rule specifying the frequency (daily or weekly), the days of the week for weekly recurrence, a start date, and an end condition (end date, or number of occurrences, or no end)
2. WHEN a recurring task is created, THE Recurring_Task_Service SHALL immediately generate task instances for the next 14 days (configurable generation horizon) from the start date, each instance having an independent deadline, status, and completed minutes
3. THE Recurring_Task_Service SHALL generate each task instance with a deadline computed as the instance date plus the configured time-of-day deadline offset (e.g., daily task due at 23:59 of that day, weekly task due at end of that week day)
4. WHEN the generation horizon is reached and ungenerated future occurrences remain, THE Recurring_Task_Service SHALL generate the next batch of instances automatically when the schedule is regenerated or when a User requests the task list
5. WHEN a User modifies a single task instance (changes its deadline, importance, or estimated effort), THE Recurring_Task_Service SHALL update only that instance without affecting other instances or the recurring rule
6. WHEN a User modifies the recurring rule itself (changes frequency, days, or estimated effort), THE Recurring_Task_Service SHALL apply the change to all future unstarted instances while preserving instances that are already in progress or completed
7. WHEN a User deletes a recurring task rule, THE Recurring_Task_Service SHALL delete all future PENDING instances and preserve instances that are IN_PROGRESS or DONE
8. THE Recurring_Task_Service SHALL store the relationship between a recurring rule and its generated instances so that the Scheduler_Frontend can display them as a grouped series
9. WHEN a recurring task instance is displayed, THE Scheduler_Frontend SHALL show the recurrence indicator (repeat icon) and the instance sequence number (e.g., "3/10" or "Day 5")

### Requirement 10: 반복 태스크와 일정 엔진 통합

**User Story:** As a user, I want my recurring task instances to be automatically scheduled by the existing priority engine alongside one-off tasks, so that all my work competes fairly for available time.

#### Acceptance Criteria

1. THE Scheduling_Engine SHALL treat each recurring task instance as an independent task with its own priority score, deadline, and remaining effort when generating the schedule
2. WHEN multiple instances of the same recurring task have overlapping availability windows, THE Scheduling_Engine SHALL schedule them in chronological order of their deadlines (earliest instance first)
3. THE Priority_Engine SHALL compute the priority score for each recurring task instance independently based on its own deadline and remaining effort, using the same formula as one-off tasks
4. IF a recurring task instance's deadline passes without completion, THEN THE Recurring_Task_Service SHALL mark that instance as OVERDUE independently without affecting subsequent instances

### Requirement 11: 에러 처리 및 엣지 케이스 (업그레이드 관련)

**User Story:** As a user, I want the upgraded features to handle errors gracefully, so that a failure in one area (like AI API timeout or notification permission denial) does not break the core scheduling functionality.

#### Acceptance Criteria

1. IF the Google AI Studio API key is not configured or is invalid, THEN THE LLM_Recommender SHALL use the rule-based prompt generation as default and log the configuration issue without returning an error to the User
2. IF the browser does not support the Notifications API, THEN THE Notification_Service SHALL use only in-app toast messages for all notification types
3. IF the Analytics_Service receives a request for a period with no completed task sessions, THEN THE Analytics_Service SHALL return a valid report with zero values for all metrics rather than an error
4. IF drag-and-drop results in a server error when persisting the allocation change, THEN THE DragDrop_Controller SHALL revert the block to its original position and display an error toast
5. IF the Recurring_Task_Service encounters a recurring rule with an end date in the past, THEN THE Recurring_Task_Service SHALL not generate any new instances and mark the rule as expired
6. WHEN the Scheduler_Frontend fails to fetch data from the backend, THE Scheduler_Frontend SHALL display a user-friendly error message with a retry button rather than showing an empty or broken interface

### Requirement 12: 자연어 태스크 생성 (AI 파싱)

**User Story:** As a user, I want to type a natural language description like "매일 1시간씩 논문 읽기" and have the system automatically create the appropriate task with all fields filled in and schedule it, so that I can add tasks effortlessly without filling out forms manually.

#### Acceptance Criteria

1. THE Scheduler_Frontend SHALL provide a natural language input field (chat-style text box) at the top of the task management tab with a placeholder like "예: 매일 1시간씩 논문 읽기, 금요일까지 보고서 작성 3시간"
2. WHEN a User submits a natural language text, THE NLP_Task_Parser SHALL send the text to the Google AI Studio Gemma 4 API with a structured prompt instructing the model to extract: title, category, importance (1-5), estimated duration (minutes), deadline (if specified), recurrence rule (if specified: frequency, days), and earliest start (if specified)
3. THE NLP_Task_Parser SHALL return the extracted fields as a structured JSON object following a predefined schema, with reasonable defaults for fields not explicitly mentioned (importance: 3, category: inferred from keywords or OTHER)
4. WHEN the LLM returns the parsed task structure, THE Scheduler_Frontend SHALL display a confirmation card showing the extracted fields to the User before creating the task, allowing the User to edit any field or confirm with a single click
5. WHEN the User confirms the parsed task, THE NLP_Task_Parser SHALL automatically create the task via the existing Task API (POST /api/v1/tasks) and, if a recurrence rule was extracted, also create the recurring rule via the Recurring_Task_Service
6. IF the natural language input implies a recurring pattern (keywords like "매일", "매주", "주 3회", "월수금", "every day", "weekly"), THEN THE NLP_Task_Parser SHALL extract the recurrence rule and create a recurring task instead of a one-off task
7. IF the Google AI Studio API fails or times out, THEN THE NLP_Task_Parser SHALL display the standard task creation form pre-filled with any fields it could extract from keyword matching (title from the full text, duration from numeric patterns)
8. THE NLP_Task_Parser SHALL support Korean natural language input as the primary language, recognizing Korean time expressions (예: "1시간", "30분", "2시간반"), date expressions (예: "내일", "다음주 금요일", "이번 달 말"), and recurrence patterns (예: "매일", "매주 월수금", "주말마다")
9. WHEN the NLP_Task_Parser successfully creates a task, THE Scheduler_Frontend SHALL automatically trigger schedule regeneration to immediately place the new task in the timeline

### Requirement 13: 에러 처리 — 자연어 파싱 관련

**User Story:** As a user, I want the natural language parsing to handle ambiguous or incomplete inputs gracefully, so that I can always create a task even if my description is vague.

#### Acceptance Criteria

1. IF the LLM cannot determine a clear task structure from the input, THEN THE NLP_Task_Parser SHALL ask a follow-up clarification question to the User (예: "예상 소요시간이 얼마인가요?") before creating the task
2. IF the natural language input contains multiple tasks (예: "논문 읽기 1시간, 코딩 2시간"), THEN THE NLP_Task_Parser SHALL parse each task separately and display multiple confirmation cards for the User to review
3. THE NLP_Task_Parser SHALL validate the extracted fields against the existing task creation constraints (importance 1-5, estimatedMinutes > 0, valid category) before displaying the confirmation card
4. IF the extracted deadline is in the past, THEN THE NLP_Task_Parser SHALL warn the User and suggest changing it to the next occurrence of the specified time

### Requirement 14: 태스크 입력 간소화

**User Story:** As a user, I want to add tasks quickly with minimal input (just title and estimated time), so that I am not burdened by filling out many fields every time I need to register work.

#### Acceptance Criteria

1. WHEN a User creates a task via the standard form, THE Scheduler_Frontend SHALL require only the title and estimated minutes as mandatory fields, with all other fields (category, importance, deadline, earliest start) having smart defaults
2. THE Scheduler_Frontend SHALL apply the following smart defaults for omitted fields: category = OTHER, importance = 3, deadline = end of today's work hours (workEndTime from settings), earliest start = now
3. THE Scheduler_Frontend SHALL provide a "간단 입력" (quick input) mode that shows only the title and estimated minutes fields, with an "상세 보기" toggle to reveal all optional fields
4. WHEN a task is created without an explicit deadline, THE Scheduler_Frontend SHALL set the deadline to the current day's configured work end time, so that the task is prioritized to complete within today's work hours
5. THE Scheduler_Frontend SHALL remember the User's last-used category and pre-fill it for the next task creation to reduce repetitive selection

### Requirement 15: 근무 시간 경계 및 야근 최소화

**User Story:** As a user, I want to define my work start and end times so that the scheduler places all non-fixed tasks within my work hours, ensuring I have free time after work and minimizing overtime.

#### Acceptance Criteria

1. THE Settings_Service SHALL allow the User to configure work start time (default 09:00, stored as workStartMinute) and work end time (default 18:00, stored as workEndMinute) in addition to existing sleep/meal/exercise blocks
2. WHEN the Scheduling_Engine generates a schedule, THE Scheduling_Engine SHALL treat the time outside of [workStartTime, workEndTime] on weekdays as a protected personal time zone, and SHALL NOT place any non-fixed work task (DOCUMENT, ASSIGNMENT, CLASS_PREP, EXAM, OTHER) in that protected zone
3. THE Scheduling_Engine SHALL allow PERSONAL_RESEARCH and STUDY category tasks to optionally be scheduled outside work hours (configurable per category via settings: "근무 외 허용" toggle per category)
4. IF the total remaining effort of work tasks for a day exceeds the available work hours (workEndTime minus workStartTime minus fixed blocks within work hours), THEN THE Scheduling_Engine SHALL report those tasks as at-risk with reason "WORK_HOURS_EXCEEDED" and suggestion "마감을 연장하거나 업무를 줄이세요"
5. THE Scheduler_Frontend SHALL display the work time boundary on the timeline and calendar views as a visual indicator (subtle background color difference between work hours and personal time)
6. WHEN all work tasks fit within work hours, THE Scheduling_Engine SHALL leave the time after workEndTime completely free (no task allocations), ensuring guaranteed personal/rest time
7. THE Settings_Service SHALL allow the User to configure different work hours for different days of the week (e.g., weekdays 09:00-18:00, weekends no work) via a per-day override

