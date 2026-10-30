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
    const key = process.env.GEMINI_API_KEY?.trim();
    return key ? key : undefined;
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
    if (!apiKey || params.count <= 0) {
      return [];
    }

    const { subjectName, topicName, format, count } = params;
    const cleanTopic = topicName.trim();
    const exactTheme = cleanTopic ? `${subjectName} - ${cleanTopic}` : subjectName;

    let formatInstruction = '';
    if (format === 'MULTIPLE_CHOICE') {
      formatInstruction =
        'Gere exclusivamente questões do tipo MULTIPLE_CHOICE (múltipla escolha com 4 alternativas, exatamente 1 correta).';
    } else if (format === 'TRUE_FALSE') {
      formatInstruction =
        'Gere exclusivamente questões do tipo TRUE_FALSE (estilo Cebraspe com afirmação e 2 opções: "Certo" e "Errado", exatamente 1 correta).';
    } else if (format === 'CODE_CHALLENGE') {
      formatInstruction =
        'Gere exclusivamente questões do tipo CODE_CHALLENGE (mini desafio prático de código com campo codeSnippet preenchido contendo um bug ou lacuna, e 3 a 4 opções com propostas de solução ou saída esperada).';
    } else {
      formatInstruction =
        'Gere uma mescla diversificada com questões MULTIPLE_CHOICE, TRUE_FALSE e CODE_CHALLENGE (apenas se o tema comportar código).';
    }

    const prompt = `Você é um avaliador e professor especialista na plataforma de estudos para concursos e T.I. Cátedra.
Gere exatamente ${count} questões inéditas de alto nível técnico e pedagógico EXCLUSIVAMENTE sobre o tema "${exactTheme}" (Matéria: "${subjectName}"${cleanTopic ? `, Assunto: "${cleanTopic}"` : ''}).
REGRA DE ISOLAMENTO ABSOLUTO: É estritamente proibido incluir conteúdo ou conceitos de outras matérias fora de "${subjectName}".
${formatInstruction}

IMPORTANTE: Responda APENAS com um array JSON válido contendo os objetos das questões, sem formatação markdown em volta do JSON (ou com bloco \`\`\`json se necessário, mas o conteúdo deve ser estritamente JSON parseável).
Cada item do array deve ter a seguinte estrutura:
{
  "topicName": "Subtópico específico dentro da matéria",
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
      const MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
      let responseData: any = null;
      let lastHttpError = '';

      for (const model of MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          }),
        });

        if (res.ok) {
          responseData = await res.json();
          break;
        }

        const errBody = await res.text();
        lastHttpError = `Modelo ${model} retornou HTTP ${res.status}: ${errBody}`;
        if (res.status === 404) {
          console.warn(
            `[GeminiQuestionService] Modelo ${model} indisponível (404), tentando próximo fallback...`
          );
          continue;
        }
        throw new Error(lastHttpError);
      }

      if (!responseData) {
        throw new Error(lastHttpError || 'Resposta vazia da API Gemini.');
      }

      const rawOutput = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawOutput) {
        throw new Error(`Resposta Gemini sem texto candidato: ${JSON.stringify(responseData)}`);
      }

      let rawText = rawOutput.trim();
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) {
        throw new Error('Formato inesperado da resposta Gemini (esperado array JSON).');
      }

      const validItems: GeneratedQuestion[] = [];

      for (const item of parsed) {
        const statement = String(item?.statement || '').trim();
        if (!statement) continue;

        let qType: QuestionType = 'MULTIPLE_CHOICE';
        if (format !== 'MIXED') {
          qType = format;
        } else if (item.type === 'TRUE_FALSE' || item.type === 'CODE_CHALLENGE') {
          qType = item.type;
        }

        let qDiff: QuestionDifficulty = 'MEDIUM';
        if (item.difficulty === 'EASY' || item.difficulty === 'HARD') {
          qDiff = item.difficulty;
        }

        const options = Array.isArray(item.options)
          ? item.options
              .map((opt: any) => ({
                text: String(opt?.text || '').trim(),
                isCorrect: Boolean(opt?.isCorrect),
              }))
              .filter((opt: { text: string }) => opt.text.length > 0)
          : [];

        if (options.length < 2) continue;

        // Garante exatamente uma opção correta
        const firstCorrectIdx = options.findIndex((o: { isCorrect: boolean }) => o.isCorrect);
        if (firstCorrectIdx === -1) {
          options[0].isCorrect = true;
        } else {
          options.forEach((o: { isCorrect: boolean }, idx: number) => {
            o.isCorrect = idx === firstCorrectIdx;
          });
        }

        validItems.push({
          subjectName,
          topicName: cleanTopic || String(item.topicName || 'Geral').trim(),
          type: qType,
          difficulty: qDiff,
          source: 'IA Simulado (Gemini)',
          statement,
          codeSnippet: item.codeSnippet ? String(item.codeSnippet) : null,
          explanation: String(item.explanation || 'Gabarito oficial.').trim(),
          options,
        });

        if (validItems.length >= count) break;
      }

      return validItems;
    } catch (err: any) {
      console.error('[GeminiQuestionService] Erro detalhado da API Gemini:', err?.message || err);
      throw err;
    }
  }
}
