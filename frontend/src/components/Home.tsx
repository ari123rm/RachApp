// src/components/Home.tsx
import { useState, useEffect, useRef } from 'react';
import {
  LoaderCircle,
  TrendingUp,
  TrendingDown,
  BadgeCheck,
  Sparkles,
  Download,
  Calendar,
  ChevronDown,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import type { AppReleaseInfo } from '../services/updateService';
import { dbService } from '../services/database';
import { FriendDetailsModal } from './FriendDetailsModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import moneyConverter from '../utils/moneyConverter';
import { getAvatarColor, getGroupAvatarColor } from '../utils/avatarColor';

function formatarMesAno(ym: string, ymAtual?: string): string {
  if (ym === 'all') return 'Todos os meses';
  const [anoStr, mesStr] = ym.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  if (!ano || !mes) return ym;
  const d = new Date(ano, mes - 1, 1);
  const nomeMes = d.toLocaleString('pt-BR', { month: 'long' });
  const nomeCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
  const sufixoAtual = ymAtual && ym === ymAtual ? ' (Atual)' : '';
  return `${nomeCapitalizado} ${ano}${sufixoAtual}`;
}

export function Home({
  onDataChange,
  dataVersion,
  updateInfo,
  onOpenUpdateModal,
  onOpenNotifications,
  onNavigateToRachas,
  onNavigateToProfile,
}: {
  onDataChange?: () => void;
  dataVersion?: number;
  updateInfo?: AppReleaseInfo | null;
  onOpenUpdateModal?: () => void;
  onOpenNotifications?: () => void;
  onNavigateToRachas?: (filtro: 'tudo' | 'a_pagar' | 'a_receber' | 'quitados') => void;
  onNavigateToProfile?: () => void;
}) {
  const dataAtual = new Date();
  const ymAtual = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;

  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>('all');
  const periodoRef = useRef<string>('all');
  periodoRef.current = periodoSelecionado;

  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([ymAtual]);
  const [dashboard, setDashboard] = useState({
    totalAReceber: 0,
    totalAPagar: 0,
    amigosDevedores: [] as any[],
    gruposPendentes: [] as any[],
  });
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoadRef = useRef(true);

  const [amigoSelecionado, setAmigoSelecionado] = useState<any>(null);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState('Usuário');
  const [avatarUsuario, setAvatarUsuario] = useState<string | null>(null);

  const carregarDashboard = async (periodo = periodoRef.current, showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const config = await dbService.settings.get();
      setNomeUsuario(config.nome || config.name || 'Usuário');
      setAvatarUsuario(config.avatar_url || null);

      const dados = await dbService.dashboard.get(periodo);
      if (Array.isArray((dados as any).mesesDisponiveis) && (dados as any).mesesDisponiveis.length > 0) {
        setMesesDisponiveis((dados as any).mesesDisponiveis);
      }
      setDashboard({
        totalAReceber: dados.totalAReceber || 0,
        totalAPagar: (dados as any).totalAPagar || 0,
        amigosDevedores: dados.amigosDevedores || [],
        gruposPendentes: (dados as any).gruposPendentes || [],
      });

      try {
        const notifCount = await dbService.notifications.getUnreadCount();
        setUnreadNotifCount(notifCount);
      } catch {
        // Ignora erro de contagem
      }
    } catch (error) {
      console.error('Erro ao carregar Dashboard:', error);
    } finally {
      setIsLoading(false);
      isFirstLoadRef.current = false;
    }
  };

  useEffect(() => {
    carregarDashboard(periodoRef.current, isFirstLoadRef.current);
  }, [periodoSelecionado]);

  useEffect(() => {
    const unsub = dbService.sync.subscribe((st) => {
      if (st.state === 'synced') {
        carregarDashboard(periodoRef.current, false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (dataVersion !== undefined && dataVersion > 0) {
      carregarDashboard(periodoRef.current, false);
    }
  }, [dataVersion]);

  const handleExcluirAmigo = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este amigo?')) return;
    try {
      await dbService.amigos.delete(id);
      setAmigoSelecionado(null);
      await carregarDashboard(periodoRef.current, false);
      if (onDataChange) onDataChange();
    } catch (error) {
      alert('Erro ao excluir o amigo.');
    }
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
      <header className="flex justify-between items-center mt-1 sm:mt-2 gap-2 min-w-0">
        <div className="min-w-0 flex-1 pr-1">
          <h1 className="text-lg sm:text-xl font-bold text-white truncate">Olá, {nomeUsuario.split(' ')[0]}</h1>
          <p className="text-xs text-gray-500 truncate">
            {periodoSelecionado === 'all'
              ? 'Seu resumo de todos os meses'
              : `Seu resumo de ${formatarMesAno(periodoSelecionado)}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Botão de Notificações */}
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              title="Notificações"
              className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#18202c] border border-gray-800 text-gray-300 hover:text-white flex items-center justify-center transition-colors shadow-sm shrink-0 active:scale-95"
            >
              <Bell size={16} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#2DD4BF] text-[#05080f] text-[9px] font-black flex items-center justify-center border-2 border-[#0a0f16]">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
          )}

          {/* Avatar que leva para a aba do Perfil */}
          <button
            type="button"
            onClick={onNavigateToProfile}
            title="Ir para o meu perfil"
            className="w-8 h-8 sm:w-10 sm:h-10 bg-[#2DD4BF] text-[#05080f] rounded-full overflow-hidden flex items-center justify-center font-bold shadow-md border border-[#2DD4BF]/30 shrink-0 cursor-pointer hover:ring-2 hover:ring-[#2DD4BF] transition-all active:scale-95"
          >
            {avatarUsuario ? (
              <img
                src={avatarUsuario}
                alt={nomeUsuario}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs sm:text-sm uppercase font-black">{(nomeUsuario || 'U')[0]}</span>
            )}
          </button>
        </div>
      </header>

      {/* Banner de Atualização Disponível (Opcional / Não-bloqueante) */}
      {updateInfo && updateInfo.isNewer && (
        <div className="bg-gradient-to-r from-[#2DD4BF]/15 via-sky-500/10 to-[#1c1c1e] border border-[#2DD4BF]/30 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2.5 animate-fade-in shadow-md">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center shrink-0 border border-[#2DD4BF]/30">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0 flex-1">
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
            className="bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm"
          >
            <Download size={13} />
            <span>Atualizar</span>
          </button>
        </div>
      )}

      {/* Card Principal: Seletor de Período + A Receber e A Pagar */}
      <div className="bg-gradient-to-br from-[#1A2b4c] via-[#241b3d] to-[#3B1F42] rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden border border-white/5">
        <div className="relative z-10 space-y-3.5 sm:space-y-4">
          {/* Topo do Card: Título e Seletor de Mês / Todos */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 text-gray-300 text-xs font-semibold shrink-0">
              <Calendar size={13} className="text-[#2DD4BF] shrink-0" />
              <span className="hidden xs:inline">Período:</span>
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() =>
                  setPeriodoSelecionado(periodoSelecionado === 'all' ? ymAtual : 'all')
                }
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-colors border shrink-0 ${
                  periodoSelecionado === 'all'
                    ? 'bg-[#2DD4BF] text-[#05080f] border-[#2DD4BF]'
                    : 'bg-white/10 text-gray-300 hover:bg-white/15 border-white/10'
                }`}
              >
                Todos
              </button>

              <div className="relative min-w-0 max-w-[150px] sm:max-w-[200px]">
                <select
                  value={periodoSelecionado}
                  onChange={(e) => setPeriodoSelecionado(e.target.value)}
                  className="w-full appearance-none bg-[#121626]/80 hover:bg-[#121626] text-white text-xs font-bold pl-2.5 pr-6 py-1 sm:py-1.5 rounded-xl border border-white/15 outline-none focus:border-[#2DD4BF] transition-colors cursor-pointer truncate"
                >
                  <option value="all" className="bg-[#141923] text-white">
                    Todos os meses
                  </option>
                  {mesesDisponiveis.map((ym) => (
                    <option key={ym} value={ym} className="bg-[#141923] text-white">
                      {formatarMesAno(ym, ymAtual)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="text-gray-400 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2"
                />
              </div>
            </div>
          </div>

          {/* Cards A Receber e A Pagar */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div
              onClick={() => onNavigateToRachas?.('a_receber')}
              className={`bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between border border-white/10 min-w-0 transition-all ${
                onNavigateToRachas
                  ? 'cursor-pointer hover:bg-white/15 active:scale-[0.98]'
                  : ''
              }`}
              title="Filtrar rachas a receber"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-400 rounded-full flex items-center justify-center text-[#05080f] shrink-0">
                  <TrendingUp size={15} />
                </div>
                <p className="text-[10px] text-gray-300 uppercase font-bold tracking-wider truncate">
                  A receber
                </p>
              </div>
              <p className="text-amber-300 font-black text-lg sm:text-2xl tracking-tight truncate tabular-nums">
                R$ {moneyConverter(Number(dashboard.totalAReceber || 0))}
              </p>
            </div>

            <div
              onClick={() => onNavigateToRachas?.('a_pagar')}
              className={`bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between border border-white/10 min-w-0 transition-all ${
                onNavigateToRachas
                  ? 'cursor-pointer hover:bg-white/15 active:scale-[0.98]'
                  : ''
              }`}
              title="Filtrar rachas a pagar"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-red-500 rounded-full flex items-center justify-center text-white shrink-0">
                  <TrendingDown size={15} />
                </div>
                <p className="text-[10px] text-gray-300 uppercase font-bold tracking-wider truncate">
                  A pagar
                </p>
              </div>
              <p className="text-red-400 font-black text-lg sm:text-2xl tracking-tight truncate tabular-nums">
                R$ {moneyConverter(Number(dashboard.totalAPagar || 0))}
              </p>
            </div>
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
            <p className="text-gray-500 text-sm italic flex items-center justify-center gap-2">
              <CheckCircle2 size={16} className="text-[#2DD4BF] shrink-0" />
              <span>Nenhuma dívida pendente.</span>
            </p>
          </div>
        ) : (
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pt-2 pb-3 px-1 scrollbar-hide -mt-1 overscroll-x-contain touch-pan-x">
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
                  className="flex flex-col items-center gap-1.5 min-w-[76px] max-w-[85px] sm:min-w-[85px] cursor-pointer active:scale-95 transition-transform shrink-0"
                >
                  <div className="relative">
                    <div
                      style={
                        amigo.avatar_url ? undefined : { backgroundColor: getAvatarColor(cor) }
                      }
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center shadow-lg border-2 border-[#05080f]"
                    >
                      {amigo.avatar_url ? (
                        <img
                          src={amigo.avatar_url}
                          alt={nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl sm:text-2xl font-black text-white">
                          {nome[0]?.toUpperCase()}
                        </span>
                      )}
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
                    <p className="text-xs font-semibold text-white truncate max-w-full flex items-center justify-center gap-1 mx-auto">
                      <span className="truncate">{nome.split(' ')[0]}</span>
                      {(amigo.has_account || amigo.is_registered) && (
                        <BadgeCheck size={13} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
                      )}
                    </p>
                    <p
                      className={`text-[11px] font-bold truncate tabular-nums ${
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
            <p className="text-gray-500 text-sm italic flex items-center justify-center gap-2">
              <CheckCircle2 size={16} className="text-[#2DD4BF] shrink-0" />
              <span>Nenhum grupo com pendências.</span>
            </p>
          </div>
        ) : (
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pt-2 pb-3 px-1 scrollbar-hide -mt-1 overscroll-x-contain touch-pan-x">
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
                  className="flex flex-col items-center gap-1.5 min-w-[76px] max-w-[85px] sm:min-w-[85px] cursor-pointer active:scale-95 transition-transform shrink-0"
                >
                  <div className="relative">
                    <div
                      style={grupo.avatar_url ? undefined : { backgroundColor: cor }}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center shadow-lg border-2 border-[#05080f]"
                    >
                      {grupo.avatar_url ? (
                        <img
                          src={grupo.avatar_url}
                          alt={nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl sm:text-2xl font-black text-white">
                          {nome[0]?.toUpperCase()}
                        </span>
                      )}
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
                    <p className="text-xs font-semibold text-white truncate max-w-full mx-auto">
                      {nome}
                    </p>
                    <p
                      className={`text-[11px] font-bold truncate tabular-nums ${
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
          carregarDashboard(periodoRef.current, false);
        }}
        onDelete={handleExcluirAmigo}
        update={() => {
          carregarDashboard(periodoRef.current, false);
          if (onDataChange) onDataChange();
        }}
      />

      <GroupDetailsModal
        grupoId={grupoSelecionadoId}
        isOpen={!!grupoSelecionadoId}
        onClose={() => {
          setGrupoSelecionadoId(null);
          carregarDashboard(periodoRef.current, false);
        }}
        onChanged={() => {
          carregarDashboard(periodoRef.current, false);
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}
