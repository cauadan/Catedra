import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Folder,
  File,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronRight,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';

type SubjectDTO = { id: string; name: string; color: string; archived: boolean };
type TopicDTO = {
  id: string;
  subject_id: string;
  parent_id: string | null;
  name: string;
  archived: boolean;
  completed?: boolean;
  completed_at?: string | null;
};

// Função auxiliar para construir a árvore de tópicos
function buildTree(topics: TopicDTO[], parentId: string | null = null): (TopicDTO & { children: any[] })[] {
  return topics
    .filter((t) => t.parent_id === parentId)
    .map((t) => ({ ...t, children: buildTree(topics, t.id) }));
}

function CustomDialog({
  isOpen,
  title,
  message,
  isConfirm,
  defaultValue,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  message?: string;
  isConfirm?: boolean;
  defaultValue?: string;
  onClose: () => void;
  onConfirm: (val?: string) => void;
}) {
  const [val, setVal] = useState(defaultValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setVal(defaultValue || '');
    if (isOpen && !isConfirm) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue, isConfirm]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-2 text-lg font-bold text-slate-900">{title}</h3>
        {message && <p className="mb-4 text-sm text-slate-600">{message}</p>}
        {!isConfirm && (
          <input
            ref={inputRef}
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(val);
              if (e.key === 'Escape') onClose();
            }}
            className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(isConfirm ? undefined : val)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {isConfirm ? 'Confirmar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Subjects() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Busca de dados
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery<SubjectDTO[]>({
    queryKey: ['subjects', showArchived],
    queryFn: () => api.get(`/api/subjects?include_archived=${showArchived}`),
  });

  const { data: topics = [] } = useQuery<TopicDTO[]>({
    queryKey: ['topics', showArchived],
    queryFn: () => api.get(`/api/topics?include_archived=${showArchived}`),
  });

  // Mutações
  const createSubject = useMutation({
    mutationFn: (data: { name: string; color: string }) => api.post('/api/subjects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['observatory'] });
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const updateSubject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SubjectDTO> }) =>
      api.patch(`/api/subjects/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const deleteSubject = useMutation({
    mutationFn: (id: string) => api.delete(`/api/subjects/${id}`),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const createTopic = useMutation({
    mutationFn: (data: { subject_id: string; parent_id?: string | null; name: string }) =>
      api.post('/api/topics', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['observatory'] });
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const updateTopic = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TopicDTO> }) =>
      api.patch(`/api/topics/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['observatory'] });
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const toggleTopicCompleted = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.patch(`/api/topics/${id}/toggle-completed`, { completed }),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['topics'] });
      const previousTopics = queryClient.getQueriesData<TopicDTO[]>({ queryKey: ['topics'] });

      queryClient.setQueriesData<TopicDTO[]>({ queryKey: ['topics'] }, (old) =>
        old ? old.map((t) => (t.id === id ? { ...t, completed } : t)) : []
      );

      return { previousTopics };
    },
    onError: (err: ApiError, _vars, context) => {
      if (context?.previousTopics) {
        for (const [key, data] of context.previousTopics) {
          queryClient.setQueryData(key, data);
        }
      }
      setErrorMsg(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['observatory'] });
    },
  });

  const deleteTopic = useMutation({
    mutationFn: (id: string) => api.delete(`/api/topics/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['observatory'] });
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const [dialogState, setDialogState] = useState<any>(null);

  const handleAddSubject = () => {
    setDialogState({
      title: 'Nome da matéria:',
      onConfirm: (name: string) => {
        if (name) createSubject.mutate({ name, color: '#3B82F6' });
      },
    });
  };

  const handleAddTopic = (subject_id: string, parent_id: string | null = null) => {
    setDialogState({
      title: 'Nome do assunto:',
      onConfirm: (name: string) => {
        if (name) createTopic.mutate({ subject_id, parent_id, name });
      },
    });
  };

  const handleMoveTopic = (topic: TopicDTO) => {
    setDialogState({
      title: 'ID do novo assunto pai (vazio para mover para a raiz da matéria):',
      defaultValue: topic.parent_id || '',
      onConfirm: (newParentId: string) => {
        if (newParentId !== undefined)
          updateTopic.mutate({ id: topic.id, data: { parent_id: newParentId || null } });
      },
    });
  };

  const handleRenameTopic = (topic: TopicDTO) => {
    setDialogState({
      title: 'Novo nome:',
      defaultValue: topic.name,
      onConfirm: (name: string) => {
        if (name && name !== topic.name) updateTopic.mutate({ id: topic.id, data: { name } });
      },
    });
  };

  const handleDeleteTopic = (id: string) => {
    setDialogState({
      title: 'Excluir este assunto?',
      isConfirm: true,
      onConfirm: () => deleteTopic.mutate(id),
    });
  };

  const handleDeleteSubject = (id: string) => {
    setDialogState({
      title: 'Excluir esta matéria?',
      isConfirm: true,
      onConfirm: () => deleteSubject.mutate(id),
    });
  };

  // Renderização Recursiva da Árvore
  const renderTopicNode = (node: TopicDTO & { children: any[] }) => {
    const isCompleted = Boolean(node.completed);

    return (
      <div key={node.id} className="ml-6 mt-2 border-l-2 border-slate-200 pl-4">
        <div className="flex items-center justify-between group py-1 rounded-lg px-2 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2.5">
            {/* Checkbox / Toggle estilizado de Visto */}
            <button
              type="button"
              role="checkbox"
              aria-checked={isCompleted}
              aria-label={`Marcar assunto ${node.name} como visto`}
              onClick={() =>
                toggleTopicCompleted.mutate({ id: node.id, completed: !isCompleted })
              }
              title={isCompleted ? 'Desmarcar como visto' : 'Marcar como visto'}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                isCompleted
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                  : 'border-slate-300 bg-white text-transparent hover:border-emerald-500 hover:bg-emerald-50/40'
              }`}
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </button>

            {node.children.length > 0 ? (
              <Folder size={16} className={isCompleted ? 'text-emerald-600' : 'text-blue-500'} />
            ) : (
              <File size={16} className={isCompleted ? 'text-emerald-500' : 'text-slate-400'} />
            )}

            <span
              className={`text-sm transition-colors ${
                node.archived
                  ? 'line-through text-slate-400'
                  : isCompleted
                  ? 'text-slate-500 font-medium'
                  : 'text-slate-800 font-medium'
              }`}
            >
              {node.name}
            </span>

            {isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Visto
              </span>
            )}

            <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 ml-1">
              (ID: {node.id.slice(0, 4)}...)
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleAddTopic(node.subject_id, node.id)}
              title="Adicionar Sub-assunto"
              className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => handleRenameTopic(node)}
              title="Renomear"
              className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Edit size={14} />
            </button>
            <button
              onClick={() => handleMoveTopic(node)}
              title="Mover"
              className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => updateTopic.mutate({ id: node.id, data: { archived: !node.archived } })}
              title={node.archived ? 'Desarquivar' : 'Arquivar'}
              className="rounded-md p-1.5 text-orange-600 hover:bg-orange-50 transition-colors"
            >
              {node.archived ? (
                <ArchiveRestore size={14} className="text-purple-600" />
              ) : (
                <Archive size={14} />
              )}
            </button>
            <button
              onClick={() => handleDeleteTopic(node.id)}
              title="Excluir"
              className="rounded-md p-1.5 text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {node.children.map(renderTopicNode)}
      </div>
    );
  };

  if (loadingSubjects) return <div className="p-4">Carregando matérias...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Matérias e Assuntos</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Mostrar arquivados</span>
          </label>
          <button
            onClick={handleAddSubject}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center shadow-sm transition-colors"
          >
            <Plus size={16} className="mr-1.5" /> Nova Matéria
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex justify-between">
            <p className="text-sm text-red-700">{errorMsg}</p>
            <button
              onClick={() => setErrorMsg('')}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-slate-200">
          <Folder size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Nenhuma matéria criada</h3>
          <p className="mt-1 text-slate-500">
            Comece criando sua primeira matéria para organizar seus assuntos.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {subjects.map((subject) => {
            const subjectTopics = buildTree(topics.filter((t) => t.subject_id === subject.id));
            return (
              <div
                key={subject.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: subject.color }}
                    ></div>
                    <h2
                      className={`text-lg font-bold ${
                        subject.archived ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {subject.name}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddTopic(subject.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-all duration-150 hover:border-emerald-300 hover:bg-emerald-100/80 active:scale-[0.98]"
                    >
                      <Plus size={14} />
                      <span>Assunto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSubject.mutate({
                          id: subject.id,
                          data: { archived: !subject.archived },
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm transition-all duration-150 hover:border-amber-300 hover:bg-amber-100/80 active:scale-[0.98]"
                    >
                      {subject.archived ? (
                        <>
                          <ArchiveRestore size={14} />
                          <span>Desarquivar</span>
                        </>
                      ) : (
                        <>
                          <Archive size={14} />
                          <span>Arquivar</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubject(subject.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition-all duration-150 hover:border-rose-300 hover:bg-rose-100/80 active:scale-[0.98]"
                    >
                      <Trash2 size={14} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>

                {subjectTopics.length === 0 ? (
                  <p className="text-sm text-slate-400 italic px-7">
                    Nenhum assunto nesta matéria.
                  </p>
                ) : (
                  <div className="px-2">{subjectTopics.map(renderTopicNode)}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <CustomDialog
        isOpen={!!dialogState}
        {...(dialogState || { title: '', onConfirm: () => {} })}
        onClose={() => setDialogState(null)}
        onConfirm={(val) => {
          dialogState?.onConfirm(val);
          setDialogState(null);
        }}
      />
    </div>
  );
}
