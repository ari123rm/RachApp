// src/components/Viagens.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { RideCard } from './RideCard';
import { RideDetailsModal } from './RideDetailsModal';
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
      color: 'text-red-400',
    },
    {
      id: 'a_receber',
      label: 'A Receber',
      count: contagens.aReceber,
      icon: TrendingUp,
      color: 'text-amber-400',
    },
    {
      id: 'quitados',
      label: 'Quitados',
      count: contagens.quitados,
      icon: CheckCircle2,
      color: 'text-emerald-400',
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
          cor: '#0ea5e9',
          color: '#0ea5e9',
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

  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  const corridasAgrupadas = useMemo(() => {
    return corridasPaginadas.reduce((grupos, corrida) => {
      const [ano, mes] = (corrida.data || '').split('-');
      const dataObj = new Date(Number(ano) || anoAtual, (Number(mes) || mesAtual) - 1, 1);
      const nomeMes = dataObj.toLocaleString('pt-BR', { month: 'long' });
      const chaveMes = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} ${ano || anoAtual}`;

      if (!grupos[chaveMes]) {
        grupos[chaveMes] = [];
      }
      grupos[chaveMes].push(corrida);
      return grupos;
    }, {} as Record<string, Corrida[]>);
  }, [corridasPaginadas, anoAtual, mesAtual]);

  const totalFiltrosAtivos =
    (filtroStatus !== 'tudo' ? 1 : 0) +
    (busca.trim() ? 1 : 0) +
    (filtroAmigoId ? 1 : 0) +
    (filtroTag ? 1 : 0) +
    (dataInicio || dataFim ? 1 : 0);

  const limparFiltros = () => {
    handleSetFiltroStatus('tudo');
    setBusca('');
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
      <div className="flex flex-col items-center justify-center h-64 text-[#2DD4BF]">
        <LoaderCircle size={40} className="animate-spin mb-4" />
        <p className="text-gray-400">Carregando rachas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Cabeçalho */}
      <header className="flex justify-between items-center mt-1 sm:mt-2 gap-2 min-w-0">
        <div className="min-w-0 flex-1 pr-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">Histórico de Rachas</h1>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {corridasFiltradas.length}{' '}
            {corridasFiltradas.length === 1 ? 'racha encontrado' : 'rachas encontrados'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Botão para abrir/fechar painel de filtros */}
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold shrink-0 ${
              mostrarFiltros || totalFiltrosAtivos > 0
                ? 'bg-[#2DD4BF] text-[#05080f] shadow-lg shadow-teal-500/20'
                : 'bg-[#1c1c1e] text-gray-300 hover:text-white border border-white/5'
            }`}
            title="Filtros avançados"
          >
            <SlidersHorizontal size={15} />
            <span className="hidden xs:inline">Filtros</span>
            {totalFiltrosAtivos > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  mostrarFiltros
                    ? 'bg-[#05080f] text-[#2DD4BF]'
                    : 'bg-[#2DD4BF] text-[#05080f]'
                }`}
              >
                {totalFiltrosAtivos}
              </span>
            )}
          </button>

          {/* Botão de Ordenação */}
          <button
            onClick={() => setOrdemCrescente(!ordemCrescente)}
            className={`p-2 sm:p-2.5 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold shrink-0 ${
              ordemCrescente
                ? 'bg-[#2DD4BF]/20 text-[#2DD4BF] border border-[#2DD4BF]/40'
                : 'bg-[#1c1c1e] text-gray-300 hover:text-white border border-white/5'
            }`}
            title={ordemCrescente ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}
          >
            <ArrowDownUp size={15} />
          </button>
        </div>
      </header>

      {/* Barra de Pesquisa por Texto */}
      <div className="bg-[#1c1c1e] rounded-2xl flex items-center px-3 sm:px-3.5 py-2 sm:py-2.5 text-gray-400 border border-white/5 focus-within:ring-1 focus-within:ring-[#2DD4BF] focus-within:border-[#2DD4BF]/40 transition-all">
        <Search size={18} className="mr-2.5 text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Buscar por nome, tag ou amigo..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setItensVisiveis(8);
          }}
          className="bg-transparent w-full outline-none text-white placeholder:text-gray-500 text-sm"
        />
        {busca && (
          <button
            onClick={() => {
              setBusca('');
              setItensVisiveis(8);
            }}
            className="text-gray-400 hover:text-white p-1"
            title="Limpar busca"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Botões de Filtros Rápidos de Status (Tudo, A Pagar, A Receber, Quitados) */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide overscroll-x-contain touch-pan-x pt-0.5">
        {botoesFiltro.map((btn) => {
          const isActive = filtroStatus === btn.id;
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => handleSetFiltroStatus(btn.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                isActive
                  ? 'bg-[#2DD4BF] text-[#05080f] font-bold shadow-sm'
                  : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              {Icon && (
                <Icon
                  size={13}
                  className={isActive ? 'text-[#05080f]' : btn.color}
                />
              )}
              <span>{btn.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-[#05080f]/20 text-[#05080f]'
                    : 'bg-white/5 text-gray-400'
                }`}
              >
                {btn.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chips Rápidos de Filtros Ativos (aparecem quando qualquer filtro está ativo) */}
      {totalFiltrosAtivos > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs overscroll-x-contain touch-pan-x">
          <span className="text-[11px] text-gray-500 font-medium shrink-0 mr-1">Filtros:</span>

          {filtroStatus !== 'tudo' && (
            <span className="bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
              {filtroStatus === 'a_pagar'
                ? 'A Pagar'
                : filtroStatus === 'a_receber'
                ? 'A Receber'
                : 'Quitados'}
              <button onClick={() => handleSetFiltroStatus('tudo')} className="hover:text-white">
                <X size={12} />
              </button>
            </span>
          )}

          {busca.trim() && (
            <span className="bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
              "{busca}"
              <button onClick={() => setBusca('')} className="hover:text-white">
                <X size={12} />
              </button>
            </span>
          )}

          {amigoSelecionadoFiltro && (
            <span className="bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
              <User size={11} />
              {amigoSelecionadoFiltro.nome || amigoSelecionadoFiltro.name}
              <button onClick={() => setFiltroAmigoId('')} className="hover:text-white">
                <X size={12} />
              </button>
            </span>
          )}

          {filtroTag && (
            <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
              <Tag size={11} />
              {filtroTag}
              <button onClick={() => setFiltroTag('')} className="hover:text-white">
                <X size={12} />
              </button>
            </span>
          )}

          {(dataInicio || dataFim) && (
            <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
              <Calendar size={11} />
              {dataInicio && dataFim
                ? `${dataInicio.split('-').reverse().slice(0, 2).join('/')} até ${dataFim.split('-').reverse().slice(0, 2).join('/')}`
                : dataInicio
                ? `A partir de ${dataInicio.split('-').reverse().join('/')}`
                : `Até ${dataFim.split('-').reverse().join('/')}`}
              <button
                onClick={() => {
                  setDataInicio('');
                  setDataFim('');
                }}
                className="hover:text-white"
              >
                <X size={12} />
              </button>
            </span>
          )}

          <button
            onClick={limparFiltros}
            className="text-gray-400 hover:text-red-400 px-2 py-1 rounded-full transition-colors flex items-center gap-1 shrink-0 ml-auto"
            title="Limpar todos os filtros"
          >
            <RotateCcw size={11} />
            <span className="text-[11px]">Limpar</span>
          </button>
        </div>
      )}

      {/* Painel Expansível de Filtros Avançados */}
      {mostrarFiltros && (
        <div className="bg-[#1c1c1e] p-4 rounded-3xl border border-white/10 space-y-4 shadow-xl">
          {/* 1. Filtro por Amigo */}
          <div>
            <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-1.5 mb-2">
              <User size={13} className="text-[#2DD4BF]" /> Filtrar por Amigo
            </label>
            <select
              value={filtroAmigoId}
              onChange={(e) => {
                setFiltroAmigoId(e.target.value);
                setItensVisiveis(8);
              }}
              className="w-full bg-[#2c2c2e] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 outline-none focus:border-[#2DD4BF] transition-colors"
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
            <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-1.5 mb-2">
              <Tag size={13} className="text-[#2DD4BF]" /> Filtrar por Tag
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setFiltroTag('');
                  setItensVisiveis(8);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filtroTag === ''
                    ? 'bg-[#2DD4BF] text-[#05080f]'
                    : 'bg-[#2c2c2e] text-gray-300 hover:bg-[#3a3a3c]'
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
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filtroTag.toLowerCase() === t.toLowerCase()
                      ? 'bg-[#2DD4BF] text-[#05080f]'
                      : 'bg-[#2c2c2e] text-gray-300 hover:bg-[#3a3a3c]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Filtro por Data */}
          <div>
            <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-1.5 mb-2">
              <Calendar size={13} className="text-[#2DD4BF]" /> Filtrar por Período
            </label>

            {/* Atalhos de Data */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => aplicarPredefinicaoData('7d')}
                className="px-2.5 py-1 rounded-lg text-xs bg-[#2c2c2e] hover:bg-[#3a3a3c] text-gray-300 transition-colors"
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={() => aplicarPredefinicaoData('30d')}
                className="px-2.5 py-1 rounded-lg text-xs bg-[#2c2c2e] hover:bg-[#3a3a3c] text-gray-300 transition-colors"
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                onClick={() => aplicarPredefinicaoData('mes')}
                className="px-2.5 py-1 rounded-lg text-xs bg-[#2c2c2e] hover:bg-[#3a3a3c] text-gray-300 transition-colors"
              >
                Este Mês
              </button>
              <button
                type="button"
                onClick={() => aplicarPredefinicaoData('ano')}
                className="px-2.5 py-1 rounded-lg text-xs bg-[#2c2c2e] hover:bg-[#3a3a3c] text-gray-300 transition-colors"
              >
                Este Ano
              </button>
              {(dataInicio || dataFim) && (
                <button
                  type="button"
                  onClick={() => aplicarPredefinicaoData('tudo')}
                  className="px-2.5 py-1 rounded-lg text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Limpar data
                </button>
              )}
            </div>

            {/* Inputs de Data Personalizada */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <div className="min-w-0">
                <span className="text-[10px] text-gray-400 block mb-1">Data Início:</span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setItensVisiveis(8);
                  }}
                  className="w-full min-w-0 bg-[#2c2c2e] text-white text-xs rounded-xl p-2 sm:p-2.5 border border-white/10 outline-none focus:border-[#2DD4BF] [color-scheme:dark]"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-gray-400 block mb-1">Data Fim:</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setItensVisiveis(8);
                  }}
                  className="w-full min-w-0 bg-[#2c2c2e] text-white text-xs rounded-xl p-2 sm:p-2.5 border border-white/10 outline-none focus:border-[#2DD4BF] [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Rodapé do Painel */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {corridasFiltradas.length}{' '}
              {corridasFiltradas.length === 1 ? 'racha filtrado' : 'rachas filtrados'}
            </span>
            <div className="flex gap-2">
              {totalFiltrosAtivos > 0 && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Resetar
                </button>
              )}
              <button
                type="button"
                onClick={() => setMostrarFiltros(false)}
                className="bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] px-4 py-1.5 rounded-xl text-xs font-bold transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Rachas */}
      <div className="mt-4 pb-20">
        {corridasPaginadas.length === 0 ? (
          <div className="text-center py-12 bg-[#1c1c1e] rounded-3xl border border-white/5 px-4">
            <p className="text-gray-300 font-medium text-base mb-1">Nenhum racha encontrado</p>
            <p className="text-gray-500 text-xs mb-4">
              {totalFiltrosAtivos > 0
                ? 'Tente ajustar ou limpar os filtros aplicados.'
                : 'Você ainda não cadastrou nenhum racha.'}
            </p>
            {totalFiltrosAtivos > 0 && (
              <button
                onClick={limparFiltros}
                className="bg-[#2DD4BF]/15 text-[#2DD4BF] hover:bg-[#2DD4BF]/25 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={13} />
                Limpar todos os filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(corridasAgrupadas).map(([mes, corridasDoMes]) => (
              <div key={mes}>
                <div className="flex items-center gap-2 mb-3.5 px-0.5">
                  <h3 className="text-xs sm:text-sm font-extrabold tracking-wider text-teal-300 uppercase">
                    {mes}
                  </h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] shrink-0" />
                </div>

                <div className="space-y-3">
                  {corridasDoMes.map((corrida) => {
                    const userStatus = getRideStatusForUser(corrida, corridas, amigos, nettingCache);
                    return (
                      <RideCard
                        key={corrida.id}
                        data={corrida.data}
                        tag={corrida.tag}
                        titulo={corrida.titulo}
                        valorTotal={moneyConverter(corrida.valorTotal)}
                        userStatus={userStatus}
                        participantes={[
                          { id: 0, nome: 'Você', cor: '#2DD4BF', avatar_url: myAvatarUrl },
                          ...getParticipantesCompletos(corrida.participantesIds).map((a, idx) => ({
                            id: a.id || idx + 1,
                            nome: a.nome || 'Amigo',
                            cor: a.cor || '#0ea5e9',
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
                onClick={() => setItensVisiveis((prev) => prev + 5)}
                className="w-full py-4 mt-6 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.99]"
              >
                Ver mais rachas ({corridasOrdenadas.length - itensVisiveis} restantes)
                <ChevronDown size={18} />
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
