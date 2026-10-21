import { describe, expect, it } from 'vitest';
import {
  ACCURACY_DROP_ALERT_POINTS,
  ADHERENCE_ALERT_THRESHOLD,
  buildClassificationIndex,
  calculateTopicClassification,
  CLASSIFICATION_EPSILON,
  CLASSIFICATION_WINDOW_DAYS,
  CONSISTENCY_ALERT_MIN_DAYS,
  DEFAULT_STUDY_THRESHOLDS,
  EFFECTIVENESS_ALERT_THRESHOLD,
  getClassificationWindow,
  LOW_UNDERSTANDING_THRESHOLD,
  MAX_TOPIC_RECOMMENDATIONS,
  MIN_DISTRACTION_ANALYSIS_SECONDS,
  MIN_QUESTIONS,
  MIN_QUESTIONS_FOR_RATING,
  NEGLECT_DAYS,
  PLANNING_GAP_ALERT_MINUTES,
  SCORE_WEIGHT_ACCURACY,
  SCORE_WEIGHT_UNDERSTANDING,
  STRONG_THRESHOLD,
  WEAK_THRESHOLD,
} from '../src/index.js';

describe('Fase 8 - Tarefa 1: Thresholds, Janela de Classificação e Nota 70/30', () => {
  const windowInfo = {
    windowStartLocalDate: '2026-09-22',
    windowEndLocalDate: '2026-10-21',
  };

  it('exporta todas as constantes de limiar de thresholds.ts e preserva compatibilidade com MIN_QUESTIONS_FOR_RATING', () => {
    expect(MIN_QUESTIONS).toBe(10);
    expect(MIN_QUESTIONS_FOR_RATING).toBe(MIN_QUESTIONS);
    expect(SCORE_WEIGHT_ACCURACY).toBe(0.7);
    expect(SCORE_WEIGHT_UNDERSTANDING).toBe(0.3);
    expect(STRONG_THRESHOLD).toBe(80);
    expect(WEAK_THRESHOLD).toBe(60);
    expect(CLASSIFICATION_EPSILON).toBe(1e-9);
    expect(LOW_UNDERSTANDING_THRESHOLD).toBe(50);
    expect(MAX_TOPIC_RECOMMENDATIONS).toBe(5);
    expect(CLASSIFICATION_WINDOW_DAYS).toBe(30);
    expect(NEGLECT_DAYS).toBe(7);
    expect(MIN_DISTRACTION_ANALYSIS_SECONDS).toBe(1800);
    expect(ADHERENCE_ALERT_THRESHOLD).toBe(70);
    expect(PLANNING_GAP_ALERT_MINUTES).toBe(60);
    expect(EFFECTIVENESS_ALERT_THRESHOLD).toBe(75);
    expect(ACCURACY_DROP_ALERT_POINTS).toBe(10);
    expect(CONSISTENCY_ALERT_MIN_DAYS).toBe(3);
    expect(DEFAULT_STUDY_THRESHOLDS.MIN_QUESTIONS).toBe(10);
  });

  it('retorna INSUFFICIENT_DATA com 9 questões e classifica com 10 questões', () => {
    const res9 = calculateTopicClassification(
      { totalQuestions: 9, totalCorrect: 9, understandingScores: [100] },
      windowInfo
    );
    expect(res9.classification).toBe('INSUFFICIENT_DATA');
    expect(res9.label).toBe('Dados insuficientes');
    expect(res9.finalScore).toBeNull();
    expect(res9.displayScore).toBeNull();
    expect(res9.usedFallback).toBe(false);
    expect(res9.weightsUsed).toBeNull();
    expect(res9.recommendedAction).toBe('COLLECT_MORE_DATA');
    expect(res9.questionsInWindow).toBe(9);
    expect(res9.correctInWindow).toBe(9);

    const res10 = calculateTopicClassification(
      { totalQuestions: 10, totalCorrect: 8, understandingScores: [100] },
      windowInfo
    );
    expect(res10.classification).toBe('STRONG');
    expect(res10.label).toBe('Ponto forte');
    expect(res10.recommendedAction).toBe('MAINTAIN');
  });

  it('aplica fallback de 100% acurácia quando evaluationsCount === 0 e totalQuestions >= 10', () => {
    const res = calculateTopicClassification(
      { totalQuestions: 20, totalCorrect: 15, understandingScores: [] },
      windowInfo
    );
    expect(res.usedFallback).toBe(true);
    expect(res.weightsUsed).toEqual({ accuracy: 1, understanding: 0 });
    expect(res.finalScore).toBe(75);
    expect(res.displayScore).toBe(75);
    expect(res.classification).toBe('REGULAR');
    expect(res.recommendedAction).toBe('MORE_PRACTICE');
  });

  it('valida fronteiras exatas 59 (WEAK), 60 (REGULAR), 79 (REGULAR), 80 (STRONG) e truncamento em 79.96 (79.9 REGULAR)', () => {
    const c59 = calculateTopicClassification(
      { totalQuestions: 100, totalCorrect: 59, understandingScores: [] },
      windowInfo
    );
    expect(c59.classification).toBe('WEAK');
    expect(c59.displayScore).toBe(59);
    expect(c59.recommendedAction).toBe('REVIEW_AND_PRACTICE');

    const c60 = calculateTopicClassification(
      { totalQuestions: 100, totalCorrect: 60, understandingScores: [] },
      windowInfo
    );
    expect(c60.classification).toBe('REGULAR');
    expect(c60.displayScore).toBe(60);
    expect(c60.recommendedAction).toBe('MORE_PRACTICE');

    const c79 = calculateTopicClassification(
      { totalQuestions: 100, totalCorrect: 79, understandingScores: [] },
      windowInfo
    );
    expect(c79.classification).toBe('REGULAR');
    expect(c79.displayScore).toBe(79);

    const c80 = calculateTopicClassification(
      { totalQuestions: 100, totalCorrect: 80, understandingScores: [] },
      windowInfo
    );
    expect(c80.classification).toBe('STRONG');
    expect(c80.displayScore).toBe(80);
    expect(c80.recommendedAction).toBe('MAINTAIN');

    // 79.96 algebrico: 0.7 * 79.8 + 0.3 * 80.33333333333333 = 55.86 + 24.1 = 79.96
    const c7996 = calculateTopicClassification(
      {
        totalQuestions: 1000,
        totalCorrect: 798,
        understandingScores: [80.33333333333333],
      },
      windowInfo
    );
    expect(c7996.classification).toBe('REGULAR');
    expect(c7996.displayScore).toBe(79.9);
  });

  it('varre combinações IEEE 754 onde 0.7 * A + 0.3 * U equivale algebricamente a 60 ou 80 e garante classificação correta com CLASSIFICATION_EPSILON', () => {
    let foundImprecision60 = 0;
    let foundImprecision80 = 0;

    for (let u = 0; u <= 100; u++) {
      // 0.7 * A + 0.3 * U = 60 => A = (600 - 3 * u) / 7
      // Usamos totalQuestions = 700, totalCorrect = (600 - 3 * u) * 7 => accuracy = (600 - 3*u)/7
      const num60 = 600 - 3 * u;
      if (num60 >= 0 && num60 <= 700) {
        const rawA = num60 / 7;
        const rawFinal = 0.7 * rawA + 0.3 * u;
        if (rawFinal < 60) foundImprecision60++;

        const res60 = calculateTopicClassification(
          { totalQuestions: 700, totalCorrect: num60, understandingScores: [u] },
          windowInfo
        );
        expect(res60.classification).toBe('REGULAR');
        expect(res60.displayScore).toBe(60);
      }

      const num80 = 800 - 3 * u;
      if (num80 >= 0 && num80 <= 700) {
        const rawA = num80 / 7;
        const rawFinal = 0.7 * rawA + 0.3 * u;
        if (rawFinal < 80) foundImprecision80++;

        const res80 = calculateTopicClassification(
          { totalQuestions: 700, totalCorrect: num80, understandingScores: [u] },
          windowInfo
        );
        expect(res80.classification).toBe('STRONG');
        expect(res80.displayScore).toBe(80);
      }
    }

    expect(foundImprecision60).toBeGreaterThan(0);
    expect(foundImprecision80).toBeGreaterThan(0);
  });

  it('permite injeção de thresholds customizados mudando a classificação ao alterar STRONG_THRESHOLD', () => {
    const customThresholds = {
      ...DEFAULT_STUDY_THRESHOLDS,
      STRONG_THRESHOLD: 90,
    };
    const resDefault = calculateTopicClassification(
      { totalQuestions: 10, totalCorrect: 8, understandingScores: [100] },
      windowInfo
    );
    // 0.7 * 80 + 0.3 * 100 = 86
    expect(resDefault.classification).toBe('STRONG');

    const resCustom = calculateTopicClassification(
      { totalQuestions: 10, totalCorrect: 8, understandingScores: [100] },
      windowInfo,
      customThresholds
    );
    expect(resCustom.classification).toBe('REGULAR');
  });

  it('calcula lowUnderstandingSignal de forma independente quando média de entendimento < 50 e evaluationsCount > 0', () => {
    const highAccLowUnd = calculateTopicClassification(
      { totalQuestions: 20, totalCorrect: 20, understandingScores: [0, 33] },
      windowInfo
    );
    expect(highAccLowUnd.lowUnderstandingSignal).toBe(true);
    expect(highAccLowUnd.classification).toBe('REGULAR'); // 0.7*100 + 0.3*16.5 = 74.95

    const boundary50 = calculateTopicClassification(
      { totalQuestions: 5, totalCorrect: 5, understandingScores: [33, 67] },
      windowInfo
    );
    expect(boundary50.lowUnderstandingSignal).toBe(false);
    expect(boundary50.classification).toBe('INSUFFICIENT_DATA');
  });

  it('calcula getClassificationWindow usando min(periodEndLocalDate, todayLocalDate) e 30 dias locais', () => {
    const refNow = new Date('2026-10-21T15:00:00.000Z');
    // Caso 1: período termina no futuro da semana atual (ex.: domingo 2026-10-25, mas hoje é 2026-10-21)
    const wCurrent = getClassificationWindow('2026-10-25', refNow, 'America/Sao_Paulo');
    expect(wCurrent.classificationEndLocalDate).toBe('2026-10-21');
    expect(wCurrent.windowEndLocalDate).toBe('2026-10-21');
    expect(wCurrent.windowStartLocalDate).toBe('2026-09-22');

    // Caso 2: período passado (ex.: semana encerrada em 2026-10-11)
    const wPast = getClassificationWindow('2026-10-11', refNow, 'America/Sao_Paulo');
    expect(wPast.classificationEndLocalDate).toBe('2026-10-11');
    expect(wPast.windowEndLocalDate).toBe('2026-10-11');
    expect(wPast.windowStartLocalDate).toBe('2026-09-12');
  });

  it('constrói índice de classificação por assunto (direto, sem descendentes) e por matéria (soma questões + média simples de avaliações), incluindo apenas itens com atividade na janela', () => {
    const refNow = new Date('2026-10-21T15:00:00.000Z');
    const win = getClassificationWindow('2026-10-21', refNow, 'America/Sao_Paulo');

    const subjects = [
      { id: 'sub-1', name: 'Matemática', color: '#3b82f6', archived: false },
      { id: 'sub-empty', name: 'História', color: '#ef4444', archived: false },
    ];
    const topics = [
      { id: 'top-parent', subject_id: 'sub-1', parent_id: null, name: 'Álgebra', archived: false },
      { id: 'top-child', subject_id: 'sub-1', parent_id: 'top-parent', name: 'Polinômios', archived: false },
      { id: 'top-never', subject_id: 'sub-1', parent_id: null, name: 'Geometria', archived: false },
    ];

    const sessions = [
      {
        id: 'sess-1',
        topic_id: 'top-parent',
        status: 'FINISHED' as const,
        started_at: new Date('2026-10-10T14:00:00.000Z'),
        ended_at: new Date('2026-10-10T15:00:00.000Z'),
        planned_start: null,
        blocks: [],
        events: [],
        practice_records: [{ topic_id: 'top-parent', questions: 20, correct: 15 }],
        evaluation: { understanding: 'GOOD' as const },
      },
      {
        id: 'sess-2',
        topic_id: 'top-child',
        status: 'FINISHED' as const,
        started_at: new Date('2026-10-12T14:00:00.000Z'),
        ended_at: new Date('2026-10-12T15:00:00.000Z'),
        planned_start: null,
        blocks: [],
        events: [],
        practice_records: [{ topic_id: 'top-child', questions: 5, correct: 5 }],
        evaluation: { understanding: 'MASTERED' as const },
      },
      // Sessão cancelada não deve entrar
      {
        id: 'sess-cancelled',
        topic_id: 'top-never',
        status: 'CANCELLED' as const,
        started_at: new Date('2026-10-12T16:00:00.000Z'),
        ended_at: new Date('2026-10-12T17:00:00.000Z'),
        planned_start: null,
        blocks: [],
        events: [],
        practice_records: [{ topic_id: 'top-never', questions: 30, correct: 30 }],
        evaluation: { understanding: 'MASTERED' as const },
      },
    ];

    const idx = buildClassificationIndex({
      sessions,
      subjects,
      topics,
      window: win,
    });

    // top-never e sub-empty não possuem atividade válida na janela => fora do índice
    expect(idx.byTopic.has('top-never')).toBe(false);
    expect(idx.bySubject.has('sub-empty')).toBe(false);

    // top-parent não soma questões de top-child (20 questões, 15 acertos, 1 avaliação GOOD=67)
    const parentClass = idx.byTopic.get('top-parent')!;
    expect(parentClass).toBeDefined();
    expect(parentClass.questionsInWindow).toBe(20);
    expect(parentClass.correctInWindow).toBe(15);
    expect(parentClass.evaluationsCount).toBe(1);
    // 0.7 * 75 + 0.3 * 67 = 52.5 + 20.1 = 72.6
    expect(parentClass.displayScore).toBe(72.6);

    // sub-1 soma todas as questões (20 + 5 = 25, acertos 15 + 5 = 20 => 80%) e faz média simples das avaliações (67 e 100 => 83.5)
    // 0.7 * 80 + 0.3 * 83.5 = 56 + 25.05 = 81.05 => STRONG, displayScore 81
    const subClass = idx.bySubject.get('sub-1')!;
    expect(subClass).toBeDefined();
    expect(subClass.questionsInWindow).toBe(25);
    expect(subClass.correctInWindow).toBe(20);
    expect(subClass.evaluationsCount).toBe(2);
    expect(subClass.classification).toBe('STRONG');
    expect(subClass.displayScore).toBe(81);
  });
});
