// Database Helper for E2E Tests
// Allows seeding and verifying sessions (PlannedSession, StudySession, PracticeRecord)
// for delete-protection tests as specified in ORIGINAL_REQUEST.md R3 and PROJECT.md Feature 17.

export interface PlannedSessionSeed {
  userId: string;
  subjectId: string;
  topicId: string;
  scheduledStart?: Date;
  plannedMinutes?: number;
  priority?: number;
  activityType?: string;
  notes?: string;
  status?: 'PLANNED' | 'DONE' | 'SKIPPED' | 'RESCHEDULED';
}

export interface StudySessionSeed {
  userId: string;
  topicId: string;
  plannedSessionId?: string;
  startedAt?: Date;
  endedAt?: Date;
  status?: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
}

export class DbHelper {
  private prisma: any = null;
  private isConnected = false;

  constructor() {}

  /**
   * Lazily initialize database connection via Prisma client
   */
  public async getPrisma(): Promise<any> {
    if (this.prisma) return this.prisma;

    try {
      // Try resolving PrismaClient from @prisma/client or local monorepo paths
      let PrismaClient: any;
      try {
        const mod = await import('@prisma/client');
        PrismaClient = mod.PrismaClient;
      } catch {
        // Monorepo search
        try {
          // Dynamic import from apps/api
          const mod = await import('../../apps/api/node_modules/@prisma/client');
          PrismaClient = mod.PrismaClient;
        } catch {
          PrismaClient = null;
        }
      }

      if (PrismaClient) {
        this.prisma = new PrismaClient();
        await this.prisma.$connect();
        this.isConnected = true;
        return this.prisma;
      }
    } catch (err: any) {
      console.warn(`[DbHelper] Could not connect to Prisma: ${err?.message || err}`);
    }

    return null;
  }

  /**
   * Insert a PlannedSession directly into the database to test delete protection
   */
  public async insertPlannedSession(data: PlannedSessionSeed): Promise<string | null> {
    const prisma = await this.getPrisma();
    if (!prisma) {
      console.warn('[DbHelper] Prisma client not available for insertPlannedSession');
      return null;
    }

    try {
      const record = await prisma.plannedSession.create({
        data: {
          user_id: data.userId,
          subject_id: data.subjectId,
          topic_id: data.topicId,
          scheduled_start: data.scheduledStart || new Date(),
          planned_minutes: data.plannedMinutes || 60,
          priority: data.priority ?? 1,
          activity_type: data.activityType ?? 'THEORY',
          notes: data.notes ?? 'Sessão de teste E2E',
          status: data.status || 'PLANNED',
        },
      });
      return record.id;
    } catch (err: any) {
      console.warn(`[DbHelper] Failed to insert planned session: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Insert a StudySession directly into the database to test delete protection
   */
  public async insertStudySession(data: StudySessionSeed): Promise<string | null> {
    const prisma = await this.getPrisma();
    if (!prisma) {
      console.warn('[DbHelper] Prisma client not available for insertStudySession');
      return null;
    }

    try {
      const record = await prisma.studySession.create({
        data: {
          user_id: data.userId,
          topic_id: data.topicId,
          planned_session_id: data.plannedSessionId ?? null,
          started_at: data.startedAt || new Date(),
          ended_at: data.endedAt ?? null,
          status: data.status || 'FINISHED',
        },
      });
      return record.id;
    } catch (err: any) {
      console.warn(`[DbHelper] Failed to insert study session: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Delete test sessions for cleanup
   */
  public async deleteSessionsForTopic(topicId: string): Promise<void> {
    const prisma = await this.getPrisma();
    if (!prisma) return;

    try {
      await prisma.practiceRecord?.deleteMany({ where: { topic_id: topicId } });
      await prisma.studySession?.deleteMany({ where: { topic_id: topicId } });
      await prisma.plannedSession?.deleteMany({ where: { topic_id: topicId } });
    } catch (err: any) {
      console.warn(`[DbHelper] Cleanup failed: ${err?.message || err}`);
    }
  }

  /**
   * Disconnect client
   */
  public async disconnect(): Promise<void> {
    if (this.prisma && this.isConnected) {
      try {
        await this.prisma.$disconnect();
      } catch {
        // ignore
      }
      this.isConnected = false;
      this.prisma = null;
    }
  }
}
