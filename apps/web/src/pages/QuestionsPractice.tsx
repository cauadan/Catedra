import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  Sparkles,
  Terminal,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Award,
  HelpCircle,
  Check,
  X,
  Flame,
  Layers,
  Clock,
  Save,
  Database,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';
import { useRouter } from '../contexts/RouterContext';
import {
  NATIVE_CATALOG,
  QUESTION_FORMAT_LABELS,
  QUESTION_TYPE_LABELS,
  QUESTION_DIFFICULTY_LABELS,
  type QuestionFormatDTO,
  type QuestionItemDTO,
  type QuestionBatchResponse,
  type QuestionAnswerResponse,
  type CatalogInfoResponse,
  type NativeCatalogItem,
} from '@estudos/domain';

export function QuestionsPractice() {
  const queryClient = useQueryClient();
  const { navigate } = useRouter();

  // Estados de Configuração da Prática
  const [selectedSubject, setSelectedSubject] = useState<string>('Banco de Dados & SQL');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<QuestionFormatDTO>('MIXED');
  const [questionCount, setQuestionCount] = useState<5 | 10>(5);

  // Estados da Sessão Ativa de Prática
  const [activeBatch, setActiveBatch] = useState<QuestionItemDTO[] | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<QuestionAnswerResponse | null>(null);
  const [userScore, setUserScore] = useState<number>(0);
  const [showSolutionEarly, setShowSolutionEarly] = useState<boolean>(false);
  const [batchFinished, setBatchFinished] = useState<boolean>(false);

  // Estados do Modal de Registro em Sessão de Estudo
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [logMinutes, setLogMinutes] = useState<number>(15);
  const [logNotes, setLogNotes] = useState<string>('');
  const [logSuccess, setLogSuccess] = useState<boolean>(false);

  // 1. Consulta Informações do Catálogo e Status das APIs
  const { data: catalogInfo, isLoading: loadingCatalog } = useQuery<CatalogInfoResponse>({
    queryKey: ['questions', 'catalog-info'],
    queryFn: () => api.get<CatalogInfoResponse>('/api/questions/catalog-info'),
  });

  // 2. Consulta Matérias do Usuário (para seleção cruzada)
  const { data: userSubjects = [] } = useQuery<any[]>({
    queryKey: ['subjects', 'all'],
    queryFn: () => api.get<any[]>('/api/subjects?include_archived=false'),
  });

  const { data: userTopics = [] } = useQuery<any[]>({
    queryKey: ['topics', 'all'],
    queryFn: () => api.get<any[]>('/api/topics?include_archived=false'),
  });

  // Mutação para Gerar Lote
  const generateBatchMutation = useMutation({
    mutationFn: (payload: {
      subjectName: string;
      topicName: string;
      format: QuestionFormatDTO;
      count: 5 | 10;
    }) => api.post<QuestionBatchResponse>('/api/questions/generate-batch', payload),
    onSuccess: (data) => {
      setBatchNotice(data.notice || null);
      if (data.questions && data.questions.length > 0) {
        setActiveBatch(data.questions);
        setCurrentIndex(0);
        setSelectedOptionId(null);
        setCurrentAnswer(null);
        setUserScore(0);
        setShowSolutionEarly(false);
        setBatchFinished(false);
        setLogSuccess(false);
      } else {
        setActiveBatch(null);
      }
    },
  });

  // Mutação para Submeter Resposta
  const answerMutation = useMutation({
    mutationFn: (payload: {
      questionId: string;
      selectedOptionId?: string;
      isHonestCorrect?: boolean;
    }) => api.post<QuestionAnswerResponse>('/api/questions/answer', payload),
    onSuccess: (data) => {
      setCurrentAnswer(data);
      if (data.isCorrect) {
        setUserScore((prev) => prev + 1);
      }
    },
  });

  // Mutação para Registrar Sessão de Estudo
  const logSessionMutation = useMutation({
    mutationFn: (payload: {
      subjectName: string;
      topicName: string;
      minutes: number;
      questionsCount: number;
      correctCount: number;
      notes: string;
    }) => api.post<{ data: any }>('/api/questions/log-practice-session', payload),
    onSuccess: () => {
      setLogSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['study-session'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['observatory'] });
      setTimeout(() => {
        setIsLogModalOpen(false);
      }, 1500);
    },
  });

  const handleStartBatch = () => {
    generateBatchMutation.mutate({
      subjectName: selectedSubject,
      topicName: selectedTopic,
      format: selectedFormat,
      count: questionCount,
    });
  };

  const currentQuestion = activeBatch ? activeBatch[currentIndex] : null;

  const handleSelectOption = (optionId: string) => {
    if (currentAnswer || !currentQuestion || answerMutation.isPending) return;
    setSelectedOptionId(optionId);
    answerMutation.mutate({
      questionId: currentQuestion.id,
      selectedOptionId: optionId,
    });
  };

  const handleHonestSelfEvaluation = (isCorrect: boolean) => {
    if (currentAnswer || !currentQuestion || answerMutation.isPending) return;
    answerMutation.mutate({
      questionId: currentQuestion.id,
      isHonestCorrect: isCorrect,
    });
  };

  const handleNextQuestion = () => {
    if (!activeBatch) return;
    if (currentIndex + 1 < activeBatch.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setCurrentAnswer(null);
      setShowSolutionEarly(false);
    } else {
      setBatchFinished(true);
    }
  };

  const handleResetToCatalog = () => {
    setActiveBatch(null);
    setBatchNotice(null);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setCurrentAnswer(null);
    setBatchFinished(false);
    setUserScore(0);
    setLogSuccess(false);
  };

  const handleSelectNativeCatalogItem = (item: NativeCatalogItem, topicName?: string) => {
    setSelectedSubject(item.subjectName);
    setSelectedTopic(topicName || '');
    setBatchNotice(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckSquare className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Prática de Questões
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Treinamento intensivo de questões com correção instantânea, mini desafios de código e gabarito comentado.
          </p>
        </div>

        {activeBatch && (
          <button
            onClick={handleResetToCatalog}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Novo Lote de Treino
          </button>
        )}
      </div>

      {/* 2. BANNER DE TRANSPARÊNCIA DO CATÁLOGO E STATUS DE PROVEDORES */}
      {!activeBatch && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-200/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-emerald-950">
                  Acervo Híbrido Cátedra (Cache-First)
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-emerald-800">
                Prioriza banco de dados local com seed de alta precisão. Suporte inteligente a APIs externas gratuitas caso faltem questões no tema.
              </p>
            </div>

            {/* Badges de Integração */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
                Supabase: {catalogInfo?.totalInBank ?? 29} questões
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                  catalogInfo?.integrations.geminiActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                Gemini: {catalogInfo?.integrations.geminiActive ? 'Ativo' : 'Opcional'}
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                  catalogInfo?.integrations.quizApiActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                QuizAPI (T.I.): {catalogInfo?.integrations.quizApiActive ? 'Ativa' : 'Opcional'}
              </span>
            </div>
          </div>

          {/* Temas com Cobertura Nativa Curada */}
          <div className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-2">
              Matérias e Temas com Cobertura Pronta (Clique para selecionar):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(catalogInfo?.catalog || NATIVE_CATALOG).map((item) => {
                const isSelected = selectedSubject === item.subjectName;
                return (
                  <div
                    key={item.subjectName}
                    onClick={() => handleSelectNativeCatalogItem(item)}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-emerald-200/80 bg-white/70 hover:border-emerald-400 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs font-bold text-slate-900 leading-tight">
                          {item.subjectName}
                        </span>
                      </div>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.category}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.topics.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectNativeCatalogItem(item, t);
                          }}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                            selectedTopic === t && isSelected
                              ? 'bg-emerald-600 text-white font-semibold'
                              : 'bg-emerald-100/60 text-emerald-800 hover:bg-emerald-200/80'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. FORMULÁRIO DE CONFIGURAÇÃO DE LOTE */}
      {!activeBatch && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-500" />
            Configurar Lote de Treinamento
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Matéria */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Matéria
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedTopic('');
                  setBatchNotice(null);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <optgroup label="Catálogo Curado Cátedra">
                  {(catalogInfo?.catalog || NATIVE_CATALOG).map((item) => (
                    <option key={item.subjectName} value={item.subjectName}>
                      {item.subjectName} ({item.category})
                    </option>
                  ))}
                </optgroup>
                {userSubjects.length > 0 && (
                  <optgroup label="Minhas Matérias Cadastradas">
                    {userSubjects.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Tópico / Assunto */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Assunto / Tópico (Opcional)
              </label>
              <input
                type="text"
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  setBatchNotice(null);
                }}
                placeholder="Todos os assuntos da matéria..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Formato */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Formato das Questões
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as QuestionFormatDTO)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="MIXED">Mesclado (Múltipla Escolha + Certo/Errado + Desafio)</option>
                <option value="MULTIPLE_CHOICE">Múltipla Escolha (A, B, C, D)</option>
                <option value="TRUE_FALSE">Certo / Errado (Estilo Cebraspe)</option>
                <option value="CODE_CHALLENGE">Mini Desafio de Código</option>
              </select>
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Quantidade
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQuestionCount(5)}
                  className={`rounded-xl border py-2 text-sm font-semibold transition-all ${
                    questionCount === 5
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  5 Questões
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionCount(10)}
                  className={`rounded-xl border py-2 text-sm font-semibold transition-all ${
                    questionCount === 10
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  10 Questões
                </button>
              </div>
            </div>
          </div>

          {batchNotice && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs font-medium text-amber-900">
              {batchNotice}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleStartBatch}
              disabled={generateBatchMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {generateBatchMutation.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Buscando Questões...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Iniciar Treinamento
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 4. PLAYER DE QUESTÕES (LOTE ATIVO) */}
      {activeBatch && currentQuestion && !batchFinished && (
        <div className="space-y-4">
          {batchNotice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs font-medium text-amber-900">
              {batchNotice}
            </div>
          )}

          {/* Barra de Progresso do Lote */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
              <span className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-emerald-600" />
                Questão {currentIndex + 1} de {activeBatch.length}
              </span>
              <span>
                Acertos: <strong className="text-emerald-600 font-bold">{userScore}</strong> de{' '}
                {currentIndex + (currentAnswer ? 1 : 0)} respondidas
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{
                  width: `${((currentIndex + (currentAnswer ? 1 : 0)) / activeBatch.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Card da Questão */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            {/* Badges de Metadados */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-800">
                {currentQuestion.subjectName}
              </span>
              <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                {currentQuestion.topicName}
              </span>
              <span className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {QUESTION_TYPE_LABELS[currentQuestion.type] || currentQuestion.type}
              </span>
              <span
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  currentQuestion.difficulty === 'EASY'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : currentQuestion.difficulty === 'HARD'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {QUESTION_DIFFICULTY_LABELS[currentQuestion.difficulty]}
              </span>
              <span className="ml-auto text-xs text-slate-500 font-medium">
                Fonte: <strong className="text-slate-700">{currentQuestion.source}</strong>
              </span>
            </div>

            {/* Enunciado */}
            <div className="text-base font-medium leading-relaxed text-slate-900 whitespace-pre-line">
              {currentQuestion.statement}
            </div>

            {/* Snippet de Código / Terminal Mockup */}
            {currentQuestion.codeSnippet && (
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-md font-mono">
                {/* Barra de título do terminal */}
                <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs font-medium text-slate-400">
                      terminal - desafio_pratico.sh
                    </span>
                  </div>
                  <Terminal className="h-4 w-4 text-slate-500" />
                </div>
                {/* Código */}
                <div className="p-4 text-xs sm:text-sm text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed font-mono">
                  {currentQuestion.codeSnippet}
                </div>
              </div>
            )}

            {/* Alternativas / Opções de Resposta */}
            <div className="space-y-2.5 pt-2">
              {currentQuestion.type === 'TRUE_FALSE' ? (
                <div className="grid grid-cols-2 gap-3">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = selectedOptionId === opt.id;
                    const isCorrect = currentAnswer?.correctOptionId === opt.id;
                    const isWrongSelected = isSelected && currentAnswer && !currentAnswer.isCorrect;

                    let btnStyle =
                      'border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/30 text-slate-800';
                    if (currentAnswer) {
                      if (isCorrect) {
                        btnStyle = 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-500/30';
                      } else if (isWrongSelected) {
                        btnStyle = 'border-rose-600 bg-rose-50 text-rose-900 font-bold ring-2 ring-rose-500/30';
                      } else {
                        btnStyle = 'border-slate-200 bg-slate-50 text-slate-400 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={Boolean(currentAnswer) || answerMutation.isPending}
                        onClick={() => handleSelectOption(opt.id)}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-base font-bold shadow-sm transition-all ${btnStyle}`}
                      >
                        {opt.text === 'Certo' ? (
                          <Check className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <X className="h-5 w-5 text-rose-600" />
                        )}
                        {opt.text}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {currentQuestion.options.map((opt, idx) => {
                    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                    const letter = letters[idx] || `${idx + 1}`;
                    const isSelected = selectedOptionId === opt.id;
                    const isCorrect = currentAnswer?.correctOptionId === opt.id;
                    const isWrongSelected = isSelected && currentAnswer && !currentAnswer.isCorrect;

                    let cardStyle =
                      'border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/20 text-slate-800';
                    let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300';

                    if (currentAnswer) {
                      if (isCorrect) {
                        cardStyle =
                          'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-medium ring-2 ring-emerald-500/20 shadow-sm';
                        badgeStyle = 'bg-emerald-600 text-white border-emerald-600';
                      } else if (isWrongSelected) {
                        cardStyle =
                          'border-rose-600 bg-rose-50/80 text-rose-950 font-medium ring-2 ring-rose-500/20 shadow-sm';
                        badgeStyle = 'bg-rose-600 text-white border-rose-600';
                      } else {
                        cardStyle = 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-60';
                        badgeStyle = 'bg-slate-100 text-slate-400 border-slate-200';
                      }
                    }

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={Boolean(currentAnswer) || answerMutation.isPending}
                        onClick={() => handleSelectOption(opt.id)}
                        className={`w-full text-left flex items-start gap-3.5 rounded-xl border p-3.5 text-sm transition-all shadow-sm ${cardStyle}`}
                      >
                        <span
                          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${badgeStyle}`}
                        >
                          {letter}
                        </span>
                        <span className="flex-1 pt-0.5 leading-relaxed">{opt.text}</span>
                        {isCorrect && currentAnswer && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                        )}
                        {isWrongSelected && (
                          <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Suporte especial para Desafios de Código sem múltipla escolha obrigatória: Autoavaliação Honesta */}
            {currentQuestion.type === 'CODE_CHALLENGE' && !currentAnswer && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Pensou na solução e deseja verificar diretamente?
                </span>
                <button
                  type="button"
                  onClick={() => setShowSolutionEarly(!showSolutionEarly)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {showSolutionEarly ? 'Ocultar Solução' : 'Ver Solução Esperada & Autoavaliar'}
                </button>
              </div>
            )}

            {showSolutionEarly && !currentAnswer && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                  Autoavaliação Honesta
                </h4>
                <p className="text-xs text-amber-800">
                  Compare sua linha de raciocínio com a solução comentada e informe sinceramente seu resultado:
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleHonestSelfEvaluation(true)}
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    ✓ Acertei o Desafio
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHonestSelfEvaluation(false)}
                    className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition-colors"
                  >
                    ✕ Preciso Praticar Mais (Errei)
                  </button>
                </div>
              </div>
            )}

            {/* Gabarito Comentado Instantâneo */}
            {currentAnswer && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 space-y-2 mt-4 transition-all">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold ${
                      currentAnswer.isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    {currentAnswer.isCorrect ? '✓' : '✕'}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">
                    {currentAnswer.isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta.'}
                  </h4>
                </div>

                <div className="pl-8 text-xs sm:text-sm text-slate-800 leading-relaxed">
                  <p className="font-semibold text-emerald-950 mb-1 flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5 text-emerald-700" />
                    Gabarito Comentado:
                  </p>
                  <p className="whitespace-pre-line text-slate-700">
                    {currentAnswer.explanation || 'Gabarito oficial registrado no acervo.'}
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    {currentIndex + 1 < activeBatch.length ? (
                      <>
                        Próxima Questão
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        <Award className="h-4 w-4" />
                        Ver Resumo do Treinamento
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TELA DE CONCLUSÃO DO LOTE (RESUMO E AÇÕES) */}
      {batchFinished && activeBatch && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-6 max-w-2xl mx-auto">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
            <Award className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Lote de Treinamento Concluído!
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Você respondeu todas as {activeBatch.length} questões de{' '}
              <strong>{selectedSubject}</strong> ({selectedTopic || 'Todos os assuntos'}).
            </p>
          </div>

          {/* Placar */}
          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div>
              <span className="block text-2xl font-black text-emerald-600">{userScore}</span>
              <span className="text-xs font-semibold text-slate-600 uppercase">Acertos</span>
            </div>
            <div>
              <span className="block text-2xl font-black text-rose-600">
                {activeBatch.length - userScore}
              </span>
              <span className="text-xs font-semibold text-slate-600 uppercase">Erros</span>
            </div>
            <div>
              <span className="block text-2xl font-black text-indigo-600">
                {Math.round((userScore / activeBatch.length) * 100)}%
              </span>
              <span className="text-xs font-semibold text-slate-600 uppercase">Aproveitamento</span>
            </div>
          </div>

          {/* Feedback Pedagógico */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900">
            {userScore / activeBatch.length >= 0.8 ? (
              <p className="font-medium">
                🎯 <strong>Excelente desempenho!</strong> Seu domínio sobre{' '}
                {selectedTopic || selectedSubject} está bem consolidado.
              </p>
            ) : userScore / activeBatch.length >= 0.5 ? (
              <p className="font-medium">
                📈 <strong>Bom ritmo!</strong> Revise os gabaritos comentados das questões que errou para fixar os pontos-chave.
              </p>
            ) : (
              <p className="font-medium">
                💡 <strong>Hora de reforçar a teoria!</strong> Recomendamos agendar uma sessão de revisão no Observatório Semanal.
              </p>
            )}
          </div>

          {/* Botões de Ação Final */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsLogModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <Save className="h-4 w-4" />
              Registrar acertos em Sessão de Estudo
            </button>

            <button
              type="button"
              onClick={handleResetToCatalog}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Apenas concluir prática
            </button>
          </div>
        </div>
      )}

      {/* 6. MODAL DE REGISTRO DIRETO NA SESSÃO DE ESTUDO */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Save className="h-5 w-5 text-emerald-600" />
                Registrar no Histórico de Estudos
              </h3>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {logSuccess ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">
                ✓ Sessão de prática gravada com sucesso! Atualizando estatísticas...
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Os acertos serão computados no seu painel, metas e gráficos de desempenho sob a etapa de <strong>Prática</strong>:
                </p>

                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-1 text-xs">
                  <div>
                    <strong className="text-slate-700">Matéria:</strong> {selectedSubject}
                  </div>
                  <div>
                    <strong className="text-slate-700">Assunto:</strong>{' '}
                    {selectedTopic || 'Todos os assuntos'}
                  </div>
                  <div>
                    <strong className="text-slate-700">Questões Resolvidas:</strong>{' '}
                    {activeBatch?.length} ({userScore} acertos)
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tempo Estimado Dedicado (minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Anotação Opcional
                  </label>
                  <textarea
                    rows={2}
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    placeholder="Ex.: Treinamento prático de SQL com foco em JOINs e agregações."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsLogModalOpen(false)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={logSessionMutation.isPending}
                    onClick={() => {
                      logSessionMutation.mutate({
                        subjectName: selectedSubject,
                        topicName: selectedTopic,
                        minutes: logMinutes,
                        questionsCount: activeBatch?.length || 5,
                        correctCount: userScore,
                        notes: logNotes,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {logSessionMutation.isPending ? 'Salvando...' : 'Confirmar e Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
