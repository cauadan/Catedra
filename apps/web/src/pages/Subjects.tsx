import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Folder, File, Edit, Trash2, Archive, ArchiveRestore, ChevronRight, ChevronDown, MoreVertical } from 'lucide-react';
import { api, ApiError } from '../lib/api';

type SubjectDTO = { id: string; name: string; color: string; archived: boolean };
type TopicDTO = { id: string; subject_id: string; parent_id: string | null; name: string; archived: boolean };

// Função auxiliar para construir a árvore de tópicos
function buildTree(topics: TopicDTO[], parentId: string | null = null): (TopicDTO & { children: any[] })[] {
  return topics
    .filter((t) => t.parent_id === parentId)
    .map((t) => ({ ...t, children: buildTree(topics, t.id) }));
}

function CustomDialog({ isOpen, title, message, isConfirm, defaultValue, onClose, onConfirm }: { isOpen: boolean; title: string; message?: string; isConfirm?: boolean; defaultValue?: string; onClose: () => void; onConfirm: (val?: string) => void }) {
  const [val, setVal] = useState(defaultValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setVal(defaultValue || ''); if (isOpen && !isConfirm) { setTimeout(() => inputRef.current?.focus(), 50); } }, [isOpen, defaultValue, isConfirm]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-2 text-lg font-bold text-slate-900">{title}</h3>
        {message && <p className="mb-4 text-sm text-slate-600">{message}</p>}
        {!isConfirm && (
          <input ref={inputRef} type="text" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if(e.key==='Enter') onConfirm(val); if(e.key==='Escape') onClose(); }} className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button onClick={() => onConfirm(isConfirm ? undefined : val)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">{isConfirm ? 'Confirmar' : 'Salvar'}</button>
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
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const updateSubject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SubjectDTO> }) => api.patch(`/api/subjects/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const deleteSubject = useMutation({
    mutationFn: (id: string) => api.delete(`/api/subjects/${id}`),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const createTopic = useMutation({
    mutationFn: (data: { subject_id: string; parent_id?: string | null; name: string }) => api.post('/api/topics', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const updateTopic = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TopicDTO> }) => api.patch(`/api/topics/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const deleteTopic = useMutation({
    mutationFn: (id: string) => api.delete(`/api/topics/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  
  const [dialogState, setDialogState] = useState<any>(null);

  const handleAddSubject = () => {
    setDialogState({ title: 'Nome da matéria:', onConfirm: (name: string) => { if (name) createSubject.mutate({ name, color: '#3B82F6' }); } });
  };

  const handleAddTopic = (subject_id: string, parent_id: string | null = null) => {
    setDialogState({ title: 'Nome do assunto:', onConfirm: (name: string) => { if (name) createTopic.mutate({ subject_id, parent_id, name }); } });
  };

  const handleMoveTopic = (topic: TopicDTO) => {
    setDialogState({ title: 'ID do novo assunto pai (vazio para mover para a raiz da matéria):', defaultValue: topic.parent_id || '', onConfirm: (newParentId: string) => { if (newParentId !== undefined) updateTopic.mutate({ id: topic.id, data: { parent_id: newParentId || null } }); } });
  };

  const handleRenameTopic = (topic: TopicDTO) => {
    setDialogState({ title: 'Novo nome:', defaultValue: topic.name, onConfirm: (name: string) => { if (name && name !== topic.name) updateTopic.mutate({ id: topic.id, data: { name } }); } });
  };

  const handleDeleteTopic = (id: string) => {
    setDialogState({ title: 'Excluir este assunto?', isConfirm: true, onConfirm: () => deleteTopic.mutate(id) });
  };

  const handleDeleteSubject = (id: string) => {
    setDialogState({ title: 'Excluir esta matéria?', isConfirm: true, onConfirm: () => deleteSubject.mutate(id) });
  };

  // Renderização Recursiva da írvore
  const renderTopicNode = (node: TopicDTO & { children: any[] }) => {
    return (
      <div key={node.id} className="ml-6 mt-2 border-l-2 border-gray-200 pl-4">
        <div className="flex items-center justify-between group">
          <div className="flex items-center space-x-2">
            {node.children.length > 0 ? <Folder size={16} className="text-blue-500" /> : <File size={16} className="text-gray-400" />}
            <span className={`text-sm ${node.archived ? 'line-through text-gray-400' : 'text-gray-700'}`}>{node.name}</span>
            <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 ml-2">(ID: {node.id.slice(0,4)}...)</span>
          </div>
          <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleAddTopic(node.subject_id, node.id)} title="Adicionar Sub-assunto"><Plus size={14} className="text-green-500"/></button>
            <button onClick={() => handleRenameTopic(node)} title="Renomear"><Edit size={14} className="text-blue-500"/></button>
            <button onClick={() => handleMoveTopic(node)} title="Mover"><ChevronRight size={14} className="text-yellow-500"/></button>
            <button onClick={() => updateTopic.mutate({ id: node.id, data: { archived: !node.archived } })} title={node.archived ? "Desarquivar" : "Arquivar"}>
              {node.archived ? <ArchiveRestore size={14} className="text-purple-500"/> : <Archive size={14} className="text-orange-500"/>}
            </button>
            <button onClick={() => handleDeleteTopic(node.id)} title="Excluir"><Trash2 size={14} className="text-red-500"/></button>
          </div>
        </div>
        {node.children.map(renderTopicNode)}
      </div>
    );
  };

  if (loadingSubjects) return <div className="p-4">Carregando matérias...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Matérias e Assuntos</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm text-gray-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
            <span>Mostrar arquivados</span>
          </label>
          <button onClick={handleAddSubject} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center shadow-sm">
            <Plus size={16} className="mr-2" /> Nova Matéria
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex justify-between">
            <p className="text-sm text-red-700">{errorMsg}</p>
            <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-700 font-bold">âœ•</button>
          </div>
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <Folder size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Nenhuma matéria criada</h3>
          <p className="mt-1 text-gray-500">Comece criando sua primeira matéria para organizar seus assuntos.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {subjects.map((subject) => {
            const subjectTopics = buildTree(topics.filter(t => t.subject_id === subject.id));
            return (
              <div key={subject.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: subject.color }}></div>
                    <h2 className={`text-lg font-semibold ${subject.archived ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {subject.name}
                    </h2>
                  </div>
                  <div className="flex space-x-3">
                    <button onClick={() => handleAddTopic(subject.id)} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                      <Plus size={14} className="mr-1" /> Assunto
                    </button>
                    <button onClick={() => updateSubject.mutate({ id: subject.id, data: { archived: !subject.archived } })} className="text-sm text-orange-600 hover:text-orange-800 flex items-center">
                      {subject.archived ? <><ArchiveRestore size={14} className="mr-1"/> Desarquivar</> : <><Archive size={14} className="mr-1"/> Arquivar</>}
                    </button>
                    <button onClick={() => handleDeleteSubject(subject.id)} className="text-sm text-red-600 hover:text-red-800 flex items-center">
                      <Trash2 size={14} className="mr-1" /> Excluir
                    </button>
                  </div>
                </div>
                
                {subjectTopics.length === 0 ? (
                  <p className="text-sm text-gray-400 italic px-7">Nenhum assunto nesta matéria.</p>
                ) : (
                  <div className="px-3">
                    {subjectTopics.map(renderTopicNode)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <CustomDialog isOpen={!!dialogState} {...(dialogState || {title:'',onConfirm:()=>{}})} onClose={() => setDialogState(null)} onConfirm={(val) => { dialogState?.onConfirm(val); setDialogState(null); }} />
    </div>
  );
}


