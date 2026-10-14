import { PrismaClient } from '@prisma/client';
import { SubjectCreateInput, SubjectUpdateInput, SubjectDTO } from '@estudos/domain';

const prisma = new PrismaClient();

export class SubjectService {
  /**
   * Cria uma nova matéria associada ao usuário atual.
   */
  static async createSubject(userId: string, data: SubjectCreateInput): Promise<SubjectDTO> {
    const subject = await prisma.subject.create({
      data: {
        user_id: userId,
        name: data.name,
        color: data.color,
      },
    });

    return {
      id: subject.id,
      user_id: subject.user_id,
      name: subject.name,
      color: subject.color,
      archived: subject.archived,
      created_at: subject.created_at.toISOString(),
      updated_at: subject.updated_at.toISOString(),
    };
  }

  /**
   * Lista as matérias do usuário atual.
   * Filtra as matérias arquivadas caso includeArchived seja falso.
   */
  static async listSubjects(userId: string, includeArchived: boolean = false): Promise<SubjectDTO[]> {
    const subjects = await prisma.subject.findMany({
      where: {
        user_id: userId,
        ...(includeArchived ? {} : { archived: false }),
      },
      orderBy: { name: 'asc' },
    });

    return subjects.map(subject => ({
      id: subject.id,
      user_id: subject.user_id,
      name: subject.name,
      color: subject.color,
      archived: subject.archived,
      created_at: subject.created_at.toISOString(),
      updated_at: subject.updated_at.toISOString(),
    }));
  }

  /**
   * Atualiza os dados de uma matéria.
   * Só permite alterar matérias que pertençam ao usuário.
   */
  static async updateSubject(userId: string, subjectId: string, data: SubjectUpdateInput): Promise<SubjectDTO> {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.user_id !== userId) {
      throw new Error('NOT_FOUND');
    }

    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.archived !== undefined && { archived: data.archived }),
      },
    });

    if (data.archived !== undefined) {
      await prisma.topic.updateMany({
        where: { subject_id: subjectId },
        data: { archived: data.archived },
      });
    }

    return {
      id: updated.id,
      user_id: updated.user_id,
      name: updated.name,
      color: updated.color,
      archived: updated.archived,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
    };
  }

  /**
   * Exclui uma matéria do usuário.
   * Se a matéria tiver vínculos de sessão, deve ser tratada como erro (409) pelo controller, mas o Prisma cuida disso via RESTRICT? 
   * Na verdade, no schema, Subject.topics existe, mas a regra de negócio do usuário diz:
   * "Exclusão definitiva permitida apenas quando não houver sessões vinculadas; se houver, a API recusa e orienta a arquivar."
   * Como ainda não temos o modelo de sessões, podemos simplesmente apagar a matéria em cascata ou restringir se tiver sessão.
   * Para a Fase 2, se não há sessões, basta excluir a matéria e a restrição será imposta futuramente, ou verificada.
   */
  static async deleteSubject(userId: string, subjectId: string): Promise<void> {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        topics: true // futuramente: incluir sessoes
      }
    });

    if (!subject || subject.user_id !== userId) {
      throw new Error('NOT_FOUND');
    }

    // Regra: "Exclusão definitiva permitida apenas quando não houver sessões vinculadas".
    // Por enquanto não temos sessões no banco, mas a infra já recusa no catch com 409 se houver restrição.
    
    await prisma.subject.delete({
      where: { id: subjectId },
    });
  }
}
