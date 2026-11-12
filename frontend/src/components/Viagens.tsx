// src/components/Viagens.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { RideCard, formatRideDateHeader } from './RideCard';
import { RideDetailsModal } from './RideDetailsModal';
import { TopBar } from './TopBar';
import {
  LoaderCircle,
  ChevronDown,
  ArrowDownUp,
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  Calendar,
  Tag,
  User,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import type { Corrida, Amigo } from '../types';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import { getRideStatusForUser } from '../utils/rideStatus';
import type { CorridaNettingInfo } from '../utils/netting';

function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type FiltroRachaStatus = 'tudo' | 'a_pagar' | 'a_receber' | 'quitados';

interface ViagensProps {
  onDataChange?: () => void;
  dataVersion?: number;
  filtroExterno?: FiltroRachaStatus;
  onFiltroExternoChange?: (f: FiltroRachaStatus) => void;
}

export function Viagens({
  onDataChange,
  dataVersion,
  filtroExterno,
  onFiltroExternoChange,
}: ViagensProps) {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [corridaSelecionadaId, setCorridaSelecionadaId] = useState<string | null>(null);

  const nettingCache = useMemo(
    () => new Map<string, Map<string, CorridaNettingInfo>>(),
    [corridas, amigos]
  );

  // Estados de Busca e Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroRachaStatus>(filtroExterno || 'tudo');
  const [filtroAmigoId, setFiltroAmigoId] = useState('');
  const [filtroTag, setFiltroTag] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  useEffect(() => {
    if (filtroExterno) {
      setFiltroStatus(filtroExterno);
      setItensVisiveis(8);
    }
  }, [filtroExterno]);

  const handleSetFiltroStatus = (f: FiltroRachaStatus) => {
    setFiltroStatus(f);
    setItensVisiveis(8);
    if (onFiltroExternoChange) {
      onFiltroExternoChange(f);
    }
  };

  const contagens = useMemo(() => {
    let aPagar = 0;
    let aReceber = 0;
    let quitados = 0;

    for (const c of corridas) {
      const st = getRideStatusForUser(c, corridas, amigos, nettingCache);
      if (st.amountYouOwe > 0.005) {
        aPagar++;
      } else if (st.amountOwedToYou > 0.005) {
        aReceber++;
      } else {
        quitados++;
      }
    }

    return {
      tudo: corridas.length,
      aPagar,
      aReceber,
      quitados,
    };
  }, [corridas, amigos, nettingCache]);

  const botoesFiltro: {
    id: FiltroRachaStatus;
    label: string;
    count: number;
    icon?: any;
    color?: string;
  }[] = [
    { id: 'tudo', label: 'Tudo', count: contagens.tudo },
    {
      id: 'a_pagar',
      label: 'A Pagar',
      count: contagens.aPagar,
      icon: TrendingDown,
      color: 'text-[#F43F5E]',
    },
    {
      id: 'a_receber',
      label: 'A Receber',
      count: contagens.aReceber,
      icon: TrendingUp,
      color: 'text-[#10B981]',
    },
    {
      id: 'quitados',
      label: 'Quitados',
      count: contagens.quitados,
      icon: CheckCircle2,
      color: 'text-[#10B981]',
    },
  ];

  const [ordemCrescente, setOrdemCrescente] = useState(false);
  const [itensVisiveis, setItensVisiveis] = useState(8);

  const isFirstLoadRef = useRef(true);

  const carregarDados = async (showLoading = isFirstLoadRef.current) => {
    if (showLoading) setIsLoading(true);
    try {
      const [listaCorridas, listaAmigos, sessionUser] = await Promise.all([
        dbService.corridas.getAll(),
        dbService.amigos.getAll(),
        dbService.auth.getSessionUser(),
      ]);
      setCorridas(listaCorridas);
      setAmigos(listaAmigos);
      setMyAvatarUrl(sessionUser?.avatar_url || null);
    } catch (error) {
      console.error('Erro ao carregar viagens:', error);
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

  const getParticipantesCompletos = (ids: string[]): Amigo[] => {
    return ids.map((id) => {
      const found = amigos.find((a) => a.id === id);
      return (
        found || {
          id,
          nome: 'Amigo',
          name: 'Amigo',
          telefone: '',
          cor: '#0F766E',
          color: '#0F766E',
          favorito: false,
        }
      );
    });
  };

  const deletarCorrida = async (id: string) => {
    const corridaAlvo = corridas.find((c) => c.id === id);
    if (corridaAlvo && corridaAlvo.isCreator === false) {
      alert('Apenas o criador do racha pode excluí-lo.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja excluir este racha?')) return;
    try {
      await dbService.corridas.delete(id);
      setCorridaSelecionadaId(null);
      await carregarDados();
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('Erro ao deletar o racha:', error);
      alert('Ocorreu um erro ao deletar o racha.');
    }
  };

  // Extrai tags únicas disponíveis dos próprios rachas mais sugestões comuns
  const tagsDisponiveis = useMemo(() => {
    const fromRides = corridas
      .map((c) => (c.tag || '').trim())
      .filter((t) => t.length > 0);
    const defaults = ['Uber', '99', 'Pizza', 'Mercado', 'Contas', 'Alimentação', 'Trabalho'];
    return Array.from(new Set([...fromRides, ...defaults]));
  }, [corridas]);

  // Aplicação dos Filtros
  const corridasFiltradas = useMemo(() => {
    return corridas.filter((c) => {
      // 0. Filtro de Status (Tudo, A Pagar, A Receber, Quitados)
      if (filtroStatus !== 'tudo') {
        const userStatus = getRideStatusForUser(c, corridas, amigos, nettingCache);
        if (filtroStatus === 'a_pagar' && !(userStatus.amountYouOwe > 0.005)) {
          return false;
        }
        if (filtroStatus === 'a_receber' && !(userStatus.amountOwedToYou > 0.005)) {
          return false;
        }
        if (
          filtroStatus === 'quitados' &&
          !(
            userStatus.status === 'quitado' ||
            (userStatus.status === 'pagante' && userStatus.amountOwedToYou <= 0.005)
          )
        ) {
          return false;
        }
      }

      // 1. Busca textual por nome, tag ou participante
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase();
        const matchTitulo = (c.titulo || c.title || '').toLowerCase().includes(termo);
        const matchTag = (c.tag || '').toLowerCase().includes(termo);
        const matchAmigoNome = (c.participantesIds || []).some((pId) => {
          const amigo = amigos.find((a) => a.id === pId);
          return (amigo?.nome || amigo?.name || '').toLowerCase().includes(termo);
        });
        const matchPayer = (c.paidByName || '').toLowerCase().includes(termo);
        if (!matchTitulo && !matchTag && !matchAmigoNome && !matchPayer) {
          return false;
        }
      }

      // 2. Filtro de Amigo
      if (filtroAmigoId) {
        const amigoParticipa = (c.participantesIds || []).includes(filtroAmigoId);
        const amigoPagou = c.paidByFriendId === filtroAmigoId;
        if (!amigoParticipa && !amigoPagou) {
          return false;
        }
      }

      // 3. Filtro de Tag
      if (filtroTag) {
        if ((c.tag || '').toLowerCase() !== filtroTag.toLowerCase()) {
          return false;
        }
      }

      // 4. Filtro por Data
      const dataCorrida = (c.data || '').slice(0, 10);
      if (dataInicio && dataCorrida < dataInicio) {
        return false;
      }
      if (dataFim && dataCorrida > dataFim) {
        return false;
      }

      return true;
    });
  }, [corridas, amigos, busca, filtroStatus, filtroAmigoId, filtroTag, dataInicio, dataFim, nettingCache]);

  const corridasOrdenadas = useMemo(() => {
    return [...corridasFiltradas].sort((a, b) => {
      const tempoA = new Date(a.data).getTime();
      const tempoB = new Date(b.data).getTime();
      return ordemCrescente ? tempoA - tempoB : tempoB - tempoA;
    });
  }, [corridasFiltradas, ordemCrescente]);

  const corridasPaginadas = corridasOrdenadas.slice(0, itensVisiveis);
  const temMaisCorridas = itensVisiveis < corridasOrdenadas.length;

  const corridasAgrupadasPorData = useMemo(() => {
    return corridasPaginadas.reduce((grupos, corrida) => {
      const chaveData = (corrida.data || '').slice(0, 10) || 'sem-data';
      if (!grupos[chaveData]) {
        grupos[chaveData] = [];
      }
      grupos[chaveData].push(corrida);
      return grupos;
    }, {} as Record<string, Corrida[]>);
  }, [corridasPaginadas]);

  // Conta apenas os filtros avançados do painel (Amigo, Tag e Período)
  // para não duplicar visualmente os botões rápidos de status nem a barra de busca
  const totalFiltrosAvancados =
    (filtroAmigoId ? 1 : 0) + (filtroTag ? 1 : 0) + (dataInicio || dataFim ? 1 : 0);

  const temAlgumFiltroAtivo =
    filtroStatus !== 'tudo' || Boolean(busca.trim()) || totalFiltrosAvancados > 0;

  const limparFiltros = () => {
    handleSetFiltroStatus('tudo');
    setBusca('');
    setFiltroAmigoId('');
    setFiltroTag('');
    setDataInicio('');
    setDataFim('');
    setItensVisiveis(8);
  };

  const limparFiltrosAvancados = () => {
    setFiltroAmigoId('');
    setFiltroTag('');
    setDataInicio('');
    setDataFim('');
    setItensVisiveis(8);
  };

  const aplicarPredefinicaoData = (tipo: '7d' | '30d' | 'mes' | 'ano' | 'tudo') => {
    const now = new Date();
    setItensVisiveis(8);
    if (tipo === 'tudo') {
      setDataInicio('');
      setDataFim('');
    } else if (tipo === '7d') {
      const d7 = new Date();
      d7.setDate(now.getDate() - 7);
      setDataInicio(formatDateIso(d7));
      setDataFim(formatDateIso(now));
    } else if (tipo === '30d') {
      const d30 = new Date();
      d30.setDate(now.getDate() - 30);
      setDataInicio(formatDateIso(d30));
      setDataFim(formatDateIso(now));
    } else if (tipo === 'mes') {
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
      const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDataInicio(formatDateIso(inicioMes));
      setDataFim(formatDateIso(fimMes));
    } else if (tipo === 'ano') {
      const inicioAno = new Date(now.getFullYear(), 0, 1);
      const fimAno = new Date(now.getFullYear(), 11, 31);
      setDataInicio(formatDateIso(inicioAno));
      setDataFim(formatDateIso(fimAno));
    }
  };

  const amigoSelecionadoFiltro = amigos.find((a) => a.id === filtroAmigoId);
  const corridaSelecionada = corridas.find((c) => c.id === corridaSelecionadaId) || null;

  if (isLoading) {
    return (
      <div className="space-y-3.5">
        <TopBar title="Histórico de Rachas" subtitle="Carregando rachas..." />
        <div className="flex flex-col items-center justify-center h-64 text-[var(--primary)]">
          <LoaderCircle size={40} strokeWidth={2} className="animate-spin mb-4" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Carregando rachas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 relative">
      <TopBar
        title="Histórico de Rachas"
        subtitle={`${corridasFiltradas.length} ${
          corridasFiltradas.length === 1 ? 'racha encontrado' : 'rachas encontrados'
        }`}
        rightContent={
          <>
            <button
              type="button"
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`h-10 px-3 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold shrink-0 border ${
                mostrarFiltros || totalFiltrosAvancados > 0
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
              title="Filtros avançados"
            >
              <SlidersHorizontal size={15} strokeWidth={2} />
              <span className="hidden xs:inline">Filtros</span>
              {totalFiltrosAvancados > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-white/20 text-white">
                  {totalFiltrosAvancados}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setOrdemCrescente(!ordemCrescente)}
              className={`h-10 w-10 rounded-xl transition-colors flex items-center justify-center shrink-0 border ${
                ordemCrescente
                  ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/40'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
              title={ordemCrescente ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}
            >
              <ArrowDownUp size={16} strokeWidth={2} />
            </button>
          </>
        }
      />

      {/* Barra de Pesquisa por Texto */}
      <div className="h-12 bg-[var(--bg-surface)] rounded-xl flex items-center px-4 text-[var(--text-secondary)] border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-focus-ring)] transition-all shadow-sm">
        <Search size={18} strokeWidth={2} className="mr-3 text-[var(--text-secondary)] shrink-0" />
        <input
          type="text"
          placeholder="Buscar por nome, tag ou amigo..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setItensVisiveis(8);
          }}
          className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
        />
        {busca && (
          <button
            type="button"
            onClick={() => {
              setBusca('');
              setItensVisiveis(8);
            }}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"
            title="Limpar busca"
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Botões de Filtros Rápidos de Status (Tudo, A Pagar, A Receber, Quitados) */}
      <div
        data-horizontal-scroll="true"
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide pt-0.5"
      >
        {botoesFiltro.map((btn) => {
          const isActive = filtroStatus === btn.id;
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => handleSetFiltroStatus(btn.id)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border ${
                isActive
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              {Icon && (
                <Icon
                  size={14}
                  strokeWidth={2}
                  className={isActive ? 'text-white' : btn.color}
                />
              )}
              <span>{btn.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {btn.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chips de Filtros Avançados Ativos (apenas quando Amigo, Tag ou Período está selecionado) */}
      {totalFiltrosAvancados > 0 && (
        <div
          data-horizontal-scroll="true"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs"
        >
          {amigoSelecionadoFiltro && (
            <span className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shrink-0">
              <User size={12} strokeWidth={2} className="text-[var(--primary)]" />
              <span>{amigoSelecionadoFiltro.nome || amigoSelecionadoFiltro.name}</span>
              <button type="button" onClick={() => setFiltroAmigoId('')}>
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          )}

          {filtroTag && (
            <span className="bg-[var(--primary-light)] text-[var(--primary)] px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shrink-0">
              <Tag size={12} strokeWidth={2} />
              <span>{filtroTag}</span>
              <button type="button" onClick={() => setFiltroTag('')}>
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          )}

          {(dataInicio || dataFim) && (
            <span className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shrink-0">
              <Calendar size={12} strokeWidth={2} className="text-[var(--primary)]" />
              <span>
                {dataInicio && dataFim
                  ? `${dataInicio.split('-').reverse().slice(0, 2).join('/')} - ${dataFim.split('-').reverse().slice(0, 2).join('/')}`
                  : dataInicio
                  ? `Desde ${dataInicio.split('-').reverse().slice(0, 2).join('/')}`
                  : `Até ${dataFim.split('-').reverse().slice(0, 2).join('/')}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDataInicio('');
                  setDataFim('');
                }}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={limparFiltrosAvancados}
            className="text-[var(--text-secondary)] hover:text-[#F43F5E] px-2 py-1 rounded-full transition-colors flex items-center gap-1 shrink-0 ml-auto font-medium"
            title="Limpar filtros avançados"
          >
            <RotateCcw size={12} strokeWidth={2} />
            <span className="text-xs">Limpar</span>
          </button>
        </div>
      )}

      {/* Painel Expansível de Filtros Avançados */}
      {mostrarFiltros && (
        <div className="ds-card p-4 sm:p-5 space-y-4 animate-fade-in">
          {/* 1. Filtro por Amigo */}
          <div>
            <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold flex items-center gap-1.5 mb-2">
              <User size={14} strokeWidth={2} className="text-[var(--primary)]" /> Filtrar por Amigo
            </label>
            <select
              value={filtroAmigoId}
              onChange={(e) => {
                setFiltroAmigoId(e.target.value);
                setItensVisiveis(8);
              }}
              className="ds-input"
            >
              <option value="">Todos os amigos</option>
              {amigos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome || a.name || 'Amigo'}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filtro por Tag */}
          <div>
            <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold flex items-center gap-1.5 mb-2">
              <Tag size={14} strokeWidth={2} className="text-[var(--primary)]" /> Filtrar por
              Categoria / Tag
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setFiltroTag('');
                  setItensVisiveis(8);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                  filtroTag === ''
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
                }`}
              >
                Todas
              </button>
              {tagsDisponiveis.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setFiltroTag(filtroTag === t ? '' : t);
                    setItensVisiveis(8);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                    filtroTag.toLowerCase() === t.toLowerCase()
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Filtro por Data */}
          <div>
            <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold flex items-center gap-1.5 mb-2">
              <Calendar size={14} strokeWidth={2} className="text-[var(--primary)]" /> Filtrar por
              Período
            </label>

            {/* Atalhos de Data */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => aplicarPredefinicaoData('7d')}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={() => aplicarPredefinicaoData('30d')}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                onClick={() => aplicarPredefinicaoData('mes')}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Este Mês
              </button>
              <button
                type="button"
                onClick={() => aplicarPredefinicaoData('ano')}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Este Ano
              </button>
              {(dataInicio || dataFim) && (
                <button
                  type="button"
                  onClick={() => aplicarPredefinicaoData('tudo')}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#F43F5E] hover:opacity-80 transition-colors"
                >
                  Limpar data
                </button>
              )}
            </div>

            {/* Inputs de Data Personalizada */}
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <span className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Data Início:
                </span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setItensVisiveis(8);
                  }}
                  className="ds-input text-xs"
                />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Data Fim:
                </span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setItensVisiveis(8);
                  }}
                  className="ds-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Rodapé do Painel */}
          <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {corridasFiltradas.length}{' '}
              {corridasFiltradas.length === 1 ? 'racha filtrado' : 'rachas filtrados'}
            </span>
            <div className="flex gap-2">
              {totalFiltrosAvancados > 0 && (
                <button
                  type="button"
                  onClick={limparFiltrosAvancados}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Resetar
                </button>
              )}
              <button
                type="button"
                onClick={() => setMostrarFiltros(false)}
                className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Rachas */}
      <div className="mt-3 pb-28">
        {corridasPaginadas.length === 0 ? (
          <div className="text-center py-12 ds-card px-4">
            <p className="font-display font-semibold text-[var(--text-primary)] text-base mb-1">
              Nenhum racha encontrado
            </p>
            <p className="text-[var(--text-secondary)] text-sm mb-4">
              {temAlgumFiltroAtivo
                ? 'Tente ajustar ou limpar os filtros aplicados.'
                : 'Você ainda não cadastrou nenhum racha.'}
            </p>
            {temAlgumFiltroAtivo && (
              <button
                type="button"
                onClick={limparFiltros}
                className="bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={14} strokeWidth={2} />
                <span>Limpar todos os filtros</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(corridasAgrupadasPorData).map(([dataKey, corridasDoDia]) => (
              <div key={dataKey}>
                <div className="flex items-center gap-2.5 mb-2 px-0.5">
                  <h3 className="font-display text-xs font-bold tracking-wide text-[var(--primary)] whitespace-nowrap">
                    {formatRideDateHeader(dataKey)}
                  </h3>
                  <div className="h-px flex-1 bg-[var(--border-color)]" />
                </div>

                <div className="space-y-2.5">
                  {corridasDoDia.map((corrida) => {
                    const userStatus = getRideStatusForUser(corrida, corridas, amigos, nettingCache);
                    return (
                      <RideCard
                        key={corrida.id}
                        data={corrida.data}
                        tag={corrida.tag}
                        titulo={corrida.titulo}
                        valorTotal={moneyConverter(corrida.valorTotal)}
                        userStatus={userStatus}
                        paidByName={corrida.paidByName}
                        participantes={[
                          { id: 0, nome: 'Você', cor: '#0F766E', avatar_url: myAvatarUrl },
                          ...getParticipantesCompletos(corrida.participantesIds).map((a, idx) => ({
                            id: a.id || idx + 1,
                            nome: a.nome || 'Amigo',
                            cor: a.cor || '#0F766E',
                            avatar_url: a.avatar_url || null,
                          })),
                        ]}
                        onClick={() => setCorridaSelecionadaId(corrida.id)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {temMaisCorridas && (
              <button
                type="button"
                onClick={() => setItensVisiveis((prev) => prev + 5)}
                className="w-full h-12 mt-5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)]/40 transition-colors flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.99] shadow-sm"
              >
                <span>Ver mais rachas ({corridasOrdenadas.length - itensVisiveis} restantes)</span>
                <ChevronDown size={18} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      <RideDetailsModal
        isOpen={!!corridaSelecionada}
        ride={corridaSelecionada || undefined}
        participantes={getParticipantesCompletos(corridaSelecionada?.participantesIds || [])}
        onClose={() => setCorridaSelecionadaId(null)}
        onDelete={deletarCorrida}
        onUpdated={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}
