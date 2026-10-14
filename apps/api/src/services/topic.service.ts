import { PrismaClient } from '@prisma/client';
import { 
  TopicCreateInput, 
  TopicUpdateInput, 
  TopicDTO,
  resolveTopicMove,
  wouldCreateHierarchyCycle,
  collectDescendantIds,
  TopicTreeNode
} from '@estudos/domain';

const prisma = new PrismaClient();

export class TopicService {
  
  static async createTopic(userId: string, data: TopicCreateInput): Promise<TopicDTO> {
    // Valida se a matéria existe e é do usuário
    const subject = await prisma.subject.findUnique({ where: { id: data.subject_id } });
    if (!subject || subject.user_id !== userId) {
      throw new Error('SUBJECT_NOT_FOUND');
    }

    if (data.parent_id) {
      const parent = await prisma.topic.findUnique({ where: { id: data.parent_id } });
      if (!parent || parent.user_id !== userId) {
        throw new Error('PARENT_NOT_FOUND');
      }
      if (parent.subject_id !== data.subject_id) {
        throw new Error('PARENT_SUBJECT_MISMATCH');
      }
    }

    const topic = await prisma.topic.create({
      data: {
        user_id: userId,
        subject_id: data.subject_id,
        parent_id: data.parent_id || null,
        name: data.name,
      },
    });

    return this.mapToDTO(topic);
  }

  static async listTopics(userId: string, subjectId?: string, includeArchived: boolean = false): Promise<TopicDTO[]> {
    const topics = await prisma.topic.findMany({
      where: {
        user_id: userId,
        ...(subjectId ? { subject_id: subjectId } : {}),
        ...(includeArchived ? {} : { archived: false }),
      },
      orderBy: { name: 'asc' },
    });

    return topics.map(this.mapToDTO);
  }

  static async updateTopic(userId: string, topicId: string, data: TopicUpdateInput): Promise<TopicDTO> {
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic || topic.user_id !== userId) {
      throw new Error('NOT_FOUND');
    }

    // Se houver alteração de parent_id ou subject_id, precisamos validar a árvore
    if (data.parent_id !== undefined || data.subject_id !== undefined) {
      // Carrega toda a árvore do usuário para validar
      const allTopics = await prisma.topic.findMany({ where: { user_id: userId } });
      const nodesMap = new Map<string, TopicTreeNode>();
      for (const t of allTopics) {
        nodesMap.set(t.id, { id: t.id, parent_id: t.parent_id, subject_id: t.subject_id });
      }

      const getNode = (id: string) => nodesMap.get(id);

      const resolution = resolveTopicMove(
        nodesMap.get(topicId)!,
        { subject_id: data.subject_id, parent_id: data.parent_id },
        getNode
      );

      if (!resolution.ok) {
        if (resolution.reason === 'CYCLE') throw new Error('HIERARCHY_CYCLE');
        if (resolution.reason === 'PARENT_NOT_FOUND') throw new Error('PARENT_NOT_FOUND');
        if (resolution.reason === 'SUBJECT_MISMATCH') throw new Error('PARENT_SUBJECT_MISMATCH');
        throw new Error('INVALID_MOVE');
      }

      const descendants = collectDescendantIds(topicId, allTopics);
      
      // Se mudou de subject, aplica aos descendentes
      if (resolution.subjectId !== topic.subject_id && descendants.length > 0) {
        await prisma.topic.updateMany({
          where: { id: { in: descendants } },
          data: { subject_id: resolution.subjectId },
        });
      }

      data.subject_id = resolution.subjectId;
      data.parent_id = resolution.parentId;
    }

    const updated = await prisma.topic.update({
      where: { id: topicId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.subject_id !== undefined && { subject_id: data.subject_id }),
        ...(data.parent_id !== undefined && { parent_id: data.parent_id }),
        ...(data.archived !== undefined && { archived: data.archived }),
      },
    });

    // Se arquivou ou desarquivou, aplica cascata
    if (data.archived !== undefined) {
      const allTopicsAfter = await prisma.topic.findMany({ where: { user_id: userId } });
      const descendants = collectDescendantIds(topicId, allTopicsAfter);
      if (descendants.length > 0) {
        await prisma.topic.updateMany({
          where: { id: { in: descendants } },
          data: { archived: data.archived },
        });
      }
    }

    return this.mapToDTO(updated);
  }

  static async deleteTopic(userId: string, topicId: string): Promise<void> {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic || topic.user_id !== userId) {
      throw new Error('NOT_FOUND');
    }

    await prisma.topic.delete({
      where: { id: topicId },
    });
  }

  private static mapToDTO(topic: any): TopicDTO {
    return {
      id: topic.id,
      user_id: topic.user_id,
      subject_id: topic.subject_id,
      parent_id: topic.parent_id,
      name: topic.name,
      archived: topic.archived,
      created_at: topic.created_at.toISOString(),
      updated_at: topic.updated_at.toISOString(),
    };
  }
}
