# Requirements Document

## Introduction

SmartScheduler는 PhotoLite(사진 최적화 서비스)에 추가되는 **업무 우선순위 자동 관리** 기능이다. 대학원 생활에서 필수적인 시간(취침, 식사, 운동, 핵심 연구 시간)을 먼저 베이스로 깔아 보호하고, 그 위에 마감 기한이 있는 유동 업무(서류 처리, 개인 연구, 과제, 공부, 시험 준비 등)를 **마감 임박도(urgency)와 중요도(importance)** 를 기준으로 자동 분할·배치하여 현실적인 일정을 만들어 준다. 또한 현재 시간을 기준으로 각 업무의 남은 기한을 보여주고, 업무 성격에 맞는 AI 에이전트 프롬프트를 추천하여 AI로 효율화할 수 있는 업무를 식별해 준다.

본 기능은 기존 백엔드(NestJS + TypeORM + PostgreSQL)에 새로운 `scheduler` 모듈로 추가되며, 프론트엔드(Next.js + shadcn/ui)에는 "업무 일정 관리" 페이지가 추가된다. PhotoLite와 동일하게 단일 사용자(single-tenant) 전제이며 인증은 범위 밖이다.

**기술 스택:**
- 프론트엔드: Next.js + shadcn/ui (frontend/) — `/schedule` 페이지 추가
- 백엔드: NestJS + pnpm (backend/) — `modules/scheduler/` 추가
- 데이터베이스: PostgreSQL (기존 인스턴스 재사용, 신규 테이블 추가)
- 시간 처리: 서버 시스템 클럭 + IANA 타임존(기본 `Asia/Seoul`)
- 배포: 기존 EC2(m.large) + Docker Compose + nginx 재사용

## Glossary

- **Task_Service**: 마감 기한과 중요도를 가진 유동 업무(태스크)를 생성·수정·조회·삭제하는 백엔드 서비스 모듈
- **FixedBlock_Service**: 취침·식사·운동·수업 등 시간이 고정된 필수 블록을 관리하는 서비스 모듈
- **Priority_Engine**: 마감 임박도와 중요도를 결합하여 각 태스크의 우선순위 점수를 산정하는 순수 계산 엔진
- **Scheduling_Engine**: 고정 블록을 먼저 배치하고 남은 자유 시간에 태스크를 우선순위 기반으로 분할·배치하는 순수 계산 엔진
- **Time_Service**: 현재 시간을 제공하고 각 태스크의 남은 기한을 계산·분류하는 서비스 모듈
- **AI_Recommender**: 태스크의 AI 적합도를 평가하고 적합한 태스크에 대해 즉시 사용 가능한 AI 에이전트 프롬프트를 생성하는 서비스 모듈
- **Settings_Service**: 연구 쿼터, 버퍼, 우선순위 가중치 등 스케줄링 파라미터를 관리하는 서비스 모듈
- **Schedule_Service**: 일정 생성을 오케스트레이션하고 배치 결과(타임 블록)와 잠금을 영속화·조회하는 서비스 모듈
- **Fixed_Block**: 시간이 고정되어 자동 스케줄러가 침범할 수 없는 필수 시간 블록 (취침/식사/운동/수업/사용자정의)
- **Task**: 시작 시각이 고정되지 않고 마감 기한·중요도·예상 소요시간을 갖는 유동 업무. 스케줄러가 배치 시각을 결정한다
- **Importance**: 업무의 중요도 (정수 1~5, 5가 가장 중요)
- **Urgency**: 마감 임박도. effort density(= 남은 노력 ÷ 마감까지 남은 시간)로 정의되며 0~2로 클램프됨
- **Priority_Score**: urgency와 importance를 가중 합산한 우선순위 점수 (높을수록 먼저 처리)
- **Effort_Density**: 남은 예상 소요시간을 마감까지 남은 시간으로 나눈 값. 1을 넘으면 현 시점에 마감 내 완료가 불가능함을 의미
- **Protected_Research_Quota**: 매일 다른 업무보다 먼저 확보되는 최소 연구 시간 (분 단위, 설정 가능)
- **Focus_Session**: 태스크를 분할 배치할 때의 한 작업 세션. 최소 청크 길이와 최대 포커스 길이 사이로 제한됨
- **Allocation (Time_Block)**: 특정 고정 블록 또는 태스크 세션이 타임라인의 구체적 시간 구간에 배치된 결과
- **Horizon**: 일정을 생성하는 계획 구간 (현재 시각부터 지정된 종료 시각까지)

