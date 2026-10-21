// src/components/Amigos.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Star,
  LoaderCircle,
  UserPlus,
  ChevronRight,
  Check,
  UserCheck,
  Users,
  BadgeCheck,
  X,
} from 'lucide-react';
import { FriendCard } from './FriendCard';
import { FriendDetailsModal } from './FriendDetailsModal';
import { AddFriendModal } from './AddFriendModal';
import { AddGroupModal } from './AddGroupModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import { getAvatarColor } from '../utils/avatarColor';
import type { Grupo } from '../types';

export function Amigos({ onDataChange, dataVersion }: { onDataChange?: () => void; dataVersion?: number }) {
  const [subTab, setSubTab] = useState<'amigos' | 'grupos'>('amigos');
  const [buscaAmigos, setBuscaAmigos] = useState('');
  const [buscaGrupos, setBuscaGrupos] = useState('');
  const [filtroAmigos, setFiltroAmigos] = useState<'todos' | 'verificados' | 'favoritos' | 'pendentes'>('todos');
  const [filtroGrupos, setFiltroGrupos] = useState<'todos' | 'meus' | 'convites'>('todos');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

  const [amigoSelecionado, setAmigoSelecionado] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [amigos, setAmigos] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [solicitacoesAmizade, setSolicitacoesAmizade] = useState<any[]>([]);
  const [convitesGrupo, setConvitesGrupo] = useState<any[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);

  const isFirstLoadRef = useRef(true);

  const carregarDados = async (showLoading = isFirstLoadRef.current) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const [sessionUser, dadosAmigos, dadosGrupos, dadosSolicitacoes, dadosConvites] = await Promise.all([
        dbService.auth.getSessionUser(),
        dbService.amigos.getAll(),
        dbService.grupos.getAll(),
        dbService.amigos.getPendingRequests(),
        dbService.grupos.getPendingInvitations(),
      ]);

      if (sessionUser?.id) {
        setCurrentUserId(sessionUser.id);
      }
      setMyAvatarUrl(sessionUser?.avatar_url || null);

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
            has_account: amigo.has_account ?? amigo.is_registered ?? false,
            divida: dividaFormatada,
            dividaNumerica: valorDevido,
            voceDeveNumerico: Number(amigo.voceDeveNumerico || 0),
          };
        })
      );

      setAmigos(amigosComValores);
      setGrupos(dadosGrupos);
      setSolicitacoesAmizade(dadosSolicitacoes);
      setConvitesGrupo(dadosConvites);
    } catch (error) {
      console.error('Erro ao buscar amigos e grupos:', error);
    } finally {
      setIsLoading(false);
      isFirstLoadRef.current = false;
    }
  };

  useEffect(() => {
    carregarDados(true);
    const unsub = dbService.sync.subscribe((st) => {
      if (st.state === 'synced') {
        carregarDados(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (dataVersion !== undefined && dataVersion > 0) {
      carregarDados(false);
    }
  }, [dataVersion]);

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

  const handleAceitarAmizade = async (reqId: string) => {
    setActionLoadingId(reqId);
    try {
      await dbService.amigos.acceptRequest(reqId);
      setSolicitacoesAmizade((prev) => prev.filter((r) => r.id !== reqId));
      await carregarDados();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao aceitar solicitação de amizade.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRecusarAmizade = async (reqId: string) => {
    setActionLoadingId(reqId);
    try {
      await dbService.amigos.rejectRequest(reqId);
      setSolicitacoesAmizade((prev) => prev.filter((r) => r.id !== reqId));
      await carregarDados();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao recusar solicitação de amizade.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAceitarGrupo = async (invId: string) => {
    setActionLoadingId(invId);
    try {
      await dbService.grupos.acceptInvitation(invId);
      setConvitesGrupo((prev) => prev.filter((i) => i.id !== invId));
      await carregarDados();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao aceitar convite do grupo.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRecusarGrupo = async (invId: string) => {
    setActionLoadingId(invId);
    try {
      await dbService.grupos.rejectInvitation(invId);
      setConvitesGrupo((prev) => prev.filter((i) => i.id !== invId));
      await carregarDados();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao recusar convite do grupo.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Contagens para chips de filtro de amigos
  const contagemVerificados = useMemo(() => {
    return amigos.filter((a) => a.has_account || a.is_registered).length;
  }, [amigos]);

  const contagemFavoritos = useMemo(() => {
    return amigos.filter((a) => a.favorito).length;
  }, [amigos]);

  const contagemPendentes = useMemo(() => {
    return amigos.filter((a) => {
      const dev = Number(a.dividaNumerica || 0);
      const vd = Number(a.voceDeveNumerico || 0);
      return dev > 0.01 || vd > 0.01;
    }).length;
  }, [amigos]);

  const amigosFiltrados = useMemo(() => {
    return amigos.filter((amigo) => {
      // 1. Busca textual por nome ou telefone
      if (buscaAmigos.trim()) {
        const termo = buscaAmigos.trim().toLowerCase();
        const nomeMatch = (amigo.nome || amigo.name || '').toLowerCase().includes(termo);
        const foneAmigo = (amigo.telefone || amigo.phone || '').replace(/\D/g, '');
        const termoDigits = termo.replace(/\D/g, '');
        const telefoneMatch =
          (amigo.telefone || amigo.phone || '').toLowerCase().includes(termo) ||
          (termoDigits.length >= 3 && foneAmigo.includes(termoDigits));

        if (!nomeMatch && !telefoneMatch) {
          return false;
        }
      }

      // 2. Filtro de verificado
      if (filtroAmigos === 'verificados') {
        if (!amigo.has_account && !amigo.is_registered) {
          return false;
        }
      }

      // 3. Filtro de favoritos
      if (filtroAmigos === 'favoritos') {
        if (!amigo.favorito) {
          return false;
        }
      }

      // 4. Filtro de pendentes
      if (filtroAmigos === 'pendentes') {
        const dev = Number(amigo.dividaNumerica || 0);
        const vd = Number(amigo.voceDeveNumerico || 0);
        if (dev <= 0.01 && vd <= 0.01) {
          return false;
        }
      }

      return true;
    });
  }, [amigos, buscaAmigos, filtroAmigos]);

  const favoritos = useMemo(() => {
    return amigos.filter((a) => a.favorito);
  }, [amigos]);

  // Contagens para chips de filtro de grupos
  const contagemMeusGrupos = useMemo(() => {
    if (!currentUserId) return 0;
    return grupos.filter((g) => g.created_by === currentUserId).length;
  }, [grupos, currentUserId]);

  const gruposFiltrados = useMemo(() => {
    return grupos.filter((grupo) => {
      // 1. Filtro rápido (Meus grupos)
      if (filtroGrupos === 'meus' && currentUserId) {
        if (grupo.created_by !== currentUserId) {
          return false;
        }
      }

      // 2. Busca textual por nome do grupo, criador ou participantes (amigos e usuários)
      if (buscaGrupos.trim()) {
        const termo = buscaGrupos.trim().toLowerCase();
        const termoDigits = termo.replace(/\D/g, '');

        // Match no nome do grupo
        const groupNameMatch = (grupo.name || '').toLowerCase().includes(termo);

        // Match no criador / dono
        const creatorMatch =
          (grupo as any).owner?.name?.toLowerCase().includes(termo) ||
          (grupo as any).creator_name?.toLowerCase().includes(termo);

        // Match em qualquer participante (friend ou user) por nome ou telefone
        const memberMatch = (grupo.members || []).some((m) => {
          const name = (m.friend?.name || m.user?.name || '').toLowerCase();
          const phone = (m.friend?.phone || m.user?.phone || '').replace(/\D/g, '');
          const matchesName = name.includes(termo);
          const matchesPhone = termoDigits.length >= 3 && phone.includes(termoDigits);
          return matchesName || matchesPhone;
        });

        if (!groupNameMatch && !creatorMatch && !memberMatch) {
          return false;
        }
      }

      return true;
    });
  }, [grupos, buscaGrupos, filtroGrupos, currentUserId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#2DD4BF]">
        <LoaderCircle size={40} className="animate-spin mb-4" />
        <p className="text-gray-400 font-medium">Carregando amigos e grupos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <header className="mt-2 space-y-3.5">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Amigos & Grupos</h1>
        </div>

        {/* Barra de alternância Amigos / Grupos com indicador deslizante + Botão Novo */}
        <div className="flex items-center justify-between gap-2">
          <div className="relative bg-[#1c1c1e] p-1 rounded-full flex items-center border border-white/5 flex-1">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#2DD4BF] rounded-full transition-all duration-300 ease-out shadow-sm ${
                subTab === 'amigos' ? 'left-1' : 'left-[calc(50%+2px)]'
              }`}
            />
            <button
              onClick={() => setSubTab('amigos')}
              className={`relative z-10 flex-1 py-2 rounded-full text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                subTab === 'amigos'
                  ? 'text-[#05080f]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>Amigos</span>
              {solicitacoesAmizade.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {solicitacoesAmizade.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSubTab('grupos')}
              className={`relative z-10 flex-1 py-2 rounded-full text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                subTab === 'grupos'
                  ? 'text-[#05080f]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>Grupos</span>
              {convitesGrupo.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {convitesGrupo.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() =>
              subTab === 'amigos' ? setIsAddFriendOpen(true) : setIsAddGroupOpen(true)
            }
            className="bg-[#1c1c1e] hover:bg-[#2c2c2e] text-[#2DD4BF] border border-[#2DD4BF]/30 px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <UserPlus size={15} /> Novo
          </button>
        </div>

        {/* Barra de Busca Dinâmica */}
        <div className="bg-[#1c1c1e] rounded-2xl flex items-center p-3 text-gray-400 border border-white/5 focus-within:ring-1 focus-within:ring-[#2DD4BF] focus-within:text-[#2DD4BF] transition-all">
          <Search size={20} className="mr-3 shrink-0" />
          <input
            type="text"
            placeholder={
              subTab === 'amigos'
                ? 'Buscar amigos por nome ou telefone...'
                : 'Buscar grupos por nome ou participante...'
            }
            value={subTab === 'amigos' ? buscaAmigos : buscaGrupos}
            onChange={(e) => {
              if (subTab === 'amigos') {
                setBuscaAmigos(e.target.value);
              } else {
                setBuscaGrupos(e.target.value);
              }
            }}
            className="bg-transparent w-full outline-none text-white placeholder:text-gray-500 text-sm"
          />
          {(subTab === 'amigos' ? buscaAmigos : buscaGrupos) && (
            <button
              type="button"
              onClick={() => {
                if (subTab === 'amigos') setBuscaAmigos('');
                else setBuscaGrupos('');
              }}
              className="text-gray-500 hover:text-white p-1 rounded-full transition-colors ml-1"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Chips de Filtros Rápidos */}
        {subTab === 'amigos' ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide pt-0.5">
            <button
              type="button"
              onClick={() => setFiltroAmigos('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filtroAmigos === 'todos'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              Todos ({amigos.length})
            </button>

            <button
              type="button"
              onClick={() => setFiltroAmigos(filtroAmigos === 'verificados' ? 'todos' : 'verificados')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filtroAmigos === 'verificados'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              <BadgeCheck
                size={14}
                className={filtroAmigos === 'verificados' ? 'text-[#05080f]' : 'text-[#2DD4BF]'}
              />
              Verificados ({contagemVerificados})
            </button>

            <button
              type="button"
              onClick={() => setFiltroAmigos(filtroAmigos === 'favoritos' ? 'todos' : 'favoritos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filtroAmigos === 'favoritos'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              <Star
                size={13}
                className={
                  filtroAmigos === 'favoritos'
                    ? 'fill-[#05080f] text-[#05080f]'
                    : 'fill-yellow-500 text-yellow-500'
                }
              />
              Favoritos ({contagemFavoritos})
            </button>

            <button
              type="button"
              onClick={() => setFiltroAmigos(filtroAmigos === 'pendentes' ? 'todos' : 'pendentes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filtroAmigos === 'pendentes'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              Com saldo ({contagemPendentes})
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide pt-0.5">
            <button
              type="button"
              onClick={() => setFiltroGrupos('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filtroGrupos === 'todos'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              Todos ({grupos.length})
            </button>

            <button
              type="button"
              onClick={() => setFiltroGrupos(filtroGrupos === 'meus' ? 'todos' : 'meus')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filtroGrupos === 'meus'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              Criados por mim ({contagemMeusGrupos})
            </button>

            {convitesGrupo.length > 0 && (
              <button
                type="button"
                onClick={() => setFiltroGrupos(filtroGrupos === 'convites' ? 'todos' : 'convites')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  filtroGrupos === 'convites'
                    ? 'bg-[#2DD4BF] text-[#05080f]'
                    : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                Convites ({convitesGrupo.length})
              </button>
            )}
          </div>
        )}
      </header>

      {/* Painel ativo (alternado exclusivamente pelo seletor Amigos / Grupos) */}
      <div className="w-full">
        {subTab === 'amigos' ? (
          /* PAINEL AMIGOS */
          <div className="w-full space-y-6">
            {/* SOLICITAÇÕES DE AMIZADE PENDENTES */}
            {solicitacoesAmizade.length > 0 && (
              <section className="bg-gradient-to-r from-[#1c1c1e] to-[#252528] rounded-2xl p-4 border border-[#2DD4BF]/30 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="text-[#2DD4BF]" size={18} />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Solicitações de Amizade ({solicitacoesAmizade.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-[#2DD4BF] font-semibold bg-[#2DD4BF]/10 px-2.5 py-0.5 rounded-full">
                    Pendente
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Confirme as amizades para visualizar os rachas compartilhados.
                </p>

                <div className="space-y-2.5 pt-1">
                  {solicitacoesAmizade.map((req) => {
                    const isProcessing = actionLoadingId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="bg-[#121214] p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            style={
                              req.sender?.avatar_url
                                ? undefined
                                : { backgroundColor: getAvatarColor(req.sender?.color || req.sender?.cor) }
                            }
                            className="w-10 h-10 rounded-2xl overflow-hidden text-white font-bold text-sm flex items-center justify-center shadow shrink-0"
                          >
                            {req.sender?.avatar_url ? (
                              <img
                                src={req.sender.avatar_url}
                                alt={req.sender?.name || 'Usuário'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (req.sender?.name || 'A')[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">
                              {req.sender?.name || 'Usuário'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {req.sender?.phone || 'Telefone não informado'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            disabled={isProcessing}
                            onClick={() => handleRecusarAmizade(req.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            Recusar
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleAceitarAmizade(req.id)}
                            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#2DD4BF] text-[#05080f] hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check size={14} />
                            Confirmar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* FAVORITOS */}
            {buscaAmigos === '' && filtroAmigos === 'todos' && favoritos.length > 0 && (
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
                          style={
                            amigo.avatar_url
                              ? undefined
                              : { backgroundColor: getAvatarColor(amigo.cor || amigo.color) }
                          }
                          className="w-16 h-16 rounded-3xl overflow-hidden flex items-center justify-center shadow-lg border border-white/10"
                        >
                          {amigo.avatar_url ? (
                            <img
                              src={amigo.avatar_url}
                              alt={amigo.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl font-black text-white">
                              {amigo.nome[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-[#05080f] rounded-full p-1">
                          <Star size={16} className="text-yellow-500 fill-yellow-500" />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-300 truncate w-full text-center flex items-center justify-center gap-1">
                        <span className="truncate">{amigo.nome.split(' ')[0]}</span>
                        {(amigo.has_account || amigo.is_registered) && (
                          <BadgeCheck size={13} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* LISTA DE AMIGOS */}
            <section className="pb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  {buscaAmigos
                    ? 'Resultados da busca'
                    : filtroAmigos === 'verificados'
                    ? 'Amigos Verificados'
                    : filtroAmigos === 'favoritos'
                    ? 'Amigos Favoritos'
                    : filtroAmigos === 'pendentes'
                    ? 'Amigos com Saldo Pendente'
                    : 'Todos os Amigos'}
                </h2>
                <span className="text-xs text-gray-500 font-medium">
                  {amigosFiltrados.length} {amigosFiltrados.length === 1 ? 'amigo' : 'amigos'}
                </span>
              </div>

              <div className="space-y-3">
                {amigosFiltrados.length === 0 ? (
                  <div className="bg-[#1c1c1e] p-8 rounded-3xl text-center border border-white/5 space-y-3">
                    <p className="text-gray-400 font-medium">Nenhum amigo encontrado</p>
                    <p className="text-xs text-gray-500">
                      {filtroAmigos === 'verificados'
                        ? 'Nenhum amigo verificado encontrado com o filtro atual.'
                        : 'Tente ajustar ou limpar sua busca/filtros.'}
                    </p>
                    {(buscaAmigos || filtroAmigos !== 'todos') && (
                      <button
                        type="button"
                        onClick={() => {
                          setBuscaAmigos('');
                          setFiltroAmigos('todos');
                        }}
                        className="bg-[#2DD4BF]/15 text-[#2DD4BF] hover:bg-[#2DD4BF]/25 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
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
          </div>
        ) : (
          /* PAINEL GRUPOS */
          <div className="w-full space-y-4">
            {/* CONVITES DE GRUPO PENDENTES */}
            {convitesGrupo.length > 0 && (
              <div className="bg-gradient-to-r from-[#1c1c1e] to-[#252528] rounded-2xl p-4 border border-[#2DD4BF]/30 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="text-[#2DD4BF]" size={18} />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Convites de Grupo ({convitesGrupo.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-[#2DD4BF] font-semibold bg-[#2DD4BF]/10 px-2.5 py-0.5 rounded-full">
                    Pendente
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Aceite os convites para acessar as despesas dos grupos.
                </p>

                <div className="space-y-2.5 pt-1">
                  {convitesGrupo.map((inv) => {
                    const isProcessing = actionLoadingId === inv.id;
                    return (
                      <div
                        key={inv.id}
                        className="bg-[#121214] p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl overflow-hidden bg-indigo-500 text-white font-bold text-sm flex items-center justify-center shadow shrink-0">
                            {inv.group?.avatar_url ? (
                              <img
                                src={inv.group.avatar_url}
                                alt={inv.group?.name || 'Grupo'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (inv.group?.name || 'G')[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{inv.group?.name}</p>
                            <p className="text-xs text-gray-400">
                              Criado por <span className="text-gray-200">{inv.group?.creator_name}</span> • {inv.group?.members_count || 1} membros
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            disabled={isProcessing}
                            onClick={() => handleRecusarGrupo(inv.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            Recusar
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleAceitarGrupo(inv.id)}
                            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#2DD4BF] text-[#05080f] hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check size={14} />
                            Aceitar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* LISTAGEM DE GRUPOS */}
            <div className="space-y-3 pb-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  {buscaGrupos
                    ? 'Resultados da busca'
                    : filtroGrupos === 'meus'
                    ? 'Grupos Criados por Mim'
                    : 'Todos os Grupos'}
                </h2>
                <span className="text-xs text-gray-500 font-medium">
                  {gruposFiltrados.length} {gruposFiltrados.length === 1 ? 'grupo' : 'grupos'}
                </span>
              </div>

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
              ) : gruposFiltrados.length === 0 ? (
                <div className="bg-[#1c1c1e] p-8 rounded-3xl text-center border border-white/5 space-y-3">
                  <p className="text-gray-400 font-medium">Nenhum grupo encontrado</p>
                  <p className="text-xs text-gray-500">
                    Tente buscar por outro nome de grupo ou participante.
                  </p>
                  {(buscaGrupos || filtroGrupos !== 'todos') && (
                    <button
                      type="button"
                      onClick={() => {
                        setBuscaGrupos('');
                        setFiltroGrupos('todos');
                      }}
                      className="bg-[#2DD4BF]/15 text-[#2DD4BF] hover:bg-[#2DD4BF]/25 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              ) : (
                gruposFiltrados.map((grupo) => {
                  const friendMembers = (grupo.members || []).filter((m) => m.friend);
                  const totalMembers = grupo._count?.members || friendMembers.length + 1;
                  const visibleFriends = friendMembers.slice(0, 3);
                  const extraCount = Math.max(0, friendMembers.length - 3);

                  // Identifica participante correspondente à busca caso a busca coincida com ele
                  const termo = buscaGrupos.trim().toLowerCase();
                  const termoDigits = termo.replace(/\D/g, '');
                  const matchedMember = termo
                    ? (grupo.members || []).find((m) => {
                        const name = (m.friend?.name || m.user?.name || '').toLowerCase();
                        const phone = (m.friend?.phone || m.user?.phone || '').replace(/\D/g, '');
                        return name.includes(termo) || (termoDigits.length >= 3 && phone.includes(termoDigits));
                      })
                    : null;

                  const matchedMemberName = matchedMember
                    ? matchedMember.friend?.name || matchedMember.user?.name || null
                    : null;

                  return (
                    <div
                      key={grupo.id}
                      onClick={() => setGrupoSelecionadoId(grupo.id)}
                      className="bg-[#1c1c1e] rounded-2xl p-4 flex items-center justify-between border border-white/5 cursor-pointer hover:bg-[#2c2c2e] transition-colors"
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0 mr-3">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-[#2DD4BF]/15 border border-[#2DD4BF]/30 flex items-center justify-center text-[#2DD4BF] shrink-0 mt-0.5">
                          {grupo.avatar_url ? (
                            <img
                              src={grupo.avatar_url}
                              alt={grupo.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Users size={22} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-bold text-base truncate">{grupo.name}</h3>
                            {currentUserId && grupo.created_by === currentUserId && (
                              <span className="text-[10px] font-semibold text-[#2DD4BF] bg-[#2DD4BF]/10 px-2 py-0.5 rounded-full shrink-0">
                                Criador
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-gray-500 mt-0.5 mb-2">
                            {totalMembers} {totalMembers === 1 ? 'participante' : 'participantes'}
                          </p>

                          {matchedMemberName && (
                            <div className="mb-2.5 inline-flex items-center gap-1.5 text-[11px] text-[#2DD4BF] bg-[#2DD4BF]/10 px-2.5 py-0.5 rounded-lg font-medium">
                              <UserCheck size={13} className="shrink-0" />
                              <span className="truncate">Participante: {matchedMemberName}</span>
                            </div>
                          )}

                          <div className="flex -space-x-2">
                            <div className="w-7 h-7 rounded-full overflow-hidden bg-[#2DD4BF] text-[#05080f] font-black text-[10px] flex items-center justify-center border-2 border-[#1c1c1e]">
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
                                  className="w-7 h-7 rounded-full overflow-hidden text-white font-bold text-[10px] flex items-center justify-center border-2 border-[#1c1c1e]"
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
                              <div className="w-7 h-7 rounded-full bg-gray-700 text-gray-200 font-bold text-[10px] flex items-center justify-center border-2 border-[#1c1c1e]">
                                +{extraCount}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-500 shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

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
