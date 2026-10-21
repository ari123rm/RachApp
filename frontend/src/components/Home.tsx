// src/components/Home.tsx
import { useState, useEffect } from 'react';
import { ArrowUpRight, LoaderCircle, TrendingUp, TrendingDown, RefreshCw, BadgeCheck, Sparkles, Download } from 'lucide-react';
import type { AppReleaseInfo } from '../services/updateService';
import { dbService } from '../services/database';
import { FriendDetailsModal } from './FriendDetailsModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import moneyConverter from '../utils/moneyConverter';
import { getAvatarColor, getGroupAvatarColor } from '../utils/avatarColor';
import type { SyncStatus } from '../types';

export function Home({
  onDataChange,
  dataVersion,
  updateInfo,
  onOpenUpdateModal,
}: {
  onDataChange?: () => void;
  dataVersion?: number;
  updateInfo?: AppReleaseInfo | null;
  onOpenUpdateModal?: () => void;
}) {
  const [dashboard, setDashboard] = useState({
    totalGasto: 0,
    totalAReceber: 0,
    totalAPagar: 0,
    amigosDevedores: [] as any[],
    gruposPendentes: [] as any[],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [amigoSelecionado, setAmigoSelecionado] = useState<any>(null);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState('Usuário');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: null,
  });

  const dataAtual = new Date();
  const nomeMesBruto = dataAtual.toLocaleString('pt-BR', { month: 'long' });
  const nomeMesAtual = nomeMesBruto.charAt(0).toUpperCase() + nomeMesBruto.slice(1);

  const carregarDashboard = async () => {
    setIsLoading(true);
    try {
      const config = await dbService.settings.get();
      setNomeUsuario(config.nome || config.name || 'Usuário');

      const dados = await dbService.dashboard.get();
      setDashboard({
        totalGasto: dados.totalGasto || 0,
        totalAReceber: dados.totalAReceber || 0,
        totalAPagar: (dados as any).totalAPagar || 0,
        amigosDevedores: dados.amigosDevedores || [],
        gruposPendentes: (dados as any).gruposPendentes || [],
      });
    } catch (error) {
      console.error('Erro ao carregar Dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDashboard();
    const unsub = dbService.sync.subscribe((st) => {
      setSyncStatus(st);
      if (st.state === 'synced') {
        dbService.dashboard.get().then((dados) => {
          setDashboard({
            totalGasto: dados.totalGasto || 0,
            totalAReceber: dados.totalAReceber || 0,
            totalAPagar: (dados as any).totalAPagar || 0,
            amigosDevedores: dados.amigosDevedores || [],
            gruposPendentes: (dados as any).gruposPendentes || [],
          });
        }).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (dataVersion !== undefined && dataVersion > 0) {
      dbService.dashboard.get().then((dados) => {
        setDashboard({
          totalGasto: dados.totalGasto || 0,
          totalAReceber: dados.totalAReceber || 0,
          totalAPagar: (dados as any).totalAPagar || 0,
          amigosDevedores: dados.amigosDevedores || [],
          gruposPendentes: (dados as any).gruposPendentes || [],
        });
      }).catch(() => {});
    }
  }, [dataVersion]);

  const handleExcluirAmigo = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este amigo?')) return;
    try {
      await dbService.amigos.delete(id);
      setAmigoSelecionado(null);
      await carregarDashboard();
      if (onDataChange) onDataChange();
    } catch (error) {
      alert('Erro ao excluir o amigo.');
    }
  };

  const handleManualSync = async () => {
    await dbService.sync.now();
    await carregarDashboard();
    if (onDataChange) onDataChange();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#2DD4BF]">
        <LoaderCircle size={40} className="animate-spin mb-4" />
        <p className="text-gray-400">Calculando finanças...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex justify-between items-center mt-2">
        <div>
          <h1 className="text-xl font-bold text-white">Olá, {nomeUsuario.split(' ')[0]}</h1>
          <p className="text-xs text-gray-500">Seu resumo de {nomeMesAtual}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            title="Clique para atualizar seus dados"
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border transition-colors ${
              syncStatus.state === 'syncing'
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : syncStatus.state === 'offline'
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30'
            }`}
          >
            <RefreshCw size={11} className={syncStatus.state === 'syncing' ? 'animate-spin' : ''} />
            <span>
              {syncStatus.state === 'syncing'
                ? 'Atualizando...'
                : syncStatus.pendingCount > 0
                ? `Pendente (${syncStatus.pendingCount})`
                : 'Sincronizado'}
            </span>
          </button>

          <div className="w-10 h-10 bg-[#2DD4BF] text-[#05080f] rounded-full flex items-center justify-center font-bold shadow-md">
            <span className="text-sm uppercase">{(nomeUsuario || 'U')[0]}</span>
          </div>
        </div>
      </header>

      {/* Banner de Atualização Disponível (Opcional / Não-bloqueante) */}
      {updateInfo && updateInfo.isNewer && (
        <div className="bg-gradient-to-r from-[#2DD4BF]/15 via-sky-500/10 to-[#1c1c1e] border border-[#2DD4BF]/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-fade-in shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center shrink-0 border border-[#2DD4BF]/30">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-bold truncate">
                Nova versão disponível ({updateInfo.tagName})
              </p>
              <p className="text-gray-400 text-[10px] truncate">
                Atualização opcional com melhorias
              </p>
            </div>
          </div>
          <button
            onClick={onOpenUpdateModal}
            className="bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm"
          >
            <Download size={13} />
            Atualizar
          </button>
        </div>
      )}

      {/* Card Principal: Total Pago (Figura 2 do Artigo) */}
      <div className="bg-gradient-to-br from-[#1A2b4c] via-[#241b3d] to-[#3B1F42] rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-white/5">
        <div className="relative z-10">
          <div className="flex justify-between items-start">
            <p className="text-gray-300 text-sm mb-1">Total em Rachas ({nomeMesAtual}):</p>
            <ArrowUpRight size={18} className="text-[#2DD4BF]" />
          </div>
          <div className="flex items-end gap-2 mb-4">
            <h2 className="text-4xl font-black tracking-tight text-white">
              R$ {moneyConverter(Number(dashboard.totalGasto || 0))}
            </h2>
          </div>

          <div
            className={`grid gap-2.5 ${
              dashboard.totalAPagar > 0.01 ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex items-center gap-2.5 border border-white/10">
              <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-[#05080f] shrink-0">
                <TrendingUp size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider truncate">
                  A receber
                </p>
                <p className="text-amber-300 font-bold text-sm truncate">
                  R$ {moneyConverter(Number(dashboard.totalAReceber || 0))}
                </p>
              </div>
            </div>

            {dashboard.totalAPagar > 0.01 && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex items-center gap-2.5 border border-white/10">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white shrink-0">
                  <TrendingDown size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider truncate">
                    A pagar
                  </p>
                  <p className="text-red-400 font-bold text-sm truncate">
                    R$ {moneyConverter(Number(dashboard.totalAPagar || 0))}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seção Pendências com Amigos */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-200">Amigos com pendências</h3>
          {dashboard.amigosDevedores.length > 0 && (
            <span className="text-xs text-gray-500 font-medium">
              {dashboard.amigosDevedores.length}{' '}
              {dashboard.amigosDevedores.length === 1 ? 'pendente' : 'pendentes'}
            </span>
          )}
        </div>

        {dashboard.amigosDevedores.length === 0 ? (
          <div className="bg-[#1c1c1e] p-6 rounded-3xl border border-white/5 text-center">
            <p className="text-gray-500 text-sm italic">Nenhuma dívida pendente. ✌️</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pt-2.5 pb-4 px-1 scrollbar-hide -mt-2">
            {dashboard.amigosDevedores.map((amigo) => {
              const nome = amigo.nome || amigo.name || 'Amigo';
              const cor = amigo.cor || amigo.color || 'bg-sky-500';
              const divida = Number(amigo.divida || 0);
              const voceDeve = Number(amigo.voceDeve || 0);
              const saldoLiquido = Number((divida - voceDeve).toFixed(2));
              const isVoceDeve = saldoLiquido < -0.01;
              const valorExibido = Math.abs(saldoLiquido);

              return (
                <div
                  key={amigo.id}
                  onClick={() =>
                    setAmigoSelecionado({
                      ...amigo,
                      nome,
                      cor,
                      divida: isVoceDeve ? 0 : valorExibido,
                      dividaNumerica: isVoceDeve ? 0 : valorExibido,
                      voceDeve: isVoceDeve ? valorExibido : 0,
                      voceDeveNumerico: isVoceDeve ? valorExibido : 0,
                      saldoLiquido,
                    })
                  }
                  className="flex flex-col items-center gap-2 min-w-[85px] cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="relative">
                    <div
                      style={{ backgroundColor: getAvatarColor(cor) }}
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-2 border-[#05080f]"
                    >
                      <span className="text-2xl font-black text-white">
                        {nome[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div
                      className={`absolute -top-1 -right-1 w-5 h-5 ${
                        isVoceDeve ? 'bg-red-500' : 'bg-amber-500'
                      } rounded-full border-2 border-[#05080f] flex items-center justify-center shadow-sm select-none`}
                    >
                      <span className="text-[11px] font-black text-white leading-none select-none block">!</span>
                    </div>
                  </div>
                  <div className="text-center w-full">
                    <p className="text-xs font-semibold text-white truncate max-w-[85px] flex items-center justify-center gap-1 mx-auto">
                      <span className="truncate">{nome.split(' ')[0]}</span>
                      {(amigo.has_account || amigo.is_registered) && (
                        <BadgeCheck size={13} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
                      )}
                    </p>
                    <p
                      className={`text-[11px] font-bold ${
                        isVoceDeve ? 'text-red-400' : 'text-amber-400'
                      }`}
                    >
                      R$ {moneyConverter(valorExibido)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Seção Pendências em Grupos */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-200">Grupos com pendências</h3>
          {dashboard.gruposPendentes.length > 0 && (
            <span className="text-xs text-gray-500 font-medium">
              {dashboard.gruposPendentes.length}{' '}
              {dashboard.gruposPendentes.length === 1 ? 'pendente' : 'pendentes'}
            </span>
          )}
        </div>

        {dashboard.gruposPendentes.length === 0 ? (
          <div className="bg-[#1c1c1e] p-6 rounded-3xl border border-white/5 text-center">
            <p className="text-gray-500 text-sm italic">Nenhum grupo com pendências. ✌️</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pt-2.5 pb-4 px-1 scrollbar-hide -mt-2">
            {dashboard.gruposPendentes.map((grupo) => {
              const nome = grupo.nome || grupo.name || 'Grupo';
              const cor = getGroupAvatarColor(grupo.cor || grupo.color || nome || grupo.id);
              const divida = Number(grupo.divida || 0);
              const voceDeve = Number(grupo.voceDeve || 0);
              const saldoLiquido =
                grupo.saldoLiquido !== undefined
                  ? Number(grupo.saldoLiquido)
                  : Number((divida - voceDeve).toFixed(2));
              const isVoceDeve = saldoLiquido < -0.01;
              const valorExibido = Math.abs(saldoLiquido);

              return (
                <div
                  key={grupo.id}
                  onClick={() => setGrupoSelecionadoId(grupo.id)}
                  className="flex flex-col items-center gap-2 min-w-[85px] cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="relative">
                    <div
                      style={{ backgroundColor: cor }}
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-2 border-[#05080f]"
                    >
                      <span className="text-2xl font-black text-white">
                        {nome[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div
                      className={`absolute -top-1 -right-1 w-5 h-5 ${
                        isVoceDeve ? 'bg-red-500' : 'bg-amber-500'
                      } rounded-full border-2 border-[#05080f] flex items-center justify-center shadow-sm select-none`}
                    >
                      <span className="text-[11px] font-black text-white leading-none select-none block">!</span>
                    </div>
                  </div>
                  <div className="text-center w-full">
                    <p className="text-xs font-semibold text-white truncate max-w-[85px] mx-auto">
                      {nome}
                    </p>
                    <p
                      className={`text-[11px] font-bold ${
                        isVoceDeve ? 'text-red-400' : 'text-amber-400'
                      }`}
                    >
                      R$ {moneyConverter(valorExibido)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FriendDetailsModal
        amigo={amigoSelecionado}
        isOpen={!!amigoSelecionado}
        onClose={() => {
          setAmigoSelecionado(null);
          carregarDashboard();
        }}
        onDelete={handleExcluirAmigo}
        update={() => {
          carregarDashboard();
          if (onDataChange) onDataChange();
        }}
      />

      <GroupDetailsModal
        grupoId={grupoSelecionadoId}
        isOpen={!!grupoSelecionadoId}
        onClose={() => {
          setGrupoSelecionadoId(null);
          carregarDashboard();
        }}
        onChanged={() => {
          carregarDashboard();
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}
