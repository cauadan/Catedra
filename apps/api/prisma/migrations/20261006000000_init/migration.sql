-- ==============================================================================
-- Migração Inicial: Criação dos 10 Enums e 11 Tabelas do Sistema
-- Baseado integralmente na Seção 6 de 01-contexto-do-projeto.md
-- ==============================================================================

-- CreateEnum
CREATE TYPE "PlannedSessionStatus" AS ENUM ('PLANNED', 'DONE', 'SKIPPED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('REVIEW', 'NEW_CONTENT', 'PRACTICE');

-- CreateEnum
CREATE TYPE "StudySessionStatus" AS ENUM ('IN_PROGRESS', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionEventType" AS ENUM ('BLOCK_START', 'PAUSE', 'RESUME', 'DISTRACTION_START', 'DISTRACTION_END', 'DISTRACTION_DECLARED', 'BLOCK_FINISH', 'SESSION_FINISH', 'SESSION_CANCEL');

-- CreateEnum
CREATE TYPE "UnderstandingLevel" AS ENUM ('NONE', 'PARTIAL', 'GOOD', 'MASTERED');

-- CreateEnum
CREATE TYPE "FocusLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('EASY', 'NORMAL', 'HARD');

-- CreateEnum
CREATE TYPE "GoalKind" AS ENUM ('EFFORT', 'RESULT');

-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('EFFECTIVE_MINUTES', 'QUESTIONS', 'TOPICS_COMPLETED', 'REVIEWS', 'ACCURACY');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateTable users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "week_starts_on" TEXT NOT NULL DEFAULT 'MONDAY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable subjects
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable topics
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable planned_sessions
CREATE TABLE "planned_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "planned_minutes" INTEGER NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "activity_type" TEXT,
    "notes" TEXT,
    "status" "PlannedSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "rescheduled_from_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable planned_blocks
CREATE TABLE "planned_blocks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "planned_session_id" TEXT NOT NULL,
    "kind" "BlockKind" NOT NULL,
    "planned_minutes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable study_sessions
CREATE TABLE "study_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "planned_session_id" TEXT,
    "topic_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "status" "StudySessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable session_blocks
CREATE TABLE "session_blocks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "study_session_id" TEXT NOT NULL,
    "kind" "BlockKind" NOT NULL,
    "planned_minutes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable session_events
CREATE TABLE "session_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "study_session_id" TEXT NOT NULL,
    "block_id" TEXT,
    "type" "SessionEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declared_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable practice_records
CREATE TABLE "practice_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "study_session_id" TEXT NOT NULL,
    "block_id" TEXT,
    "topic_id" TEXT NOT NULL,
    "questions" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable session_evaluations
CREATE TABLE "session_evaluations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "study_session_id" TEXT NOT NULL,
    "understanding" "UnderstandingLevel" NOT NULL,
    "focus" "FocusLevel" NOT NULL,
    "difficulty" "DifficultyLevel" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable goals
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "GoalKind" NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "period_start_local_date" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "subject_id" TEXT,
    "topic_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "subjects_user_id_idx" ON "subjects"("user_id");

-- CreateIndex
CREATE INDEX "topics_user_id_idx" ON "topics"("user_id");
CREATE INDEX "topics_subject_id_idx" ON "topics"("subject_id");
CREATE INDEX "topics_parent_id_idx" ON "topics"("parent_id");

-- CreateIndex
CREATE INDEX "planned_sessions_user_id_idx" ON "planned_sessions"("user_id");
CREATE INDEX "planned_sessions_subject_id_idx" ON "planned_sessions"("subject_id");
CREATE INDEX "planned_sessions_topic_id_idx" ON "planned_sessions"("topic_id");
CREATE INDEX "planned_sessions_scheduled_start_idx" ON "planned_sessions"("scheduled_start");

-- CreateIndex
CREATE INDEX "planned_blocks_user_id_idx" ON "planned_blocks"("user_id");
CREATE INDEX "planned_blocks_planned_session_id_idx" ON "planned_blocks"("planned_session_id");

-- CreateIndex
CREATE INDEX "study_sessions_user_id_idx" ON "study_sessions"("user_id");
CREATE INDEX "study_sessions_topic_id_idx" ON "study_sessions"("topic_id");
CREATE INDEX "study_sessions_planned_session_id_idx" ON "study_sessions"("planned_session_id");
CREATE INDEX "study_sessions_started_at_idx" ON "study_sessions"("started_at");

-- CreateIndex
CREATE INDEX "session_blocks_user_id_idx" ON "session_blocks"("user_id");
CREATE INDEX "session_blocks_study_session_id_idx" ON "session_blocks"("study_session_id");

-- CreateIndex
CREATE INDEX "session_events_user_id_idx" ON "session_events"("user_id");
CREATE INDEX "session_events_study_session_id_idx" ON "session_events"("study_session_id");
CREATE INDEX "session_events_block_id_idx" ON "session_events"("block_id");
CREATE INDEX "session_events_occurred_at_idx" ON "session_events"("occurred_at");

-- CreateIndex
CREATE INDEX "practice_records_user_id_idx" ON "practice_records"("user_id");
CREATE INDEX "practice_records_study_session_id_idx" ON "practice_records"("study_session_id");
CREATE INDEX "practice_records_topic_id_idx" ON "practice_records"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_evaluations_study_session_id_key" ON "session_evaluations"("study_session_id");
CREATE INDEX "session_evaluations_user_id_idx" ON "session_evaluations"("user_id");

-- CreateIndex
CREATE INDEX "goals_user_id_idx" ON "goals"("user_id");
CREATE INDEX "goals_subject_id_idx" ON "goals"("subject_id");
CREATE INDEX "goals_topic_id_idx" ON "goals"("topic_id");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "planned_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_blocks" ADD CONSTRAINT "planned_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_blocks" ADD CONSTRAINT "planned_blocks_planned_session_id_fkey" FOREIGN KEY ("planned_session_id") REFERENCES "planned_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_planned_session_id_fkey" FOREIGN KEY ("planned_session_id") REFERENCES "planned_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_blocks" ADD CONSTRAINT "session_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_blocks" ADD CONSTRAINT "session_blocks_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "session_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_records" ADD CONSTRAINT "practice_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_records" ADD CONSTRAINT "practice_records_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_records" ADD CONSTRAINT "practice_records_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "session_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "practice_records" ADD CONSTRAINT "practice_records_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_evaluations" ADD CONSTRAINT "session_evaluations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_evaluations" ADD CONSTRAINT "session_evaluations_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
