import { QuestionType, QuestionDifficulty } from '@prisma/client';

export interface GeneratedQuestion {
  subjectName: string;
  topicName: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  source: string;
  statement: string;
  codeSnippet?: string | null;
  explanation: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
}

export class GeminiQuestionService {
  private static getApiKey(): string | undefined {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  }

  public static isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  public static async generateQuestions(params: {
    subjectName: string;
    topicName: string;
    format: 'MIXED' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'CODE_CHALLENGE';
    count: number;
  }): Promise<GeneratedQuestion[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return [];
    }

    const { subjectName, topicName, format, count } = params;

    let formatInstruction = '';
    if (format === 'MULTIPLE_CHOICE') {
      formatInstruction = 'Gere exclusivamente questões do tipo MULTIPLE_CHOICE (múltipla escolha com 4 alternativas, exatamente 1 correta).';
    } else if (format === 'TRUE_FALSE') {
      formatInstruction = 'Gere exclusivamente questões do tipo TRUE_FALSE (estilo Cebraspe com afirmação e 2 opções: "Certo" e "Errado", exatamente 1 correta).';
    } else if (format === 'CODE_CHALLENGE') {
      formatInstruction = 'Gere exclusivamente questões do tipo CODE_CHALLENGE (mini desafio prático de código com campo codeSnippet preenchido contendo um bug ou lacuna, e 3 a 4 opções com propostas de solução ou saída esperada).';
    } else {
      formatInstruction = 'Gere uma mescla diversificada com questões MULTIPLE_CHOICE, TRUE_FALSE e CODE_CHALLENGE (se o tema permitir código).';
    }

    const prompt = `Você é um avaliador e professor especialista na plataforma de estudos para concursos e T.I. Cátedra.
Gere exatamente ${count} questões de alto nível técnico e pedagógico para a matéria "${subjectName}" e o assunto "${topicName}".
${formatInstruction}

IMPORTANTE: Responda APENAS com um array JSON válido contendo os objetos das questões, sem formatação markdown em volta do JSON (ou com bloco \`\`\`json se necessário, mas o conteúdo deve ser estritamente JSON parseável).
Cada item do array deve ter a seguinte estrutura:
{
  "type": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "CODE_CHALLENGE",
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "statement": "Enunciado claro, objetivo e contextualizado",
  "codeSnippet": "Código relevante caso seja desafio ou análise técnica, ou null se não houver",
  "explanation": "Gabarito comentado detalhado explicando por que a correta está certa e as outras erradas",
  "options": [
    { "text": "Texto da alternativa", "isCorrect": true/false }
  ]
}
Regras:
1. Deve haver exatamente 1 opção com isCorrect: true por questão.
2. Não gere IDs.
3. Para TRUE_FALSE, o array options deve ter exatamente duas opções: "Certo" e "Errado".
4. Todo o texto deve estar em Português do Brasil.`;

    try {
      // Tenta gemini-2.5-flash com fallback para gemini-1.5-flash
      const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
      let responseData: any = null;

      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                topK: 40,
                topP: 0.95,
              },
            }),
          });

          if (res.ok) {
            responseData = await res.json();
            break;
          }
        } catch {
          // Continua tentando próximo modelo
        }
      }

      if (!responseData?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return [];
      }

      let rawText = responseData.candidates[0].content.parts[0].text.trim();
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((item: any) => {
        let qType: QuestionType = 'MULTIPLE_CHOICE';
        if (item.type === 'TRUE_FALSE' || item.type === 'CODE_CHALLENGE') {
          qType = item.type;
        }

        let qDiff: QuestionDifficulty = 'MEDIUM';
        if (item.difficulty === 'EASY' || item.difficulty === 'HARD') {
          qDiff = item.difficulty;
        }

        const options = Array.isArray(item.options)
          ? item.options.map((opt: any) => ({
              text: String(opt.text || ''),
              isCorrect: Boolean(opt.isCorrect),
            }))
          : [];

        // Garante que há ao menos uma opção correta
        if (!options.some((o: { isCorrect: boolean }) => o.isCorrect) && options.length > 0) {
          options[0].isCorrect = true;
        }

        return {
          subjectName,
          topicName,
          type: qType,
          difficulty: qDiff,
          source: 'IA Simulado (Gemini)',
          statement: String(item.statement || ''),
          codeSnippet: item.codeSnippet ? String(item.codeSnippet) : null,
          explanation: String(item.explanation || 'Gabarito oficial.'),
          options,
        };
      });
    } catch (error) {
      console.warn('[GeminiQuestionService] Erro ao gerar questões com Gemini:', error);
      return [];
    }
  }
}
