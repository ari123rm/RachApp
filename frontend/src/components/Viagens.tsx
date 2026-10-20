// src/components/Viagens.tsx
import { useState, useEffect } from 'react';
import { RideCard } from './RideCard';
import { RideDetailsModal } from './RideDetailsModal';
import { LoaderCircle, ArrowDownUp, Search, X, Filter } from 'lucide-react';
import type { Corrida, Amigo } from '../types';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';

export function Viagens({ onDataChange }: { onDataChange?: () => void }) {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [corridaSelecionadaId, setCorridaSelecionadaId] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroAba, setFiltroAba] = useState<'todas' | 'este_mes'>('todas');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendentes' | 'quitados'>('todos');
  const [ordemCrescente, setOrdemCrescente] = useState(false);
  const [itensVisiveis, setItensVisiveis] = useState(12);

  const carregarDados = async () => {
    setIsLoading(true);
    try {
      const [listaCorridas, listaAmigos] = await Promise.all([
        dbService.corridas.getAll(),
        dbService.amigos.getAll(),
      ]);
      setCorridas(listaCorridas);
      setAmigos(listaAmigos);
    } catch (error) {
      console.error('Erro ao carregar viagens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const getParticipantesCompletos = (ids?: string[] | null) => {
    if (!ids || !Array.isArray(ids)) return [];
    return ids.map((id, idx) => {
      const found = amigos.find((a) => a && a.id === id);
      if (found) return found;
      return {
        id,
        nome: `Amigo ${idx + 1}`,
        name: `Amigo ${idx + 1}`,
        cor: 'bg-sky-500',
        color: 'bg-sky-500',
      } as Amigo;
    });
  };

  const deletarCorrida = async (id: string) => {
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

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  const corridasFiltradas = corridas.filter((c) => {
    if (!c) return false;
    // 1. Filtro por mês
    if (filtroAba === 'este_mes') {
      const dataStr = c.data || c.expense_date || '';
      const [ano, mes] = String(dataStr).split('-');
      if (Number(mes) !== mesAtual || Number(ano) !== anoAtual) return false;
    }

    // 2. Filtro por status (pendente / quitado)
    if (filtroStatus === 'pendentes' && c.isPaied) return false;
    if (filtroStatus === 'quitados' && !c.isPaied) return false;

    // 3. Barra de pesquisa (busca por título, tag ou participante)
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();
      const matchTitulo = (c.titulo || c.title || '').toLowerCase().includes(termo);
      const matchTag = (c.tag || '').toLowerCase().includes(termo);
      const parts = getParticipantesCompletos(c.participantesIds || []);
      const matchParticipante = parts.some((p) =>
        (p?.nome || p?.name || '').toLowerCase().includes(termo)
      );

      if (!matchTitulo && !matchTag && !matchParticipante) return false;
    }

    return true;
  });

  const corridasOrdenadas = [...corridasFiltradas].sort((a, b) => {
    const dataA = a?.data || a?.expense_date || '';
    const dataB = b?.data || b?.expense_date || '';
    const tempoA = dataA ? new Date(dataA).getTime() : 0;
    const tempoB = dataB ? new Date(dataB).getTime() : 0;
    return ordemCrescente ? tempoA - tempoB : tempoB - tempoA;
  });

  const corridasPaginadas = corridasOrdenadas.slice(0, itensVisiveis);
  const temMaisCorridas = itensVisiveis < corridasOrdenadas.length;

  const corridasAgrupadas = corridasPaginadas.reduce((grupos, corrida) => {
    if (!corrida) return grupos;
    let chaveMes = 'Rachas Recentes';
    try {
      const rawDate = corrida.data || corrida.expense_date;
      const dataValida = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : new Date();
      const nomeMes = dataValida.toLocaleString('pt-BR', { month: 'long' });
      chaveMes = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} ${dataValida.getFullYear()}`;
    } catch {
      chaveMes = 'Rachas';
    }

    if (!grupos[chaveMes]) {
      grupos[chaveMes] = [];
    }
    grupos[chaveMes].push(corrida);
    return grupos;
  }, {} as Record<string, Corrida[]>);

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
      <header className="flex justify-between items-center mt-2">
        <h1 className="text-2xl font-bold text-white">Histórico de Rachas</h1>

        <button
          onClick={() => setOrdemCrescente(!ordemCrescente)}
          className={`p-2 rounded-full transition-colors flex items-center gap-2 text-sm font-medium ${
            ordemCrescente
              ? 'bg-[#2DD4BF]/20 text-[#2DD4BF]'
              : 'bg-gray-800 text-gray-300 hover:text-white'
          }`}
          title="Inverter Ordem"
        >
          <ArrowDownUp size={18} />
        </button>
      </header>

      {/* Barra de Pesquisa */}
      <div className="bg-[#1c1c1e] rounded-2xl flex items-center p-3 text-gray-400 border border-white/5 focus-within:ring-1 focus-within:ring-[#2DD4BF] focus-within:text-[#2DD4BF] transition-all">
        <Search size={18} className="mr-2.5 text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Buscar racha por nome, tag ou amigo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="bg-transparent w-full outline-none text-white placeholder:text-gray-500 text-sm"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="p-1 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filtros de Status e Período */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide text-xs">
          <button
            onClick={() => {
              setFiltroAba('todas');
              setItensVisiveis(12);
            }}
            className={`px-3 py-1.5 font-bold rounded-full transition-colors shrink-0 ${
              filtroAba === 'todas'
                ? 'bg-[#2DD4BF] text-[#05080f]'
                : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            Todas as Datas
          </button>
          <button
            onClick={() => {
              setFiltroAba('este_mes');
              setItensVisiveis(12);
            }}
            className={`px-3 py-1.5 font-bold rounded-full transition-colors shrink-0 ${
              filtroAba === 'este_mes'
                ? 'bg-[#2DD4BF] text-[#05080f]'
                : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            Este Mês
          </button>

          <span className="w-[1px] h-6 bg-white/10 mx-1 self-center shrink-0" />

          <button
            onClick={() => setFiltroStatus('todos')}
            className={`px-3 py-1.5 font-bold rounded-full transition-colors shrink-0 ${
              filtroStatus === 'todos'
                ? 'bg-white/20 text-white'
                : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            Todos os Status
          </button>
          <button
            onClick={() => setFiltroStatus('pendentes')}
            className={`px-3 py-1.5 font-bold rounded-full transition-colors shrink-0 ${
              filtroStatus === 'pendentes'
                ? 'bg-yellow-500 text-[#05080f]'
                : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFiltroStatus('quitados')}
            className={`px-3 py-1.5 font-bold rounded-full transition-colors shrink-0 ${
              filtroStatus === 'quitados'
                ? 'bg-[#34C759] text-[#05080f]'
                : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            Quitados
          </button>
        </div>
      </div>

      <div className="mt-2 pb-20">
        {corridasPaginadas.length === 0 ? (
          <div className="text-center py-12 bg-[#1c1c1e] rounded-3xl border border-white/5">
            <Filter size={28} className="mx-auto text-gray-600 mb-2" />
            <p className="text-gray-300 font-semibold text-sm">Nenhum racha encontrado</p>
            <p className="text-gray-500 text-xs mt-1">
              {busca ? 'Tente buscar com outro termo ou limpe o filtro.' : 'Crie um novo racha no botão "+" abaixo.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(corridasAgrupadas).map(([mes, corridasDoMes]) => (
              <div key={mes}>
                <h3 className="text-gray-400 mb-3 text-xs font-bold uppercase tracking-wider sticky top-0 bg-[#05080f]/90 py-2 backdrop-blur-sm z-10">
                  {mes}
                </h3>

                <div className="space-y-3">
                  {corridasDoMes.map((corrida) => (
                    <RideCard
                      key={corrida.id}
                      data={corrida.data}
                      tag={corrida.tag}
                      titulo={corrida.titulo}
                      valorTotal={moneyConverter(corrida.valorTotal)}
                      participantes={[
                        { id: 0, nome: 'Você', cor: 'bg-[#2DD4BF]' },
                        ...getParticipantesCompletos(corrida.participantesIds || []).map((a, idx) => ({
                          id: idx + 1,
                          nome: a?.nome || a?.name || 'Amigo',
                          cor: a?.cor || a?.color || 'bg-sky-500',
                        })),
                      ]}
                      isPaied={corrida.isPaied}
                      onClick={() => setCorridaSelecionadaId(corrida.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {temMaisCorridas && (
              <div className="text-center pt-2">
                <button
                  onClick={() => setItensVisiveis((prev) => prev + 10)}
                  className="bg-[#1c1c1e] hover:bg-[#2c2c2e] text-[#2DD4BF] border border-[#2DD4BF]/30 px-6 py-2.5 rounded-full text-xs font-bold transition-colors"
                >
                  Ver mais rachas
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <RideDetailsModal
        ride={corridaSelecionada || undefined}
        participantes={getParticipantesCompletos(corridaSelecionada?.participantesIds || [])}
        isOpen={!!corridaSelecionada}
        onClose={() => setCorridaSelecionadaId(null)}
        onDelete={deletarCorrida}
        onUpdated={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
        update={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}
