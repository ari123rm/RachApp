// src/components/Amigos.tsx
import { useState, useEffect } from 'react';
import { Search, Star, LoaderCircle, UserPlus, ChevronRight } from 'lucide-react';
import { FriendCard } from './FriendCard';
import { FriendDetailsModal } from './FriendDetailsModal';
import { AddFriendModal } from './AddFriendModal';
import { AddGroupModal } from './AddGroupModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import type { Grupo } from '../types';

export function Amigos({ onDataChange }: { onDataChange?: () => void }) {
  const [subTab, setSubTab] = useState<'amigos' | 'grupos'>('amigos');
  const [busca, setBusca] = useState('');
  const [amigoSelecionado, setAmigoSelecionado] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [amigos, setAmigos] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);

  const carregarDados = async () => {
    setIsLoading(true);
    try {
      const [dadosAmigos, dadosGrupos] = await Promise.all([
        dbService.amigos.getAll(),
        dbService.grupos.getAll(),
      ]);

      const amigosComValores = await Promise.all(
        dadosAmigos.map(async (amigo) => {
          const valorDevido =
            amigo.dividaNumerica !== undefined
              ? amigo.dividaNumerica
              : await dbService.financeiro.calcularDividaDoAmigo(amigo.id);
          const dividaFormatada = moneyConverter(valorDevido);

          return {
            ...amigo,
            nome: amigo.nome || amigo.name || 'Amigo',
            cor: amigo.cor || amigo.color || 'bg-sky-500',
            favorito: amigo.favorito ?? amigo.is_favorite ?? false,
            divida: dividaFormatada,
          };
        })
      );

      setAmigos(amigosComValores);
      setGrupos(dadosGrupos);
    } catch (error) {
      console.error('Erro ao buscar amigos e grupos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleToggleFavorito = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setAmigos(
      amigos.map((amigo) =>
        amigo.id === id ? { ...amigo, favorito: !amigo.favorito } : amigo
      )
    );

    await dbService.amigos.toggleFavorito(id);
  };

  const handleExcluirAmigo = async (id: string) => {
    const nomeAlvo = amigoSelecionado?.nome || amigoSelecionado?.name || 'este amigo';
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir ${nomeAlvo}? Esta ação não pode ser desfeita.`
    );

    if (!confirmar) return;

    try {
      await dbService.amigos.delete(id);
      setAmigos(amigos.filter((a) => a.id !== id));
      setAmigoSelecionado(null);
      if (onDataChange) onDataChange();
    } catch (error) {
      alert('Erro ao excluir o amigo.');
    }
  };

  const amigosFiltrados = amigos.filter((a) =>
    (a.nome || a.name || '').toLowerCase().includes(busca.toLowerCase())
  );
  const favoritos = amigos.filter((a) => a.favorito);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#2DD4BF]">
        <LoaderCircle size={40} className="animate-spin mb-4" />
        <p className="text-gray-400 font-medium">Carregando amigos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <header className="mt-2 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Amigos</h1>
        </div>

        {/* Barra de alternância Amigos / Grupos + Botão Novo (Figura 3 do Artigo) */}
        <div className="flex items-center justify-between gap-2">
          <div className="bg-[#1c1c1e] p-1 rounded-full flex items-center border border-white/5 flex-1">
            <button
              onClick={() => setSubTab('amigos')}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${
                subTab === 'amigos'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Amigos
            </button>
            <button
              onClick={() => setSubTab('grupos')}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${
                subTab === 'grupos'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Grupos
            </button>
          </div>

          <button
            onClick={() =>
              subTab === 'amigos' ? setIsAddFriendOpen(true) : setIsAddGroupOpen(true)
            }
            className="bg-[#1c1c1e] hover:bg-[#2c2c2e] text-[#2DD4BF] border border-[#2DD4BF]/30 px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <UserPlus size={15} /> Novo
          </button>
        </div>

        {subTab === 'amigos' && (
          <div className="bg-[#1c1c1e] rounded-2xl flex items-center p-3 text-gray-400 border border-white/5 focus-within:ring-1 focus-within:ring-[#2DD4BF] focus-within:text-[#2DD4BF] transition-all">
            <Search size={20} className="mr-3" />
            <input
              type="text"
              placeholder="Buscar amigos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-500"
            />
          </div>
        )}
      </header>

      {subTab === 'amigos' ? (
        <>
          {/* FAVORITOS */}
          {busca === '' && favoritos.length > 0 && (
            <section>
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-lg font-bold text-white">Favoritos</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {favoritos.map((amigo) => (
                  <div
                    key={amigo.id}
                    onClick={() => setAmigoSelecionado(amigo)}
                    className="flex flex-col items-center min-w-[72px] cursor-pointer active:opacity-70"
                  >
                    <div className="relative mb-2">
                      <div
                        className={`w-16 h-16 rounded-3xl ${amigo.cor} flex items-center justify-center shadow-lg border border-white/10`}
                      >
                        <span className="text-2xl font-black text-white">
                          {amigo.nome[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-[#05080f] rounded-full p-1">
                        <Star size={16} className="text-yellow-500 fill-yellow-500" />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-300 truncate w-full text-center">
                      {amigo.nome.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TODOS OS AMIGOS */}
          <section className="pb-10">
            <h2 className="text-lg font-bold text-white mb-4">
              {busca ? 'Resultados da busca' : 'Todos os Amigos'}
            </h2>

            <div className="space-y-3">
              {amigosFiltrados.length === 0 ? (
                <p className="text-gray-500 text-center py-6">Nenhum amigo encontrado.</p>
              ) : (
                amigosFiltrados.map((amigo) => (
                  <FriendCard
                    key={amigo.id}
                    amigo={amigo}
                    onClick={() => setAmigoSelecionado(amigo)}
                    onToggleFavorito={(e) => handleToggleFavorito(amigo.id, e)}
                  />
                ))
              )}
            </div>
          </section>
        </>
      ) : (
        /* ABA GRUPOS (Figura 3) */
        <section className="pb-10 space-y-3">
          {grupos.length === 0 ? (
            <div className="bg-[#1c1c1e] p-8 rounded-3xl text-center border border-white/5">
              <p className="text-gray-400 mb-3">Você ainda não faz parte de nenhum grupo.</p>
              <button
                onClick={() => setIsAddGroupOpen(true)}
                className="text-[#2DD4BF] font-bold text-sm hover:underline"
              >
                + Criar novo grupo
              </button>
            </div>
          ) : (
            grupos.map((grupo) => {
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
                    <div className="flex -space-x-2">
                      <div className="w-7 h-7 rounded-full bg-[#2DD4BF] text-[#05080f] font-black text-[10px] flex items-center justify-center border-2 border-[#1c1c1e]">
                        V
                      </div>
                      {visibleFriends.map((m, idx) => (
                        <div
                          key={m.friend?.id || idx}
                          className={`w-7 h-7 rounded-full ${
                            m.friend?.color || 'bg-sky-500'
                          } text-white font-bold text-[10px] flex items-center justify-center border-2 border-[#1c1c1e]`}
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
            })
          )}
        </section>
      )}

      <FriendDetailsModal
        amigo={amigoSelecionado}
        isOpen={!!amigoSelecionado}
        onClose={() => {
          setAmigoSelecionado(null);
          carregarDados();
        }}
        onDelete={handleExcluirAmigo}
        update={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
      />

      <AddFriendModal
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
        onSuccess={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
      />

      <AddGroupModal
        isOpen={isAddGroupOpen}
        onClose={() => setIsAddGroupOpen(false)}
        onSuccess={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
      />

      <GroupDetailsModal
        grupoId={grupoSelecionadoId}
        isOpen={!!grupoSelecionadoId}
        onClose={() => {
          setGrupoSelecionadoId(null);
          carregarDados();
        }}
        onChanged={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}