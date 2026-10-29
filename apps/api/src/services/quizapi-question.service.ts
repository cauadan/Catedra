import { QuestionType, QuestionDifficulty } from '@prisma/client';
import { GeneratedQuestion } from './gemini-question.service.js';

export class QuizApiQuestionService {
  private static getApiKey(): string | undefined {
    return process.env.QUIZ_API_KEY;
  }

  public static isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  private static mapCategory(subjectName: string, topicName: string): string | null {
    const combined = `${subjectName} ${topicName}`.toLowerCase();
    if (combined.includes('sql') || combined.includes('banco de dados')) return 'SQL';
    if (combined.includes('linux') || combined.includes('bash')) return 'Linux';
    if (combined.includes('docker') || combined.includes('devops') || combined.includes('rede')) return 'DevOps';
    if (combined.includes('javascript') || combined.includes('web') || combined.includes('code') || combined.includes('algoritmo')) return 'Code';
    return null;
  }

  public static async fetchQuestions(params: {
    subjectName: string;
    topicName: string;
    count: number;
  }): Promise<GeneratedQuestion[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return [];
    }

    const category = this.mapCategory(params.subjectName, params.topicName);
    if (!category) {
      return [];
    }

    try {
      const url = `https://quizapi.io/api/v1/questions?apiKey=${apiKey}&category=${category}&limit=${params.count}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        return [];
      }

      const data: any = await res.json();
      if (!Array.isArray(data)) {
        return [];
      }

      const results: GeneratedQuestion[] = [];

      for (const item of data) {
        if (!item.question || !item.answers) continue;

        const options: Array<{ text: string; isCorrect: boolean }> = [];
        const answerKeys = ['answer_a', 'answer_b', 'answer_c', 'answer_d', 'answer_e', 'answer_f'];

        for (const key of answerKeys) {
          const val = item.answers[key];
          if (val) {
            const isCorrectStr = item.correct_answers?.[`${key}_correct`];
            const isCorrect = isCorrectStr === 'true' || isCorrectStr === true;
            options.push({
              text: String(val),
              isCorrect,
            });
          }
        }

        if (options.length === 0) continue;
        if (!options.some(o => o.isCorrect)) {
          options[0].isCorrect = true;
        }

        let difficulty: QuestionDifficulty = 'MEDIUM';
        if (item.difficulty?.toLowerCase() === 'easy') difficulty = 'EASY';
        if (item.difficulty?.toLowerCase() === 'hard') difficulty = 'HARD';

        results.push({
          subjectName: params.subjectName,
          topicName: params.topicName,
          type: 'MULTIPLE_CHOICE' as QuestionType,
          difficulty,
          source: 'QuizAPI',
          statement: String(item.question),
          codeSnippet: item.description || null,
          explanation: item.explanation || 'Alternativa correta indicada pela base técnica da QuizAPI.',
          options,
        });
      }

      return results;
    } catch (err) {
      console.warn('[QuizApiQuestionService] Erro ao buscar da QuizAPI:', err);
      return [];
    }
  }
}
