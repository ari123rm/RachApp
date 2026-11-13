// src/components/Amigos.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Star,
  LoaderCircle,
  ChevronRight,
  Check,
  UserCheck,
  Users,
  BadgeCheck,
  X,
  BookUser,
  UserPlus,
  RefreshCw,
  Phone,
} from 'lucide-react';
import { formatPhoneBR, stripCountryCode, phonesMatchBR } from '../utils/phoneFormatter';
import { getCachedPhoneContacts, requestDeviceContacts } from '../utils/phoneContacts';
import { FriendCard } from './FriendCard';
import { FriendDetailsModal } from './FriendDetailsModal';
import { AddFriendModal } from './AddFriendModal';
import { AddGroupModal } from './AddGroupModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import { ImportContactsModal } from './ImportContactsModal';
import { TopBar } from './TopBar';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import { getAvatarColor } from '../utils/avatarColor';
import type { Grupo } from '../types';

export function Amigos({
  onDataChange,
  dataVersion,
  subTab: externalSubTab,
  onSubTabChange,
}: {
  onDataChange?: () => void;
  dataVersion?: number;
  subTab?: 'amigos' | 'grupos';
  onSubTabChange?: (tab: 'amigos' | 'grupos') => void;
}) {
  const [internalSubTab, setInternalSubTab] = useState<'amigos' | 'grupos'>('amigos');
  const subTab = externalSubTab ?? internalSubTab;
  const setSubTab = (tab: 'amigos' | 'grupos') => {
    setInternalSubTab(tab);
    onSubTabChange?.(tab);
  };
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
  const [usuariosComConta, setUsuariosComConta] = useState<any[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [isSyncingAgenda, setIsSyncingAgenda] = useState(false);

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isImportContactsOpen, setIsImportContactsOpen] = useState(false);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);

  const isFirstLoadRef = useRef(true);

  const carregarDados = async (showLoading = isFirstLoadRef.current) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const cachedPhoneContacts = getCachedPhoneContacts().map((c) => ({
        name: c.name,
        phone: c.cleanPhone || c.phone,
      }));

      const [
        sessionUser,
        dadosAmigos,
        dadosGrupos,
        dadosSolicitacoes,
        dadosConvites,
        dadosUsuariosComConta,
      ] = await Promise.all([
        dbService.auth.getSessionUser(),
        dbService.amigos.getAll(),
        dbService.grupos.getAll(),
        dbService.amigos.getPendingRequests(),
        dbService.grupos.getPendingInvitations(),
        dbService.amigos.discoverRegisteredUsers(cachedPhoneContacts),
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
            cor: amigo.cor || amigo.color || 'bg-teal-600',
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
      setUsuariosComConta(dadosUsuariosComConta);
    } catch (error) {
      console.error('Erro ao buscar amigos e grupos:', error);
    } finally {
      setIsLoading(false);
      isFirstLoadRef.current = false;
    }
  };

  useEffect(() => {
    carregarDados(true);
    let isInitialSync = true;
    const unsub = dbService.sync.subscribe((st) => {
      if (isInitialSync) {
        isInitialSync = false;
        return;
      }
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

  const handleSincronizarAgenda = async () => {
    setIsSyncingAgenda(true);
    try {
      const res = await requestDeviceContacts();
      if (res.status === 'ok') {
        const discovered = await dbService.amigos.discoverRegisteredUsers(
          res.contacts.map((c) => ({ name: c.name, phone: c.cleanPhone || c.phone }))
        );
        setUsuariosComConta(discovered);
      } else if (res.status === 'permission_denied') {
        alert(
          'Permissão de acesso aos contatos negada. Permita o acesso aos contatos para encontrar amigos da sua agenda.'
        );
      } else if (res.status === 'unsupported_apk' || res.status === 'unsupported_browser') {
        setIsImportContactsOpen(true);
      }
    } finally {
      setIsSyncingAgenda(false);
    }
  };

  const handleAdicionarUsuarioComConta = async (user: any) => {
    setAddingUserId(user.id);
    try {
      const displayName = (user.contact_name || user.name || 'Amigo').trim().slice(0, 30);
      const cleanPhone = stripCountryCode(user.phone || '');
      await dbService.amigos.create({
        nome: displayName,
        telefone: cleanPhone,
        pix_key: user.pix_key || '',
        cor: user.color || 'bg-teal-600',
        favorito: false,
      });
      setUsuariosComConta((prev) => prev.filter((u) => u.id !== user.id));
      await carregarDados(false);
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(err?.message || 'Erro ao adicionar amigo.');
    } finally {
      setAddingUserId(null);
    }
  };

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

      if (filtroAmigos === 'verificados') {
        if (!amigo.has_account && !amigo.is_registered) {
          return false;
        }
      }

      if (filtroAmigos === 'favoritos') {
        if (!amigo.favorito) {
          return false;
        }
      }

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

  const usuariosComContaFiltrados = useMemo(() => {
    return usuariosComConta.filter((u) => {
      if (u.is_in_contacts === false) return false;

      const uPhone = stripCountryCode(u.phone || '');
      const jaEhAmigo = amigos.some((f) => {
        const fPhone = stripCountryCode(f.telefone || f.phone || '');
        return Boolean(uPhone && fPhone && phonesMatchBR(uPhone, fPhone));
      });
      if (jaEhAmigo) return false;

      if (buscaAmigos.trim()) {
        const termo = buscaAmigos.trim().toLowerCase();
        const termoDigits = termo.replace(/\D/g, '');
        const nomeMatch =
          (u.name || '').toLowerCase().includes(termo) ||
          (u.contact_name || '').toLowerCase().includes(termo);
        const foneMatch =
          (u.phone || '').toLowerCase().includes(termo) ||
          (termoDigits.length >= 3 && uPhone.includes(termoDigits));
        if (!nomeMatch && !foneMatch) return false;
      }

      return true;
    });
  }, [usuariosComConta, amigos, buscaAmigos]);

  const contagemMeusGrupos = useMemo(() => {
    if (!currentUserId) return 0;
    return grupos.filter((g) => g.created_by === currentUserId).length;
  }, [grupos, currentUserId]);

  const gruposFiltrados = useMemo(() => {
    return grupos.filter((grupo) => {
      if (filtroGrupos === 'meus' && currentUserId) {
        if (grupo.created_by !== currentUserId) {
          return false;
        }
      }

      if (buscaGrupos.trim()) {
        const termo = buscaGrupos.trim().toLowerCase();
        const termoDigits = termo.replace(/\D/g, '');

        const groupNameMatch = (grupo.name || '').toLowerCase().includes(termo);
        const creatorMatch =
          (grupo as any).owner?.name?.toLowerCase().includes(termo) ||
          (grupo as any).creator_name?.toLowerCase().includes(termo);

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
      <div className="space-y-4">
        <TopBar title="Contatos" subtitle="Carregando amigos e grupos..." />
        <div className="flex flex-col items-center justify-center h-64 text-[var(--primary)]">
          <LoaderCircle size={40} strokeWidth={2} className="animate-spin mb-4" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Carregando amigos e grupos...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <TopBar
        title="Contatos"
        subtitle={
          subTab === 'amigos'
            ? `${amigos.length} ${amigos.length === 1 ? 'amigo cadastrado' : 'amigos cadastrados'}`
            : `${grupos.length} ${grupos.length === 1 ? 'grupo ativo' : 'grupos ativos'}`
        }
      />

      <div className="space-y-3.5">
        {/* Barra de alternância Amigos / Grupos com indicador deslizante */}
        <div className="flex items-center justify-between gap-2">
          <div className="relative bg-[var(--bg-subtle)] p-1 rounded-xl flex items-center border border-[var(--border-color)] flex-1">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[var(--primary)] rounded-lg transition-all duration-300 ease-out shadow-sm ${
                subTab === 'amigos' ? 'left-1' : 'left-[calc(50%+2px)]'
              }`}
            />
            <button
              onClick={() => setSubTab('amigos')}
              className={`relative z-10 flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                subTab === 'amigos'
                  ? 'text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>Amigos</span>
              {solicitacoesAmizade.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#F43F5E] text-white text-xs flex items-center justify-center font-bold">
                  {solicitacoesAmizade.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSubTab('grupos')}
              className={`relative z-10 flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                subTab === 'grupos'
                  ? 'text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>Grupos</span>
              {convitesGrupo.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#F43F5E] text-white text-xs flex items-center justify-center font-bold">
                  {convitesGrupo.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Barra de Busca Dinâmica (48px height, 12px radius) */}
        <div className="h-12 bg-[var(--bg-surface)] rounded-xl flex items-center px-4 text-[var(--text-secondary)] border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15 transition-all shadow-sm">
          <Search size={18} strokeWidth={2} className="mr-3 shrink-0" />
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
            className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
          />
          {(subTab === 'amigos' ? buscaAmigos : buscaGrupos) && (
            <button
              type="button"
              onClick={() => {
                if (subTab === 'amigos') setBuscaAmigos('');
                else setBuscaGrupos('');
              }}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-full transition-colors ml-1"
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Chips de Filtros Rápidos */}
        {subTab === 'amigos' ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide pt-0.5">
            <button
              type="button"
              onClick={() => setFiltroAmigos('todos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 border ${
                filtroAmigos === 'todos'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              Todos ({amigos.length})
            </button>

            <button
              type="button"
              onClick={() => setFiltroAmigos(filtroAmigos === 'verificados' ? 'todos' : 'verificados')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 border ${
                filtroAmigos === 'verificados'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              <BadgeCheck
                size={14}
                strokeWidth={2}
                className={filtroAmigos === 'verificados' ? 'text-white' : 'text-[var(--primary)]'}
              />
              Verificados ({contagemVerificados})
            </button>

            <button
              type="button"
              onClick={() => setFiltroAmigos(filtroAmigos === 'favoritos' ? 'todos' : 'favoritos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 border ${
                filtroAmigos === 'favoritos'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              <Star
                size={13}
                strokeWidth={2}
                className={
                  filtroAmigos === 'favoritos'
                    ? 'fill-white text-white'
                    : 'fill-[#F59E0B] text-[#F59E0B]'
                }
              />
              Favoritos ({contagemFavoritos})
            </button>

            <button
              type="button"
              onClick={() => setFiltroAmigos(filtroAmigos === 'pendentes' ? 'todos' : 'pendentes')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 border ${
                filtroAmigos === 'pendentes'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
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
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 border ${
                filtroGrupos === 'todos'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              Todos ({grupos.length})
            </button>

            <button
              type="button"
              onClick={() => setFiltroGrupos(filtroGrupos === 'meus' ? 'todos' : 'meus')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 border ${
                filtroGrupos === 'meus'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              Criados por mim ({contagemMeusGrupos})
            </button>

            {convitesGrupo.length > 0 && (
              <button
                type="button"
                onClick={() => setFiltroGrupos(filtroGrupos === 'convites' ? 'todos' : 'convites')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 border ${
                  filtroGrupos === 'convites'
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
                }`}
              >
                Convites ({convitesGrupo.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Painel ativo */}
      <div className="w-full">
        {subTab === 'amigos' ? (
          /* PAINEL AMIGOS */
          <div className="w-full space-y-6">
            {/* SOLICITAÇÕES DE AMIZADE PENDENTES */}
            {solicitacoesAmizade.length > 0 && (
              <section className="ds-card p-4 border-[#F59E0B]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="text-[#F59E0B]" size={18} strokeWidth={2} />
                    <h2 className="text-sm font-display font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Solicitações de Amizade ({solicitacoesAmizade.length})
                    </h2>
                  </div>
                  <span className="text-xs text-[#F59E0B] font-semibold bg-[var(--amber-bg)] border border-[var(--amber-border)] px-2.5 py-0.5 rounded-full">
                    Pendente
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Confirme as amizades para visualizar os rachas compartilhados.
                </p>

                <div className="space-y-2.5 pt-1">
                  {solicitacoesAmizade.map((req) => {
                    const isProcessing = actionLoadingId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="bg-[var(--bg-subtle)] p-3.5 rounded-xl border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            style={
                              req.sender?.avatar_url
                                ? undefined
                                : { backgroundColor: getAvatarColor(req.sender?.color || req.sender?.cor) }
                            }
                            className="w-12 h-12 rounded-full overflow-hidden text-white font-display font-bold text-base flex items-center justify-center shadow-sm shrink-0"
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
                            <p className="text-base font-display font-semibold text-[var(--text-primary)]">
                              {req.sender?.name || 'Usuário'}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {req.sender?.phone || 'Telefone não informado'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            disabled={isProcessing}
                            onClick={() => handleRecusarAmizade(req.id)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#F43F5E] hover:bg-[var(--rose-bg)] transition-colors disabled:opacity-50"
                          >
                            Recusar
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleAceitarAmizade(req.id)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white active:scale-95 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check size={14} strokeWidth={2} />
                            Confirmar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* FAVORITOS (Avatares Circulares 64x64px) */}
            {buscaAmigos === '' && filtroAmigos === 'todos' && favoritos.length > 0 && (
              <section className="min-w-0">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-h2 text-[var(--text-primary)]">Favoritos</h2>
                </div>
                <div
                  data-horizontal-scroll="true"
                  className="flex gap-4 overflow-x-auto pb-3 pt-1 px-0.5 scrollbar-hide w-full"
                >
                  {favoritos.map((amigo) => (
                    <div
                      key={amigo.id}
                      onClick={() => setAmigoSelecionado(amigo)}
                      className="flex flex-col items-center shrink-0 w-[72px] min-w-[72px] cursor-pointer active:scale-95 transition-transform select-none"
                    >
                      <div className="relative mb-2 shrink-0">
                        <div
                          style={
                            amigo.avatar_url
                              ? undefined
                              : { backgroundColor: getAvatarColor(amigo.cor || amigo.color) }
                          }
                          className="w-16 h-16 shrink-0 rounded-full overflow-hidden flex items-center justify-center shadow-sm border-2 border-[var(--bg-surface)]"
                        >
                          {amigo.avatar_url ? (
                            <img
                              src={amigo.avatar_url}
                              alt={amigo.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl font-display font-bold text-white">
                              {amigo.nome[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full p-1 shadow-sm">
                          <Star size={13} strokeWidth={2} className="text-[#F59E0B] fill-[#F59E0B]" />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate w-full text-center flex items-center justify-center gap-1">
                        <span className="truncate">{amigo.nome.split(' ')[0]}</span>
                        {(amigo.has_account || amigo.is_registered) && (
                          <BadgeCheck size={13} strokeWidth={2} className="text-[var(--primary)] fill-[var(--primary-light)] shrink-0" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* LISTA DE AMIGOS */}
            <section className="pb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-h2 text-[var(--text-primary)]">
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
                <span className="text-caption text-[var(--text-secondary)]">
                  {amigosFiltrados.length} {amigosFiltrados.length === 1 ? 'amigo' : 'amigos'}
                </span>
              </div>

              <div className="space-y-3">
                {amigosFiltrados.length === 0 ? (
                  <div className="ds-card p-8 text-center space-y-3">
                    <p className="font-display font-semibold text-[var(--text-primary)]">
                      Nenhum amigo encontrado
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
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
                        className="bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
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

            {/* AMIGOS QUE JÁ POSSUEM CONTA */}
            <section className="pb-10">
              <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <BadgeCheck size={18} strokeWidth={2} className="text-[var(--primary)] shrink-0" />
                  <h2 className="text-h2 text-[var(--text-primary)] truncate">
                    Amigos com conta
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleSincronizarAgenda}
                  disabled={isSyncingAgenda}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <RefreshCw size={13} strokeWidth={2} className={isSyncingAgenda ? 'animate-spin' : ''} />
                  <span className="hidden xs:inline">Sincronizar agenda</span>
                  <span className="xs:hidden">Sincronizar</span>
                </button>
              </div>

              {usuariosComContaFiltrados.length === 0 ? (
                <div className="ds-card p-6 text-center space-y-3">
                  <p className="text-sm font-display font-semibold text-[var(--text-primary)]">
                    Nenhum novo contato com conta encontrado
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Sincronize sua agenda do celular para encontrar contatos que já têm conta no RachApp.
                  </p>
                  <button
                    type="button"
                    onClick={handleSincronizarAgenda}
                    disabled={isSyncingAgenda}
                    className="bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <BookUser size={15} strokeWidth={2} />
                    <span>Buscar na minha agenda</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {usuariosComContaFiltrados.map((user) => {
                    const isAdding = addingUserId === user.id;
                    const displayName = user.contact_name || user.name || 'Usuário';
                    const subName =
                      user.contact_name &&
                      user.name &&
                      user.contact_name.trim().toLowerCase() !== user.name.trim().toLowerCase()
                        ? user.name
                        : null;

                    return (
                      <div
                        key={user.id}
                        className="ds-card p-4 flex items-center justify-between gap-3 hover:border-[var(--primary)]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-1">
                          <div
                            style={
                              user.avatar_url
                                ? undefined
                                : { backgroundColor: getAvatarColor(user.color || 'bg-teal-600') }
                            }
                            className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-display font-bold text-base shrink-0 shadow-sm"
                          >
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              displayName[0]?.toUpperCase() || 'U'
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h3 className="text-base font-display font-semibold text-[var(--text-primary)] truncate">
                                {displayName}
                              </h3>
                              <BadgeCheck
                                size={15}
                                strokeWidth={2}
                                className="text-[var(--primary)] fill-[var(--primary-light)] shrink-0"
                              />
                              {user.is_in_contacts && (
                                <span className="text-xs font-semibold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-full shrink-0">
                                  Agenda
                                </span>
                              )}
                            </div>

                            {subName && (
                              <p className="text-xs text-[var(--text-secondary)] truncate">
                                Conta: {subName}
                              </p>
                            )}

                            <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5 truncate">
                              <Phone size={12} strokeWidth={2} className="text-[var(--text-secondary)] shrink-0" />
                              <span>{formatPhoneBR(stripCountryCode(user.phone || ''))}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isAdding}
                          onClick={() => handleAdicionarUsuarioComConta(user)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white active:scale-95 transition-all shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                          {isAdding ? (
                            <LoaderCircle size={14} strokeWidth={2} className="animate-spin" />
                          ) : (
                            <UserPlus size={14} strokeWidth={2} />
                          )}
                          <span>Adicionar</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* PAINEL GRUPOS */
          <div className="w-full space-y-4">
            {/* CONVITES DE GRUPO PENDENTES */}
            {convitesGrupo.length > 0 && (
              <div className="ds-card p-4 border-[#F59E0B]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="text-[#F59E0B]" size={18} strokeWidth={2} />
                    <h2 className="text-sm font-display font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Convites de Grupo ({convitesGrupo.length})
                    </h2>
                  </div>
                  <span className="text-xs text-[#F59E0B] font-semibold bg-[var(--amber-bg)] border border-[var(--amber-border)] px-2.5 py-0.5 rounded-full">
                    Pendente
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Aceite os convites para acessar as despesas dos grupos.
                </p>

                <div className="space-y-2.5 pt-1">
                  {convitesGrupo.map((inv) => {
                    const isProcessing = actionLoadingId === inv.id;
                    return (
                      <div
                        key={inv.id}
                        className="bg-[var(--bg-subtle)] p-3.5 rounded-xl border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--primary)] text-white font-display font-bold text-base flex items-center justify-center shadow-sm shrink-0">
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
                            <p className="text-base font-display font-semibold text-[var(--text-primary)]">
                              {inv.group?.name}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              Criado por{' '}
                              <span className="font-medium text-[var(--text-primary)]">
                                {inv.group?.creator_name}
                              </span>{' '}
                              • {inv.group?.members_count || 1} membros
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            disabled={isProcessing}
                            onClick={() => handleRecusarGrupo(inv.id)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#F43F5E] hover:bg-[var(--rose-bg)] transition-colors disabled:opacity-50"
                          >
                            Recusar
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleAceitarGrupo(inv.id)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white active:scale-95 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check size={14} strokeWidth={2} />
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
                <h2 className="text-h2 text-[var(--text-primary)]">
                  {buscaGrupos
                    ? 'Resultados da busca'
                    : filtroGrupos === 'meus'
                    ? 'Grupos Criados por Mim'
                    : 'Todos os Grupos'}
                </h2>
                <span className="text-caption text-[var(--text-secondary)]">
                  {gruposFiltrados.length} {gruposFiltrados.length === 1 ? 'grupo' : 'grupos'}
                </span>
              </div>

              {grupos.length === 0 ? (
                <div className="ds-card p-8 text-center">
                  <p className="text-[var(--text-secondary)] mb-3">
                    Você ainda não faz parte de nenhum grupo.
                  </p>
                  <button
                    onClick={() => setIsAddGroupOpen(true)}
                    className="text-[var(--primary)] font-semibold text-sm hover:underline"
                  >
                    + Criar novo grupo
                  </button>
                </div>
              ) : gruposFiltrados.length === 0 ? (
                <div className="ds-card p-8 text-center space-y-3">
                  <p className="font-display font-semibold text-[var(--text-primary)]">
                    Nenhum grupo encontrado
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Tente buscar por outro nome de grupo ou participante.
                  </p>
                  {(buscaGrupos || filtroGrupos !== 'todos') && (
                    <button
                      type="button"
                      onClick={() => {
                        setBuscaGrupos('');
                        setFiltroGrupos('todos');
                      }}
                      className="bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
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
                      className="ds-card p-4 flex items-center justify-between cursor-pointer hover:border-[var(--primary)]/40 transition-colors gap-3"
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
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

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-display font-semibold text-[var(--text-primary)] text-base sm:text-[18px] truncate">
                              {grupo.name}
                            </h3>
                            {currentUserId && grupo.created_by === currentUserId && (
                              <span className="text-xs font-semibold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-full shrink-0">
                                Criador
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-2.5">
                            {totalMembers} {totalMembers === 1 ? 'participante' : 'participantes'}
                          </p>

                          {matchedMemberName && (
                            <div className="mb-2.5 inline-flex items-center gap-1.5 text-xs text-[var(--primary)] bg-[var(--primary-light)] px-2.5 py-0.5 rounded-lg font-medium">
                              <UserCheck size={13} strokeWidth={2} className="shrink-0" />
                              <span className="truncate">Participante: {matchedMemberName}</span>
                            </div>
                          )}

                          {/* Pilha de Avatares 32x32px (w-8 h-8) com borda de 2px */}
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
                      <ChevronRight size={20} strokeWidth={2} className="text-[var(--text-secondary)] shrink-0" />
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

      <ImportContactsModal
        isOpen={isImportContactsOpen}
        onClose={() => setIsImportContactsOpen(false)}
        existingFriends={amigos}
        onImported={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}
