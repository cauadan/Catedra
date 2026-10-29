import { z } from 'zod';

export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'CODE_CHALLENGE'] as const;
export type QuestionTypeDTO = (typeof QUESTION_TYPES)[number];

export const QUESTION_FORMATS = ['MIXED', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'CODE_CHALLENGE'] as const;
export type QuestionFormatDTO = (typeof QUESTION_FORMATS)[number];

export const QUESTION_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export type QuestionDifficultyDTO = (typeof QUESTION_DIFFICULTIES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionTypeDTO, string> = {
  MULTIPLE_CHOICE: 'Múltipla Escolha',
  TRUE_FALSE: 'Certo / Errado',
  CODE_CHALLENGE: 'Desafio de Código',
};

export const QUESTION_FORMAT_LABELS: Record<QuestionFormatDTO, string> = {
  MIXED: 'Mesclado (Múltipla Escolha + Certo/Errado + Desafio)',
  MULTIPLE_CHOICE: 'Múltipla Escolha (A, B, C, D)',
  TRUE_FALSE: 'Certo / Errado (Estilo Cebraspe)',
  CODE_CHALLENGE: 'Mini Desafio de Código',
};

export const QUESTION_DIFFICULTY_LABELS: Record<QuestionDifficultyDTO, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Média',
  HARD: 'Difícil',
};

/**
 * Catálogo Nativo de Conteúdos com cobertura pronta e curada
 */
export interface NativeCatalogItem {
  category: 'TI' | 'CONCURSOS';
  subjectName: string;
  topics: string[];
  color: string;
}

export const NATIVE_CATALOG: NativeCatalogItem[] = [
  // T.I.
  {
    category: 'TI',
    subjectName: 'Banco de Dados & SQL',
    topics: ['Consultas SELECT, JOIN e GROUP BY', 'Modelagem Relacional e Normalização', 'Transações ACID e Índices'],
    color: '#3B82F6',
  },
  {
    category: 'TI',
    subjectName: 'Estrutura de Dados & Algoritmos',
    topics: ['Filas, Pilhas e Listas Encadeadas', 'Árvores Binárias e Grafos', 'Complexidade Big-O e Algoritmos de Ordenação'],
    color: '#10B981',
  },
  {
    category: 'TI',
    subjectName: 'Redes de Computadores',
    topics: ['Modelo OSI e Pilha TCP/IP', 'Protocolos HTTP, DNS e TLS/SSL', 'Roteamento, Máscaras e Subredes'],
    color: '#06B6D4',
  },
  {
    category: 'TI',
    subjectName: 'Segurança da Informação',
    topics: ['Criptografia Simétrica e Assimétrica', 'Ataques Web (SQLi, XSS, CSRF)', 'Autenticação, JWT e RBAC'],
    color: '#EF4444',
  },
  {
    category: 'TI',
    subjectName: 'Desenvolvimento Web & JavaScript',
    topics: ['JavaScript ES6+, Closures e Event Loop', 'Promises, Async/Await e Fetch API', 'TypeScript e Manipulação do DOM'],
    color: '#F59E0B',
  },
  {
    category: 'TI',
    subjectName: 'Linux & Git',
    topics: ['Comandos Fundamentais e Bash', 'Permissões e Processos no Linux', 'Git Flow, Branches e Rebase'],
    color: '#8B5CF6',
  },

  // Concursos
  {
    category: 'CONCURSOS',
    subjectName: 'Direito Constitucional',
    topics: ['Princípios Fundamentais e Direitos e Garantias', 'Organização dos Poderes', 'Controle de Constitucionalidade'],
    color: '#6366F1',
  },
  {
    category: 'CONCURSOS',
    subjectName: 'Direito Administrativo',
    topics: ['Princípios da Administração Pública (LIMPE)', 'Atos e Poderes Administrativos', 'Licitações e Contratos (Lei 14.133)'],
    color: '#EC4899',
  },
  {
    category: 'CONCURSOS',
    subjectName: 'Língua Portuguesa',
    topics: ['Concordância Verbal e Nominal', 'Regência e Emprego da Crase', 'Interpretação e Coesão Textual'],
    color: '#059669',
  },
  {
    category: 'CONCURSOS',
    subjectName: 'Raciocínio Lógico & Matemática',
    topics: ['Proposições e Tabela Verdade', 'Equivalências e Negações Lógicas', 'Análise Combinatória e Probabilidade'],
    color: '#D97706',
  },
];

// ==============================================================================
// ESQUEMAS DE VALIDAÇÃO ZOD
// ==============================================================================

export const questionBatchRequestSchema = z.object({
  subjectId: z.string().optional(),
  topicId: z.string().optional(),
  subjectName: z.string().trim().optional(),
  topicName: z.string().trim().optional(),
  format: z.enum(QUESTION_FORMATS).default('MIXED'),
  count: z.union([z.literal(5), z.literal(10)]).default(5),
});

export type QuestionBatchRequest = z.infer<typeof questionBatchRequestSchema>;

export const questionAnswerRequestSchema = z.object({
  questionId: z.string().uuid({ message: 'ID da questão inválido.' }),
  selectedOptionId: z.string().uuid().optional(),
  isHonestCorrect: z.boolean().optional(),
});

export type QuestionAnswerRequest = z.infer<typeof questionAnswerRequestSchema>;

// ==============================================================================
// DTOS PARA RESPOSTAS DE API
// ==============================================================================

export interface QuestionOptionDTO {
  id: string;
  text: string;
}

export interface QuestionItemDTO {
  id: string;
  topicId: string | null;
  subjectName: string;
  topicName: string;
  type: QuestionTypeDTO;
  difficulty: QuestionDifficultyDTO;
  source: string;
  statement: string;
  codeSnippet: string | null;
  options: QuestionOptionDTO[];
}

export interface QuestionBatchResponse {
  questions: QuestionItemDTO[];
  totalAvailable: number;
  providerSummary: {
    fromCache: number;
    fromExternal: number;
    isExternalAvailable: boolean;
  };
}

export interface QuestionAnswerResponse {
  isCorrect: boolean;
  correctOptionId: string | null;
  explanation: string | null;
}

export interface CatalogInfoResponse {
  catalog: NativeCatalogItem[];
  totalInBank: number;
  integrations: {
    geminiActive: boolean;
    quizApiActive: boolean;
  };
}