## Requirements

### Requirement 1: 고정 시간 블록 관리

**User Story:** As a graduate student, I want to define mandatory recurring time blocks for sleep, meals, exercise, and classes, so that my essential daily routine is always protected before any work is scheduled.

#### Acceptance Criteria

1. WHEN a User creates a fixed block, THE FixedBlock_Service SHALL require a type (one of SLEEP, MEAL, EXERCISE, CLASS, CUSTOM), a title, a start time, an end time, and a recurrence specification (a set of weekdays for recurring blocks or a single calendar date for one-off blocks)
2. WHEN a User creates a fixed block whose end time is less than or equal to its start time, THE FixedBlock_Service SHALL interpret the block as spanning past midnight into the following day (e.g., a 23:00–07:00 sleep block)
3. IF a User creates or updates a fixed block that overlaps in time with an existing fixed block on any shared day, THEN THE FixedBlock_Service SHALL reject the request and return an error identifying the conflicting block
4. WHEN the scheduler is initialized for the first time, THE FixedBlock_Service SHALL seed default fixed blocks for sleep, three meals, and exercise, each of which the User MAY subsequently edit or delete
5. THE FixedBlock_Service SHALL treat every fixed block as inviolable, such that no automatically scheduled task may be placed within the time span of any fixed block
6. WHEN a User deletes a fixed block, THE FixedBlock_Service SHALL remove it from all future schedule generations without altering any task allocation that the User has already locked

### Requirement 2: 유동 업무(태스크) 관리

**User Story:** As a graduate student, I want to register flexible tasks (document work, assignments, personal research, study, exam prep) with a deadline and an importance level, so that the system can decide when each task should be done.

#### Acceptance Criteria

1. WHEN a User creates a task, THE Task_Service SHALL require a title, a category (one of DOCUMENT, ASSIGNMENT, PERSONAL_RESEARCH, STUDY, CLASS_PREP, EXAM, OTHER), an importance level (integer 1 through 5), a deadline, and an estimated effort in minutes greater than zero
2. IF a User creates a task with an importance level outside the range 1 to 5, an estimated effort less than or equal to zero, or a malformed deadline, THEN THE Task_Service SHALL reject the request and return a validation error describing the invalid field
3. WHEN a User creates a task with a deadline earlier than the current time, THE Task_Service SHALL still accept the task and mark it as overdue
4. WHEN a User records completed minutes for a task, THE Task_Service SHALL store the completed effort and compute the remaining effort as the estimated effort minus the completed effort, clamped to a minimum of zero
5. WHEN a User marks a task as done, THE Task_Service SHALL exclude the task from all subsequent schedule generations
6. WHERE a task specifies an earliest start time, THE Scheduling_Engine SHALL NOT place any session for that task before the earliest start time

### Requirement 3: 자동 우선순위 산정

**User Story:** As a graduate student, I want each task to receive an automatic priority based on how close its deadline is and how important it is, so that I can trust the system to surface what matters most right now.

#### Acceptance Criteria

1. WHEN priority is computed for a task at the current time, THE Priority_Engine SHALL calculate the remaining time until the deadline and the effort density, defined as the remaining effort divided by the remaining time until the deadline
2. THE Priority_Engine SHALL compute the priority score as (urgency weight × urgency) + (importance weight × normalized importance), where urgency is the effort density clamped to the range 0 to 2, normalized importance is the importance divided by 5, and the weights default to 0.6 and 0.4 respectively and are configurable through the Settings_Service
3. IF a task's deadline is at or before the current time, THEN THE Priority_Engine SHALL assign the maximum urgency value and flag the task as overdue
4. THE Priority_Engine SHALL be deterministic, producing identical priority scores for identical task inputs evaluated at the same current time
5. WHEN returning a task's priority, THE Priority_Engine SHALL include a breakdown containing the urgency, the effort density, the normalized importance, the remaining effort in minutes, and the remaining minutes until the deadline, so that the ranking is explainable
6. WHEN two tasks have equal priority scores, THE Priority_Engine SHALL order the task with the earlier deadline first, then the task with the higher importance, then the task created earlier

