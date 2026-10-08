// src/components/Grupos.tsx
import { useState, useEffect } from 'react';
import { Users, Plus, LoaderCircle } from 'lucide-react';
import { dbService } from '../services/api';
import { AddGroupModal } from './AddGroupModal'; // <-- IMPORTA O MODAL
import { GroupDetailsModal } from './GroupDetailsModal';

export function Grupos() {
  const [grupos, setGrupos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false); // <-- CONTROLE DO MODAL
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null); // <-- CONTROLA QUAL GRUPO ABRIR

  const carregarGrupos = async () => {
    setIsLoading(true);
    try {
      const dados = await dbService.grupos.getAll();
      setGrupos(dados);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarGrupos();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#2DD4BF]">
        <LoaderCircle size={40} className="animate-spin mb-4" />
        <p className="text-gray-400 font-medium">Carregando grupos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <header className="mt-2 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white mb-4">Meus Grupos</h1>
        <button 
          onClick={() => setIsModalOpen(true)} // <-- ABRE O MODAL
          className="bg-[#2DD4BF]/20 text-[#2DD4BF] px-4 py-2 rounded-full font-bold flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Novo
        </button>
      </header>

      {grupos.length === 0 ? (
        <div className="bg-[#1c1c1e] p-6 rounded-2xl text-center border border-white/5">
          <p className="text-gray-400">Você ainda não faz parte de nenhum grupo.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-10">
          {grupos.map((grupo) => (
            <div 
              key={grupo.id} 
              onClick={() => setGrupoSelecionadoId(grupo.id)} // <-- CLIQUE ABRE DETALHES
              className="bg-[#1c1c1e] rounded-2xl p-4 flex items-center justify-between border border-white/5 cursor-pointer hover:bg-[#2c2c2e]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-white font-bold">{grupo.name}</h3>
                  <p className="text-xs text-gray-500">{grupo._count?.members || 0} participantes</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RENDERIZA O MODAL AQUI */}
      <AddGroupModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={carregarGrupos} 
      />
      <GroupDetailsModal
        grupoId={grupoSelecionadoId}
        isOpen={!!grupoSelecionadoId}
        onClose={() => { setGrupoSelecionadoId(null); carregarGrupos(); }}
      />
    </div>
  );
}