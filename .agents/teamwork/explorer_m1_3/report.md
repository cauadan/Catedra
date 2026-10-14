# Relatório Técnico: Especificação Completa do Prisma Schema & Migração Inicial

**Agente:** explorer_m1_3  
**Data:** 2026-10-06  
**Contexto de Referência:** `01-contexto-do-projeto.md` (Seção 6), `PROJECT.md` e `ORIGINAL_REQUEST.md`  
**Escopo:** Milestone 1 — Schema Prisma Completo (11 modelos, 10 enums), Estratégia de Migração e Script de Verificação  

---

## 1. Resumo Executivo

O objetivo desta investigação técnica é fornecer ao agente Worker os arquivos exatos, comandos e scripts para a implementação do banco de dados relacional PostgreSQL via Prisma ORM na aplicação `apps/api`. 

O schema contempla integralmente todos os **11 modelos** e **10 enums** especificados na Seção 6 do `01-contexto-do-projeto.md`, garantindo:
- Chaves primárias UUID geradas automaticamente via `@default(uuid())`.
- Timestamps UTC padronizados (`created_at DateTime @default(now())`, `updated_at DateTime @updatedAt`).
- Isolamento multi-tenant com campo `user_id` em todas as tabelas (exceto `User`), indexado via `@@index([user_id])` e com deleção em cascata (`onDelete: Cascade`) a partir do usuário.
- Auto-relacionamentos explícitos: hierarquia de árvore em `Topic` (`parent_id` / `children`) e rastreamento de reagendamento em `PlannedSession` (`rescheduled_from_id` / `rescheduled_to`).
- Relacionamento 1:1 estrito entre `StudySession` e `SessionEvaluation` via `@unique` em `study_session_id`.
- Mapeamento explícito de tabelas para snake_case plural (`@@map("users")`, `@@map("topics")`, etc.) para máxima aderência às convenções SQL do PostgreSQL.

---

## 2. Conteúdo Exato do Arquivo: `apps/api/prisma/schema.prisma`

