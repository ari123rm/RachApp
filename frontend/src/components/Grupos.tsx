// src/components/Grupos.tsx
import { useState, useEffect } from 'react';
import { Plus, LoaderCircle, ChevronRight, Users } from 'lucide-react';
import { dbService } from '../services/database';
import { AddGroupModal } from './AddGroupModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import { TopBar } from './TopBar';
import { getAvatarColor } from '../utils/avatarColor';
import type { Grupo } from '../types';

export function Grupos({ onDataChange }: { onDataChange?: () => void }) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);

  const carregarGrupos = async () => {
    setIsLoading(true);
    try {
      const [dados, sessionUser] = await Promise.all([
        dbService.grupos.getAll(),
        dbService.auth.getSessionUser(),
      ]);
      setGrupos(dados);
      setMyAvatarUrl(sessionUser?.avatar_url || null);
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
      <div className="space-y-4">
        <TopBar title="Grupos" subtitle="Carregando grupos..." />
        <div className="flex flex-col items-center justify-center h-64 text-[var(--primary)]">
          <LoaderCircle size={40} strokeWidth={2} className="animate-spin mb-4" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Carregando grupos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <TopBar
        title="Grupos"
        subtitle={`${grupos.length} ${grupos.length === 1 ? 'grupo ativo' : 'grupos ativos'}`}
        rightContent={
          <button
            onClick={() => setIsModalOpen(true)}
            className="h-10 bg-[var(--primary-light)] hover:opacity-90 text-[var(--primary)] px-3.5 rounded-xl font-semibold flex items-center gap-1.5 text-xs transition-colors"
          >
            <Plus size={15} strokeWidth={2} /> Novo Grupo
          </button>
        }
      />

      {grupos.length === 0 ? (
        <div className="ds-card p-8 text-center">
          <p className="text-[var(--text-secondary)] mb-3">Você ainda não criou nenhum grupo.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-[var(--primary)] font-semibold text-sm hover:underline"
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
                className="ds-card p-4 flex items-center justify-between cursor-pointer hover:border-[var(--primary)]/40 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0 mt-0.5">
                    {grupo.avatar_url ? (
                      <img
                        src={grupo.avatar_url}
                        alt={grupo.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users size={22} strokeWidth={2} />
                    )}
                  </div>

                  <div>
                    <h3 className="font-display font-semibold text-[var(--text-primary)] text-base sm:text-[18px]">
                      {grupo.name}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-2.5">
                      {totalMembers} {totalMembers === 1 ? 'participante' : 'participantes'}
                    </p>

                    {/* Pilha de Avatares 32x32px (w-8 h-8) */}
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--primary)] text-white font-display font-bold text-xs flex items-center justify-center border-2 border-[var(--bg-surface)]">
                        {myAvatarUrl ? (
                          <img
                            src={myAvatarUrl}
                            alt="Você"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          'V'
                        )}
                      </div>
                      {visibleFriends.map((m, idx) => {
                        const fAvatar = m.friend?.avatar_url;
                        return (
                          <div
                            key={m.friend?.id || idx}
                            style={
                              fAvatar
                                ? undefined
                                : { backgroundColor: getAvatarColor(m.friend?.color) }
                            }
                            className="w-8 h-8 rounded-full overflow-hidden text-white font-display font-bold text-xs flex items-center justify-center border-2 border-[var(--bg-surface)]"
                          >
                            {fAvatar ? (
                              <img
                                src={fAvatar}
                                alt={m.friend?.name || 'Amigo'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (m.friend?.name || 'A')[0].toUpperCase()
                            )}
                          </div>
                        );
                      })}
                      {extraCount > 0 && (
                        <div className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-semibold text-xs flex items-center justify-center border-2 border-[var(--bg-surface)]">
                          +{extraCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ChevronRight size={20} strokeWidth={2} className="text-[var(--text-secondary)]" />
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