### Requirement 4: 자동 일정 분할 및 배치

**User Story:** As a graduate student, I want my flexible tasks to be automatically split and placed into the free time between my fixed blocks according to their priority and deadlines, so that I have a concrete, realistic plan without manual juggling.

#### Acceptance Criteria

1. WHEN a schedule is generated for a horizon, THE Scheduling_Engine SHALL first materialize every fixed block occurring within the horizon onto the timeline, then derive the free time intervals as the awake time that remains after removing fixed blocks, transition buffers, and the wind-down window before sleep
2. THE Scheduling_Engine SHALL exclude all time earlier than the current time from the free intervals, so that no task session is scheduled in the past
3. WHEN allocating flexible tasks, THE Scheduling_Engine SHALL fill free intervals in chronological order by repeatedly assigning the highest-priority eligible task to the next available slot, where a task is eligible only if its earliest start has passed and its deadline is later than the slot start
4. WHEN a task's remaining effort exceeds a single focus session, THE Scheduling_Engine SHALL split the task across multiple sessions, where each session is no longer than the configured maximum focus session length and no shorter than the configured minimum chunk length, except for a final remainder smaller than the minimum chunk, and each session SHALL end no later than the task's deadline
5. IF a task's remaining effort cannot be fully placed before its deadline within the horizon, THEN THE Scheduling_Engine SHALL place as much of it as possible and report the unplaced remainder as an at-risk task together with the reason (deadline before available capacity, or horizon capacity exhausted)
6. THE Scheduling_Engine SHALL preserve total effort, such that for every task the sum of its scheduled session durations plus any reported unplaced remainder equals its remaining effort
7. THE Scheduling_Engine SHALL produce no overlapping allocations, such that no two scheduled blocks (fixed or task) share any instant of time after buffers are applied
8. THE Scheduling_Engine SHALL be deterministic and idempotent, producing the same plan for the same set of tasks, fixed blocks, settings, locks, and current time

### Requirement 5: 필수 생활 및 연구 시간 확보

**User Story:** As a graduate student, I want a guaranteed daily amount of research time in addition to protected sleep, meals, and exercise, so that my core academic work and wellbeing are never crowded out by administrative or urgent tasks.

#### Acceptance Criteria

1. THE Scheduling_Engine SHALL reserve, on each day of the horizon that has at least the configured daily research quota of awake free time, at least that many minutes for research before allocating any non-research task
2. WHEN reserved research time exists on a day, THE Scheduling_Engine SHALL fill it preferentially with PERSONAL_RESEARCH tasks in priority order, and SHALL retain any unused reserved time as a generic protected research block rather than reassigning it to other categories
3. THE Scheduling_Engine SHALL never place any task within a sleep, meal, or exercise fixed block, so that those living-essential periods remain fully protected
4. WHERE the configured daily research quota exceeds the awake free time available on a given day, THE Scheduling_Engine SHALL reserve all remaining free time on that day for research and report the shortfall
5. THE Settings_Service SHALL allow the User to configure the daily research quota, the transition buffer, the wind-down window, the minimum chunk length, the maximum focus session length, and the priority weights

### Requirement 6: 현재 시간 및 남은 기한 표시

**User Story:** As a graduate student, I want to see the current time and exactly how much time remains until each task's deadline, so that I always know what is becoming urgent.

#### Acceptance Criteria

