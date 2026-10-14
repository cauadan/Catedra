import React from 'react';
import {
  Layers,
  Calendar,
  Clock,
  Target,
  BarChart2,
  Compass,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';

export function Dashboard() {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const modules = [
    {
      id: 'subjects',
      path: '/subjects',
      label: 'Matérias e Assuntos',
      description: 'Estruturação hierárquica em árvore, matérias coloridas e tópicos recursivos.',
      icon: Layers,
      tag: 'Próxima Etapa (Fase 2)',
      tagColor: 'bg-blue-100 text-blue-800 border-blue-200',
      active: true,
    },
    {
      id: 'agenda',
      path: '/agenda',
      label: 'Agenda e Planejamento',
      description: 'Planejamento semanal de sessões com fuso horário e início na segunda-feira.',
      icon: Calendar,
      tag: 'Fase 3',
      tagColor: 'bg-slate-100 text-slate-700 border-slate-200',
      active: false,
    },
    {
      id: 'timer',
      path: '/timer',
      label: 'Cronômetro de Estudo',
      description: 'Registro de tempo líquido, pausas e cálculo de foco e aproveitamento.',
      icon: Clock,
      tag: 'Fase 3',
      tagColor: 'bg-slate-100 text-slate-700 border-slate-200',
      active: false,
    },
    {
      id: 'goals',
      path: '/goals',
      label: 'Metas de Estudo',
      description: 'Definição e acompanhamento de metas de horas e questões resolvidas.',
      icon: Target,
      tag: 'Fase 4',
      tagColor: 'bg-slate-100 text-slate-700 border-slate-200',
      active: false,
    },
    {
      id: 'stats',
      path: '/stats',
      label: 'Desempenho e Estatísticas',
      description: 'Classificação de matérias (Forte, Regular, Fraco) e análise de notas.',
      icon: BarChart2,
      tag: 'Fase 4',
      tagColor: 'bg-slate-100 text-slate-700 border-slate-200',
      active: false,
    },
    {
      id: 'observatory',
      path: '/observatory',
      label: 'Observatório Semanal',
      description: 'Relatório consolidado e insights sobre hábitos e evolução de estudos.',
      icon: Compass,
      tag: 'Fase 5',
      tagColor: 'bg-slate-100 text-slate-700 border-slate-200',
      active: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Banner de Boas-Vindas */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white shadow-lg shadow-emerald-500/10 md:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Marco 2 — Autenticação & Shell Concluídos</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Olá, {user?.name || 'Estudante'}!
          </h1>
          <p className="mt-2 text-sm text-emerald-50 leading-relaxed">
            Sua conta está ativa e autenticada com sucesso. O ambiente base da plataforma
            está pronto para receber a Fase 2 (Árvore de Matérias e Assuntos).
          </p>
        </div>
      </div>

      {/* Grid de Módulos */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Módulos da Plataforma</h2>
          <span className="text-xs text-slate-500">Navegação e Planejamento</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                onClick={() => navigate(m.path)}
                className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.tagColor}`}
                    >
                      {m.tag}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {m.label}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {m.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Acessar</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cartão de Estado Operacional */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Resumo da Infraestrutura</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Sessão Segura</p>
              <p className="text-slate-500">Cookie httpOnly ativo</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Início da Semana</p>
              <p className="text-slate-500">Segunda-feira (ISO 8601)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