```prisma
// ==============================================================================
// Prisma Schema - Plataforma de Gestão e Análise de Estudos
// Baseado integralmente na Seção 6 de 01-contexto-do-projeto.md
// ==============================================================================

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ------------------------------------------------------------------------------
// ENUMS (10 Enums Conforme Especificação)
// ------------------------------------------------------------------------------

enum PlannedSessionStatus {
  PLANNED
  DONE
  SKIPPED
  RESCHEDULED
}

enum BlockKind {
  REVIEW
  NEW_CONTENT
  PRACTICE
}

enum StudySessionStatus {
  IN_PROGRESS
  FINISHED
  CANCELLED
}

enum SessionEventType {
  BLOCK_START
  PAUSE
  RESUME
  DISTRACTION_START
  DISTRACTION_END
  DISTRACTION_DECLARED
  BLOCK_FINISH
  SESSION_FINISH
  SESSION_CANCEL
}

enum UnderstandingLevel {
  NONE
  PARTIAL
  GOOD
  MASTERED
}

enum FocusLevel {
  LOW
  MEDIUM
  HIGH
}

enum DifficultyLevel {
  EASY
  NORMAL
  HARD
}

enum GoalKind {
  EFFORT
  RESULT
}

enum GoalMetric {
  EFFECTIVE_MINUTES
  QUESTIONS
  TOPICS_COMPLETED
  REVIEWS
  ACCURACY
}

enum GoalPeriod {
  DAY
  WEEK
  MONTH
}

// ------------------------------------------------------------------------------
// MODELOS (11 Modelos Conforme Seção 6)
// ------------------------------------------------------------------------------

/// Modelo de Usuário: raiz de autenticação e multi-tenancy
model User {
  id             String   @id @default(uuid())
  email          String   @unique
  name           String
  password_hash  String
  timezone       String   @default("America/Sao_Paulo")
  week_starts_on String   @default("MONDAY")
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  subjects            Subject[]
  topics              Topic[]
  planned_sessions    PlannedSession[]
  planned_blocks      PlannedBlock[]
  study_sessions      StudySession[]
  session_blocks      SessionBlock[]
  session_events      SessionEvent[]
  practice_records    PracticeRecord[]
  session_evaluations SessionEvaluation[]
  goals               Goal[]

  @@map("users")
}

/// Matéria (Subject): agrupador de alto nível de assuntos de estudo
model Subject {
  id         String   @id @default(uuid())
  user_id    String
  name       String
  color      String
  archived   Boolean  @default(false)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  user             User             @relation(fields: [user_id], references: [id], onDelete: Cascade)
  topics           Topic[]
  planned_sessions PlannedSession[]
  goals            Goal[]

  @@index([user_id])
  @@map("subjects")
}

/// Assunto (Topic): hierarquia de árvore com profundidade livre via parent_id
model Topic {
  id         String   @id @default(uuid())
  user_id    String
  subject_id String
  parent_id  String?
  name       String
  archived   Boolean  @default(false)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  user             User             @relation(fields: [user_id], references: [id], onDelete: Cascade)
  subject          Subject          @relation(fields: [subject_id], references: [id], onDelete: Cascade)
  parent           Topic?           @relation("TopicHierarchy", fields: [parent_id], references: [id], onDelete: Cascade)
  children         Topic[]          @relation("TopicHierarchy")
  planned_sessions PlannedSession[]
  study_sessions   StudySession[]
  practice_records PracticeRecord[]
  goals            Goal[]

  @@index([user_id])
  @@index([subject_id])
  @@index([parent_id])
  @@map("topics")
}

/// Sessão Planejada: agendamento prévio com metas de tempo e prioridade
model PlannedSession {
  id                  String               @id @default(uuid())
  user_id             String
  subject_id          String
  topic_id            String
  scheduled_start     DateTime
  planned_minutes     Int
  priority            String               @default("MEDIUM")
  activity_type       String?
  notes               String?
  status              PlannedSessionStatus @default(PLANNED)
  rescheduled_from_id String?
  created_at          DateTime             @default(now())
  updated_at          DateTime             @updatedAt

  user             User             @relation(fields: [user_id], references: [id], onDelete: Cascade)
  subject          Subject          @relation(fields: [subject_id], references: [id], onDelete: Cascade)
  topic            Topic            @relation(fields: [topic_id], references: [id], onDelete: Restrict)
  rescheduled_from PlannedSession?  @relation("PlannedSessionReschedule", fields: [rescheduled_from_id], references: [id], onDelete: SetNull)
  rescheduled_to   PlannedSession[] @relation("PlannedSessionReschedule")
  planned_blocks   PlannedBlock[]
  study_sessions   StudySession[]

  @@index([user_id])
  @@index([subject_id])
  @@index([topic_id])
  @@index([scheduled_start])
  @@map("planned_sessions")
}

/// Bloco Planejado: divisão interna da sessão planejada (revisão, conteúdo, prática)
model PlannedBlock {
  id                 String    @id @default(uuid())
  user_id            String
  planned_session_id String
  kind               BlockKind
  planned_minutes    Int
  position           Int
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updatedAt

  user            User           @relation(fields: [user_id], references: [id], onDelete: Cascade)
  planned_session PlannedSession @relation(fields: [planned_session_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([planned_session_id])
  @@map("planned_blocks")
}

/// Sessão de Estudo Executada: execução real do timer
model StudySession {
  id                 String             @id @default(uuid())
  user_id            String
  planned_session_id String?
  topic_id           String
  started_at         DateTime           @default(now())
  ended_at           DateTime?
  status             StudySessionStatus @default(IN_PROGRESS)
  created_at         DateTime           @default(now())
  updated_at         DateTime           @updatedAt

  user             User               @relation(fields: [user_id], references: [id], onDelete: Cascade)
  planned_session  PlannedSession?    @relation(fields: [planned_session_id], references: [id], onDelete: SetNull)
  topic            Topic              @relation(fields: [topic_id], references: [id], onDelete: Restrict)
  session_blocks   SessionBlock[]
  session_events   SessionEvent[]
  practice_records PracticeRecord[]
  evaluation       SessionEvaluation?

  @@index([user_id])
  @@index([topic_id])
  @@index([planned_session_id])
  @@index([started_at])
  @@map("study_sessions")
}

/// Bloco de Sessão Executado: etapa real executada dentro da sessão
model SessionBlock {
  id               String    @id @default(uuid())
  user_id          String
  study_session_id String
  kind             BlockKind
  planned_minutes  Int
  position         Int
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

  user             User             @relation(fields: [user_id], references: [id], onDelete: Cascade)
  study_session    StudySession     @relation(fields: [study_session_id], references: [id], onDelete: Cascade)
  session_events   SessionEvent[]
  practice_records PracticeRecord[]

  @@index([user_id])
  @@index([study_session_id])
  @@map("session_blocks")
}

/// Evento do Timer: registra cada transição de estado da máquina do timer
model SessionEvent {
  id               String           @id @default(uuid())
  user_id          String
  study_session_id String
  block_id         String?
  type             SessionEventType
  occurred_at      DateTime         @default(now())
  declared_seconds Int?
  created_at       DateTime         @default(now())
  updated_at       DateTime         @updatedAt

  user          User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  study_session StudySession  @relation(fields: [study_session_id], references: [id], onDelete: Cascade)
  block         SessionBlock? @relation(fields: [block_id], references: [id], onDelete: SetNull)

  @@index([user_id])
  @@index([study_session_id])
  @@index([block_id])
  @@index([occurred_at])
  @@map("session_events")
}

/// Registro de Questões Praticadas: guarda questões totais e corretas
model PracticeRecord {
  id               String   @id @default(uuid())
  user_id          String
  study_session_id String
  block_id         String?
  topic_id         String
  questions        Int
  correct          Int
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  user          User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  study_session StudySession  @relation(fields: [study_session_id], references: [id], onDelete: Cascade)
  block         SessionBlock? @relation(fields: [block_id], references: [id], onDelete: SetNull)
  topic         Topic         @relation(fields: [topic_id], references: [id], onDelete: Restrict)

  @@index([user_id])
  @@index([study_session_id])
  @@index([topic_id])
  @@map("practice_records")
}

/// Avaliação Qualitativa da Sessão: relação 1:1 com StudySession
model SessionEvaluation {
  id               String             @id @default(uuid())
  user_id          String
  study_session_id String             @unique
  understanding    UnderstandingLevel
  focus            FocusLevel
  difficulty       DifficultyLevel
  notes            String?
  created_at       DateTime           @default(now())
  updated_at       DateTime           @updatedAt

  user          User         @relation(fields: [user_id], references: [id], onDelete: Cascade)
  study_session StudySession @relation(fields: [study_session_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@map("session_evaluations")
}

/// Metas de Estudo: esforço ou resultado por período no fuso do usuário
model Goal {
  id                      String     @id @default(uuid())
  user_id                 String
  kind                    GoalKind
  metric                  GoalMetric
  period                  GoalPeriod
  period_start_local_date String
  target_value            Float
  subject_id              String?
  topic_id                String?
  created_at              DateTime   @default(now())
  updated_at              DateTime   @updatedAt

  user    User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  subject Subject? @relation(fields: [subject_id], references: [id], onDelete: SetNull)
  topic   Topic?   @relation(fields: [topic_id], references: [id], onDelete: SetNull)

  @@index([user_id])
  @@index([subject_id])
  @@index([topic_id])
  @@map("goals")
}
```

