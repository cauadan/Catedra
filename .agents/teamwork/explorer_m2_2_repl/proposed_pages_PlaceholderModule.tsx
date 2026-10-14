import React from 'react';
import { Layers, Calendar, Clock, Target, BarChart2, Compass, Construction, ArrowLeft } from 'lucide-react';
import { useRouter } from '../contexts/RouterContext';

interface PlaceholderModuleProps {
  id: string;
  title: string;
  phase: string;
  description: string;
}

export function PlaceholderModule({ id, title, phase, description }: PlaceholderModuleProps) {
  const { navigate } = useRouter();

  const getIcon = () => {
    switch (id) {
      case 'subjects':
        return Layers;
      case 'agenda':
        return Calendar;
      case 'timer':
        return Clock;
      case 'goals':
        return Target;
      case 'stats':
        return BarChart2;
      case 'observatory':
        return Compass;
      default:
        return Construction;
    }
  };

  const Icon = getIcon();
  const isSubjects = id === 'subjects';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                {phase}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6">
          {isSubjects ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
              <h3 className="font-semibold text-blue-900">
                Pronto para a Fase 2 (Marcos 3 & 4)
              </h3>
              <p className="mt-2 text-xs text-blue-800 leading-relaxed">
                A navegação e a estrutura visual estão conectadas. Nesta seção serão implementados:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-blue-700">
                <li>CRUD de matérias com nome, cor e arquivamento em cascata;</li>
                <li>Árvore de assuntos com hierarquia recursiva e profundidade livre;</li>
                <li>Validação de prevenção de ciclos e proteção contra exclusão de nós com sessões vinculadas;</li>
                <li>Movimentação de assuntos preservando seus nós filhos.</li>
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-semibold text-slate-800">Módulo em Planejamento</h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Este módulo faz parte das próximas etapas do cronograma da plataforma e será
                habilitado nas fases subsequentes sem necessidade de alteração no layout base.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar ao Painel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
