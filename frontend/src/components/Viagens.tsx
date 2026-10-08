// src/components/Viagens.tsx
import { useState, useEffect } from 'react';
import { RideCard } from './RideCard';
import { RideDetailsModal } from './RideDetailsModal';
import {  LoaderCircle, ChevronDown, ArrowDownUp } from 'lucide-react';
import type { Corrida, Amigo } from '../types';
import { dbService } from '../services/database';

export function Viagens() {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [corridaSelecionada, setCorridaSelecionada] = useState<Corrida | null>(null);

  // 🟢 NOVOS ESTADOS: Filtros e Paginação 🟢
  const [filtroAba, setFiltroAba] = useState<'todas' | 'este_mes'>('todas');
  const [ordemCrescente, setOrdemCrescente] = useState(false); // false = Mais recentes primeiro
  const [itensVisiveis, setItensVisiveis] = useState(5); // Começa mostrando 5 itens

  const carregarDados = async () => {
    setIsLoading(true);
    try {
      const [listaCorridas, listaAmigos] = await Promise.all([
        dbService.corridas.getAll(),
        dbService.amigos.getAll()
      ]);
      setCorridas(listaCorridas);
      setAmigos(listaAmigos);
    } catch (error) {
      console.error("Erro ao carregar viagens:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const getParticipantesCompletos = (ids: string[]) => {
    return amigos.filter(a => ids.includes(a.id));
  };
  const deletarCorrida = (id: string) => {
    // Aqui você pode implementar a lógica para deletar a corrida, como fazer uma requisição para o backend ou atualizar o estado no frontend
    try{
      dbService.corridas.delete(id);
      carregarDados();
      alert('Racha deletado com sucesso!');
    }catch(error){
      console.error('Erro ao deletar o racha:', error);
      alert('Ocorreu um erro ao deletar o racha. Por favor, tente novamente.');
    }
  }
  // =========================================================
  // 🟢 LÓGICA DE FILTRAGEM, ORDENAÇÃO E PAGINAÇÃO 🟢
  // =========================================================

  // 1. Filtrar pela aba ("Todas" ou "Este Mês")
  const mesAtual = new Date().getMonth() + 1; // getMonth começa em 0
  const anoAtual = new Date().getFullYear();

  const corridasFiltradas = corridas.filter(c => {
    if (filtroAba === 'todas') return true;
    
    // Como a data é YYYY-MM-DD, quebramos a string
    const [ano, mes] = c.data.split('-');
    return Number(mes) === mesAtual && Number(ano) === anoAtual;
  });

  // 2. Ordenar (Mais recentes ou Mais antigas)
  const corridasOrdenadas = [...corridasFiltradas].sort((a, b) => {
    const tempoA = new Date(a.data).getTime();
    const tempoB = new Date(b.data).getTime();
    return ordemCrescente ? tempoA - tempoB : tempoB - tempoA;
  });

  // 3. Paginação (Cortar a lista com base nos itens visíveis)
  const corridasPaginadas = corridasOrdenadas.slice(0, itensVisiveis);
  const temMaisCorridas = itensVisiveis < corridasOrdenadas.length;

  // 4. Agrupar por Mês (ex: "Abril 2026")
  const corridasAgrupadas = corridasPaginadas.reduce((grupos, corrida) => {
    const [ano, mes] = corrida.data.split('-');
    const dataObj = new Date(Number(ano), Number(mes) - 1, 1);
    const nomeMes = dataObj.toLocaleString('pt-BR', { month: 'long' });
    
    // Deixa a primeira letra maiúscula: "abril 2026" -> "Abril 2026"
    const chaveMes = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} ${ano}`;

    if (!grupos[chaveMes]) {
      grupos[chaveMes] = [];
    }
    grupos[chaveMes].push(corrida);
    return grupos;
  }, {} as Record<string, Corrida[]>);

  // =========================================================

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#2DD4BF]">
        <LoaderCircle size={40} className="animate-spin mb-4" />
        <p className="text-gray-400">Carregando rachas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Cabeçalho */}
      <header className="flex justify-between items-center mt-2 ">
        <h1 className="text-2xl font-bold">Histórico de Rachas</h1>
        
        {/* 🟢 Botão de Filtro agora inverte a ordem (Antigas/Recentes) */}
        <button 
          onClick={() => setOrdemCrescente(!ordemCrescente)}
          className={`p-2 rounded-full transition-colors flex items-center gap-2 text-sm font-medium ${
            ordemCrescente ? 'bg-[#2DD4BF]/20 text-[#2DD4BF]' : 'bg-gray-800 text-gray-300 hover:text-white'
          }`}
          title="Inverter Ordem"
        >
          <ArrowDownUp size={18} />
        </button>
      </header>

      {/* 🟢 Abas Rápida de Filtro 🟢 */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button 
          onClick={() => { setFiltroAba('todas'); setItensVisiveis(5); }}
          className={`px-4 py-1.5 font-semibold rounded-full text-sm transition-colors ${
            filtroAba === 'todas' ? 'bg-[#2DD4BF] text-[#05080f]' : 'bg-[#1c1c1e] text-gray-400'
          }`}
        >
          Todas
        </button>
        <button 
          onClick={() => { setFiltroAba('este_mes'); setItensVisiveis(5); }}
          className={`px-4 py-1.5 font-semibold rounded-full text-sm transition-colors ${
            filtroAba === 'este_mes' ? 'bg-[#2DD4BF] text-[#05080f]' : 'bg-[#1c1c1e] text-gray-400'
          }`}
        >
          Este Mês
        </button>
      </div>

      <div className="mt-4 pb-20">
        {corridasPaginadas.length === 0 ? (
          <div className="text-center py-10 bg-[#1c1c1e] rounded-3xl border border-white/5">
            <p className="text-gray-400">Nenhum racha encontrado.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 🟢 Renderizando os grupos separados por mês 🟢 */}
            {Object.entries(corridasAgrupadas).map(([mes, corridasDoMes]) => (
              <div key={mes}>
                <h3 className="text-gray-400 mb-3 text-sm font-medium sticky top-0 bg-[#05080f]/90 py-2 backdrop-blur-sm z-10">
                  {mes}
                </h3>
                
                <div className="space-y-3">
                  {corridasDoMes.map((corrida) => (
                    <RideCard 
                      key={corrida.id}
                      data={corrida.data}
                      tag={corrida.tag}
                      titulo={corrida.titulo}
                      valorTotal={corrida.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      participantes={[
                        { id: 0, nome: 'Você', cor: 'bg-gray-600' },
                        ...getParticipantesCompletos(corrida.participantesIds).map(a => ({
                          id: Number(a.id) || Math.random(), 
                          nome: a.nome,
                          cor: a.cor
                        }))
                      ]}
                      onClick={() => setCorridaSelecionada(corrida)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* 🟢 Botão de Carregar Mais (Paginação) 🟢 */}
            {temMaisCorridas && (
              <button 
                onClick={() => setItensVisiveis(prev => prev + 5)}
                className="w-full py-4 mt-6 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
              >
                Ver mais rachas
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
        onClose={() => setCorridaSelecionada(null)} 
        onDelete={deletarCorrida}
      />
    </div>
  );
}