---

## 3. Arquivo de Migração Inicial SQL: `apps/api/prisma/migrations/20261006000000_init/migration.sql`

O Worker pode gerar ou pré-gravar diretamente este arquivo SQL para execução determinística em qualquer ambiente (com `prisma migrate deploy` ou `prisma migrate dev`):

```sql
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
```

---

## 4. Script de Verificação e Seed: `apps/api/prisma/seed.ts`

Este script atua tanto como teste de validação de ponta a ponta do schema quanto como gerador de dados iniciais. Ele instancia o `PrismaClient`, cria registros em todas as 11 tabelas, exercita os 10 enums, testa auto-relacionamento e valida a integridade referencial:

```typescript
import {
  PrismaClient,
  PlannedSessionStatus,
  BlockKind,
  StudySessionStatus,
  SessionEventType,
  UnderstandingLevel,
  FocusLevel,
  DifficultyLevel,
  GoalKind,
  GoalMetric,
  GoalPeriod,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Iniciando Verificação do Schema Prisma e Relações ===');

  // Limpeza de ambiente de teste
  const testEmail = 'verificacao.m1@estudos.local';
  await prisma.user.deleteMany({ where: { email: testEmail } });

  // 1. Usuário
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: 'Estudante Teste M1',
      password_hash: '$2b$10$ephemeralHashForTestingOnly1234567890abcdefghij',
      timezone: 'America/Sao_Paulo',
      week_starts_on: 'MONDAY',
    },
  });
  console.log(`[1/11 OK] User criado: ${user.id} (${user.email})`);

  // 2. Matéria (Subject)
  const subject = await prisma.subject.create({
    data: {
      user_id: user.id,
      name: 'Matemática',
      color: '#3B82F6',
    },
  });
  console.log(`[2/11 OK] Subject criado: ${subject.id} (${subject.name})`);

  // 3. Assuntos (Topics com hierarquia de árvore / auto-relação)
  const parentTopic = await prisma.topic.create({
    data: {
      user_id: user.id,
      subject_id: subject.id,
      name: 'Álgebra',
    },
  });
  const childTopic = await prisma.topic.create({
    data: {
      user_id: user.id,
      subject_id: subject.id,
      parent_id: parentTopic.id,
      name: 'Funções Quadráticas',
    },
  });
  console.log(
    `[3/11 OK] Topics criados com hierarquia: ${parentTopic.name} -> ${childTopic.name}`
  );

  // 4. Sessão Planejada (PlannedSession com auto-relação de reagendamento)
  const plannedSession = await prisma.plannedSession.create({
    data: {
      user_id: user.id,
      subject_id: subject.id,
      topic_id: childTopic.id,
      scheduled_start: new Date(),
      planned_minutes: 60,
      priority: 'HIGH',
      activity_type: 'ESTUDO_REGULAR',
      notes: 'Sessão de testes de validação M1',
      status: PlannedSessionStatus.PLANNED,
    },
  });
  console.log(`[4/11 OK] PlannedSession criada: ${plannedSession.id}`);

  // 5. Blocos Planejados (PlannedBlocks)
  const plannedBlock1 = await prisma.plannedBlock.create({
    data: {
      user_id: user.id,
      planned_session_id: plannedSession.id,
      kind: BlockKind.REVIEW,
      planned_minutes: 15,
      position: 1,
    },
  });
  const plannedBlock2 = await prisma.plannedBlock.create({
    data: {
      user_id: user.id,
      planned_session_id: plannedSession.id,
      kind: BlockKind.PRACTICE,
      planned_minutes: 45,
      position: 2,
    },
  });
  console.log(
    `[5/11 OK] PlannedBlocks criados: ${plannedBlock1.id}, ${plannedBlock2.id}`
  );

  // 6. Sessão de Estudo Executada (StudySession vinculada à PlannedSession)
  const studySession = await prisma.studySession.create({
    data: {
      user_id: user.id,
      planned_session_id: plannedSession.id,
      topic_id: childTopic.id,
      status: StudySessionStatus.FINISHED,
      started_at: new Date(Date.now() - 3600000),
      ended_at: new Date(),
    },
  });
  console.log(`[6/11 OK] StudySession criada: ${studySession.id}`);

  // 7. Bloco Executado (SessionBlock)
  const sessionBlock = await prisma.sessionBlock.create({
    data: {
      user_id: user.id,
      study_session_id: studySession.id,
      kind: BlockKind.PRACTICE,
      planned_minutes: 45,
      position: 1,
    },
  });
  console.log(`[7/11 OK] SessionBlock criado: ${sessionBlock.id}`);

  // 8. Eventos da Sessão (SessionEvent com declared_seconds)
  await prisma.sessionEvent.createMany({
    data: [
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.BLOCK_START,
        occurred_at: new Date(Date.now() - 3500000),
      },
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.PAUSE,
        occurred_at: new Date(Date.now() - 2500000),
      },
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.RESUME,
        occurred_at: new Date(Date.now() - 2400000),
      },
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.DISTRACTION_DECLARED,
        occurred_at: new Date(Date.now() - 60000),
        declared_seconds: 180,
      },
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.SESSION_FINISH,
        occurred_at: new Date(),
      },
    ],
  });
  console.log(`[8/11 OK] SessionEvents gravados.`);

  // 9. Registro de Prática (PracticeRecord)
  const practiceRecord = await prisma.practiceRecord.create({
    data: {
      user_id: user.id,
      study_session_id: studySession.id,
      block_id: sessionBlock.id,
      topic_id: childTopic.id,
      questions: 20,
      correct: 17,
    },
  });
  console.log(
    `[9/11 OK] PracticeRecord criado: ${practiceRecord.correct}/${practiceRecord.questions} acertos.`
  );

  // 10. Avaliação da Sessão (SessionEvaluation: 1:1)
  const evaluation = await prisma.sessionEvaluation.create({
    data: {
      user_id: user.id,
      study_session_id: studySession.id,
      understanding: UnderstandingLevel.MASTERED,
      focus: FocusLevel.HIGH,
      difficulty: DifficultyLevel.NORMAL,
      notes: 'Sessão muito produtiva.',
    },
  });
  console.log(
    `[10/11 OK] SessionEvaluation criada (1:1): entendimento=${evaluation.understanding}`
  );

  // 11. Meta (Goal)
  const goal = await prisma.goal.create({
    data: {
      user_id: user.id,
      kind: GoalKind.RESULT,
      metric: GoalMetric.ACCURACY,
      period: GoalPeriod.WEEK,
      period_start_local_date: '2026-10-05',
      target_value: 80.0,
      subject_id: subject.id,
      topic_id: childTopic.id,
    },
  });
  console.log(`[11/11 OK] Goal criada: alvo=${goal.target_value}%`);

  // Teste de integridade referencial: deleção em cascata
  await prisma.user.delete({ where: { id: user.id } });
  const remainingSubjects = await prisma.subject.count({ where: { user_id: user.id } });
  if (remainingSubjects === 0) {
    console.log('[CASCADE OK] Cascata do usuário funcionou perfeitamente.');
  }

  console.log('=== TODOS OS 11 MODELOS E 10 ENUMS FORAM VALIDADOS COM SUCESSO! ===');
}

main()
  .catch((e) => {
    console.error('Falha na validação do schema:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 5. Instruções Passo a Passo e Comandos para o Worker

### 5.1 Estrutura de Arquivos no `apps/api`
```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       └── 20261006000000_init/
│           └── migration.sql
├── package.json
└── tsconfig.json
```

### 5.2 Scripts no `apps/api/package.json`
Adicionar os seguintes scripts no `apps/api/package.json`:
```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev --name init",
    "db:deploy": "prisma migrate deploy",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### 5.3 Scripts na Raiz (`package.json`)
