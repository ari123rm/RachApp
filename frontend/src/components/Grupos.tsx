// src/components/Grupos.tsx
import { useState, useEffect } from 'react';
import { Plus, LoaderCircle, ChevronRight } from 'lucide-react';
import { dbService } from '../services/database';
import { AddGroupModal } from './AddGroupModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import { getAvatarColor } from '../utils/avatarColor';
import type { Grupo } from '../types';

export function Grupos({ onDataChange }: { onDataChange?: () => void }) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);

  const carregarGrupos = async () => {
    setIsLoading(true);
    try {
      const dados = await dbService.grupos.getAll();
      setGrupos(dados);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
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
        <h1 className="text-3xl font-bold text-white">Grupos</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#2DD4BF]/20 hover:bg-[#2DD4BF]/30 text-[#2DD4BF] px-4 py-2 rounded-full font-bold flex items-center gap-2 text-sm transition-colors"
        >
          <Plus size={16} /> Novo Grupo
        </button>
      </header>

      {grupos.length === 0 ? (
        <div className="bg-[#1c1c1e] p-8 rounded-3xl text-center border border-white/5">
          <p className="text-gray-400 mb-3">Você ainda não criou nenhum grupo.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-[#2DD4BF] font-bold text-sm hover:underline"
          >
            + Criar meu primeiro grupo
          </button>
        </div>
      ) : (
        <div className="space-y-3 pb-10">
          {grupos.map((grupo) => {
            const friendMembers = (grupo.members || []).filter((m) => m.friend);
            const totalMembers = grupo._count?.members || friendMembers.length + 1;
            const visibleFriends = friendMembers.slice(0, 3);
            const extraCount = Math.max(0, friendMembers.length - 3);

            return (
              <div
                key={grupo.id}
                onClick={() => setGrupoSelecionadoId(grupo.id)}
                className="bg-[#1c1c1e] rounded-2xl p-4 flex items-center justify-between border border-white/5 cursor-pointer hover:bg-[#2c2c2e] transition-colors"
              >
                <div>
                  <h3 className="text-white font-bold text-base">{grupo.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 mb-2.5">
                    {totalMembers} {totalMembers === 1 ? 'participante' : 'participantes'}
                  </p>

                  {/* Avatares Sobrepostos (Figura 3 do Artigo) */}
                  <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-[#2DD4BF] text-[#05080f] font-black text-[10px] flex items-center justify-center border-2 border-[#1c1c1e]">
                      V
                    </div>
                    {visibleFriends.map((m, idx) => (
                      <div
                        key={m.friend?.id || idx}
                        style={{ backgroundColor: getAvatarColor(m.friend?.color) }}
                        className="w-7 h-7 rounded-full text-white font-bold text-[10px] flex items-center justify-center border-2 border-[#1c1c1e]"
                      >
                        {(m.friend?.name || 'A')[0].toUpperCase()}
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <div className="w-7 h-7 rounded-full bg-gray-700 text-gray-200 font-bold text-[10px] flex items-center justify-center border-2 border-[#1c1c1e]">
                        +{extraCount}
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight size={20} className="text-gray-500" />
              </div>
            );
          })}
        </div>
      )}

      <AddGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          carregarGrupos();
          if (onDataChange) onDataChange();
        }}
      />

      <GroupDetailsModal
        grupoId={grupoSelecionadoId}
        isOpen={!!grupoSelecionadoId}
        onClose={() => {
          setGrupoSelecionadoId(null);
          carregarGrupos();
        }}
        onChanged={() => {
          carregarGrupos();
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}