1. WHEN a User requests the current time, THE Time_Service SHALL return the server's current time expressed in the configured time zone
2. WHEN task information is returned, THE Time_Service SHALL compute, for each task, the remaining time until its deadline as the deadline minus the current time
3. THE Time_Service SHALL classify each task's remaining time as OVERDUE when the current time is at or after the deadline, CRITICAL when at most 24 hours remain, WARNING when more than 24 and at most 72 hours remain, and NORMAL otherwise
4. WHEN remaining time is displayed, THE Time_Service SHALL format it as days, hours, and minutes
5. WHEN a schedule is generated, THE Scheduling_Engine SHALL use the current time as the start of the planning horizon, so that the plan reflects only time that is still available

### Requirement 7: AI 에이전트 프롬프트 추천

**User Story:** As a graduate student, I want the system to tell me which tasks would benefit from an AI agent and to give me a ready-to-use prompt for those tasks, so that I can offload suitable work to AI and save time.

#### Acceptance Criteria

1. WHEN AI suitability is computed for a task, THE AI_Recommender SHALL derive a suitability score between 0 and 1 from the task's category and from keywords found in its title and description
2. THE AI_Recommender SHALL recommend AI assistance for a task IF AND ONLY IF its suitability score is greater than or equal to the configured suitability threshold
3. WHEN AI assistance is recommended for a task, THE AI_Recommender SHALL generate a ready-to-use prompt selected by the task's category and interpolated with the task's title, description, deadline, and intended deliverable, and the generated prompt SHALL contain the task's title
4. WHEN AI assistance is recommended, THE AI_Recommender SHALL also return a short rationale and the suggested type of AI use (for example, document drafting, literature summarization, or code assistance)
5. IF a task is not suitable for AI assistance, THEN THE AI_Recommender SHALL indicate that no AI prompt is recommended and SHALL provide the reason
6. THE AI_Recommender SHALL be deterministic, producing the same suitability score and the same prompt for the same task input

### Requirement 8: 일정 조정 및 잠금

**User Story:** As a graduate student, I want to pin specific task sessions to fixed times and have the system schedule everything else around them, so that I keep control over commitments the automation should not move.

#### Acceptance Criteria

1. WHEN a User locks a task allocation, THE Schedule_Service SHALL persist the locked time window and treat it as immovable on all subsequent regenerations
2. WHEN a schedule is regenerated, THE Scheduling_Engine SHALL preserve every locked allocation exactly and schedule all other tasks around the locked windows without overlap
3. WHEN a User unlocks an allocation, THE Schedule_Service SHALL allow the corresponding task effort to be rescheduled on the next generation
4. WHEN a User requests the schedule for a date range, THE Schedule_Service SHALL return all allocations within that range sorted by start time, together with the list of at-risk tasks

### Requirement 9: 에러 처리 및 엣지 케이스

**User Story:** As a graduate student, I want the scheduler to behave predictably when there are no tasks, when the day is overbooked, or when something fails, so that I always receive clear and trustworthy results.

#### Acceptance Criteria

1. IF no schedulable tasks exist, THEN THE Scheduling_Engine SHALL return a plan containing only fixed-block and reserved-research allocations and an empty at-risk list
2. IF the total remaining effort of all tasks exceeds the total free capacity within the horizon, THEN THE Scheduling_Engine SHALL schedule the highest-priority tasks that fit and report each unschedulable task with a reason and a suggested remedy (extend the deadline, reduce the scope, or extend the horizon)
3. IF the fixed blocks leave no awake free time on a day, THEN THE Scheduling_Engine SHALL produce no task allocations for that day and report that the day has no available capacity
4. IF the Time_Service cannot determine the current time from the configured source, THEN THE system SHALL fall back to the server system clock and flag that the fallback time was used
5. IF the Scheduling_Engine receives a horizon end earlier than the current time, THEN THE Scheduling_Engine SHALL reject the request and return a validation error
6. IF the database is unavailable when reading or writing tasks, fixed blocks, settings, or allocations, THEN THE corresponding service SHALL return a 503 Service Unavailable response indicating the data store is temporarily unavailable
7. WHEN the planning horizon crosses a daylight-saving-time transition in the configured time zone, THE Scheduling_Engine SHALL compute block boundaries using time-zone-aware arithmetic so that local clock times remain correct
