-- SmartScheduler Tables Migration
-- Generated for PostgreSQL

CREATE TABLE IF NOT EXISTS task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL,
  importance SMALLINT NOT NULL CHECK (importance BETWEEN 1 AND 5),
  deadline TIMESTAMPTZ NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL CHECK ("estimatedMinutes" > 0),
  "completedMinutes" INTEGER NOT NULL DEFAULT 0,
  "earliestStart" TIMESTAMPTZ,
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_deadline ON task (deadline);
CREATE INDEX IF NOT EXISTS idx_task_status ON task (status);

CREATE TABLE IF NOT EXISTS fixed_block (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL,
  title VARCHAR(255) NOT NULL,
  "startMinute" SMALLINT NOT NULL CHECK ("startMinute" BETWEEN 0 AND 1439),
  "endMinute" SMALLINT NOT NULL CHECK ("endMinute" BETWEEN 0 AND 1440),
  "daysOfWeek" SMALLINT,
  "specificDate" DATE,
  "isRecurring" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_allocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "generationId" UUID NOT NULL,
  kind VARCHAR(16) NOT NULL,
  "taskId" UUID REFERENCES task(id) ON DELETE CASCADE,
  "fixedBlockId" UUID REFERENCES fixed_block(id) ON DELETE SET NULL,
  "startAt" TIMESTAMPTZ NOT NULL,
  "endAt" TIMESTAMPTZ NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alloc_generation ON schedule_allocation ("generationId");
CREATE INDEX IF NOT EXISTS idx_alloc_start ON schedule_allocation ("startAt");

CREATE TABLE IF NOT EXISTS scheduler_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone VARCHAR(40) NOT NULL DEFAULT 'Asia/Seoul',
  "researchQuotaMin" INTEGER NOT NULL DEFAULT 180,
  "bufferMin" INTEGER NOT NULL DEFAULT 10,
  "windDownMin" INTEGER NOT NULL DEFAULT 30,
  "minChunkMin" INTEGER NOT NULL DEFAULT 25,
  "maxFocusMin" INTEGER NOT NULL DEFAULT 120,
  "urgencyWeight" NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  "importanceWeight" NUMERIC(3,2) NOT NULL DEFAULT 0.40,
  "aiThreshold" NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
