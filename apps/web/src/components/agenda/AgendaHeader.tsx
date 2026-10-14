import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Globe,
  Plus,
} from 'lucide-react';
import { formatTimezoneLabel } from '../../lib/timezone';
import { addDaysToLocalDate } from '@estudos/domain';

interface AgendaHeaderProps {
  view: 'day' | 'week';
  currentDate: string; // YYYY-MM-DD
  timezone: string;
  onViewChange: (view: 'day' | 'week') => void;
  onNavigate: (step: -1 | 1 | 0) => void;
  onNewSession: () => void;
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

function formatDateDisplay(dateStr: string, view: 'day' | 'week'): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const diaSemanaIndex = dt.getUTCDay();

  if (view === 'day') {
    return `${DIAS_SEMANA[diaSemanaIndex]}, ${d} de ${MESES[m - 1]} de ${y}`;
  }

  // Visualização Semana: calcula segunda e domingo correspondentes
  const offsetToMonday = (diaSemanaIndex + 6) % 7;
  const mondayStr = addDaysToLocalDate(dateStr, -offsetToMonday);
  const sundayStr = addDaysToLocalDate(mondayStr, 6);

  const [, monMonth, monDay] = mondayStr.split('-').map(Number);
  const [sunYear, sunMonth, sunDay] = sundayStr.split('-').map(Number);

  if (monMonth === sunMonth) {
    return `${monDay} a ${sunDay} de ${MESES[monMonth - 1]} de ${sunYear}`;
  }

  return `${monDay} de ${MESES[monMonth - 1]} a ${sunDay} de ${MESES[sunMonth - 1]} de ${sunYear}`;
}

export function AgendaHeader({
  view,
  currentDate,
  timezone,
  onViewChange,
  onNavigate,
  onNewSession,
}: AgendaHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
      {/* Título e Navegação Temporal */}
      <div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Agenda de Estudos
          </h1>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm p-0.5">
            <button
              type="button"
              onClick={() => onNavigate(-1)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition"
              title="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate(0)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md transition"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => onNavigate(1)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition"
              title="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <span className="text-base font-semibold text-slate-800 ml-1">
            {formatDateDisplay(currentDate, view)}
          </span>
        </div>
      </div>

      {/* Controles de Visão, Badge de Fuso e Botão Novo */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
        {/* Badge do Fuso do Usuário */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
          title={`Fuso horário configurado: ${timezone}`}
        >
          <Globe className="h-3.5 w-3.5 text-slate-400" />
          {formatTimezoneLabel(timezone)}
        </span>

        {/* Alternador Dia / Semana */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 shadow-sm text-xs font-semibold">
          <button
            type="button"
            onClick={() => onViewChange('day')}
            className={`px-3 py-1.5 rounded-md transition ${
              view === 'day'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dia
          </button>
          <button
            type="button"
            onClick={() => onViewChange('week')}
            className={`px-3 py-1.5 rounded-md transition ${
              view === 'week'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semana
          </button>
        </div>

        {/* Botão Novo Agendamento */}
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Novo Planejamento
        </button>
      </div>
    </div>
  );
}