Para permitir execução a partir da raiz do monorepo:
```json
{
  "scripts": {
    "db:migrate": "npm --workspace=apps/api run db:migrate",
    "db:deploy": "npm --workspace=apps/api run db:deploy",
    "db:seed": "npm --workspace=apps/api run db:seed",
    "db:generate": "npm --workspace=apps/api run db:generate"
  }
}
```

### 5.4 Sequência de Execução Limpa a Partir do Zero
Quando o banco de dados PostgreSQL do Docker Compose estiver em execução:

1. **Geração do Client Prisma:**
   ```powershell
   npx --workspace=apps/api prisma generate
   ```

2. **Aplicação da Migração Inicial:**
   ```powershell
   npx --workspace=apps/api prisma migrate deploy
   # OU
   npx --workspace=apps/api prisma migrate dev --name init
   ```

3. **Execução do Script de Verificação/Seed:**
   ```powershell
   npx --workspace=apps/api tsx prisma/seed.ts
   ```

---

## 6. Mapeamento de Decisões Técnicas

| Item | Decisão | Justificativa |
|---|---|---|
| **Identificadores (IDs)** | `String @id @default(uuid())` | Padrão nativo do Prisma para PostgreSQL que gera UUIDs seguros e únicos sem exigir extensões do Postgres. |
| **Timestamps** | `created_at DateTime @default(now())`, `updated_at DateTime @updatedAt` | UTC nativo. Nome em snake_case alinhado à Seção 6 e aos contratos de API JSON. |
| **Multi-tenancy (`user_id`)** | Presente em todas as 10 tabelas dependentes com indexação `@@index([user_id])` | Garante isolamento estrito e desempenho em queries multilocatárias obrigatórias. |
| **Hierarquia de Tópicos** | Auto-relacionamento `parent_id` com `@relation("TopicHierarchy")` | Atende à profundidade arbitrária da árvore e simplifica queries de recursão. |
| **Proteção de Exclusão** | `onDelete: Restrict` em `Topic` com sessões (`PlannedSession`, `StudySession`, `PracticeRecord`) | Impede exclusão acidental em nível de banco, complementando a regra de negócio do backend (R3). |
| **Avaliação da Sessão** | `study_session_id String @unique` em `SessionEvaluation` | Garante regra do Contexto: "Uma sessão finalizada tem exatamente uma avaliação". |
| **Metas e Datas Locais** | `period_start_local_date String` | Evita anomalias de fuso horário em comparações de datas locais (ex.: '2026-10-06') entre servidor e cliente. |
| **Nomes de Tabelas** | `@@map("tabelas")` em snake_case plural | Garante compatibilidade direta com convenções PostgreSQL e consultas SQL diretas. |
