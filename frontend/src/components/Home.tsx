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
import { TopBar } from './TopBar';
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

  const carregarDashboard = async (periodo = periodoRef.current, showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const config = await dbService.settings.get();
      setNomeUsuario(config.nome || config.name || 'Usuário');

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
    let isSubscribed = true;
    let isInitialSyncEvent = true;
    const unsub = dbService.sync.subscribe((st) => {
      if (isInitialSyncEvent) {
        isInitialSyncEvent = false;
        return;
      }
      if (isSubscribed && st.state === 'synced') {
        carregarDashboard(periodoRef.current, false);
      }
    });
    return () => {
      isSubscribed = false;
      unsub();
    };
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
      <div className="space-y-4">
        <TopBar
          title="Início"
          subtitle="Calculando finanças..."
          onNavigateToProfile={onNavigateToProfile}
        />
        <div className="flex flex-col items-center justify-center h-64 text-[var(--primary)]">
          <LoaderCircle size={40} strokeWidth={2} className="animate-spin mb-4" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Calculando finanças...</p>
        </div>
      </div>
    );
  }

  const totalReceber = Number(dashboard.totalAReceber || 0);
  const totalPagar = Number(dashboard.totalAPagar || 0);
  const saldoGeral = Number((totalReceber - totalPagar).toFixed(2));

  return (
    <div className="space-y-5">
      <TopBar
        title={`Olá, ${nomeUsuario.split(' ')[0]}`}
        subtitle={
          periodoSelecionado === 'all'
            ? 'Seu resumo de todos os meses'
            : `Seu resumo de ${formatarMesAno(periodoSelecionado)}`
        }
        onNavigateToProfile={onNavigateToProfile}
        rightContent={
          onOpenNotifications ? (
            <button
              onClick={onOpenNotifications}
              title="Notificações"
              className="relative w-10 h-10 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors shadow-sm shrink-0 active:scale-95"
            >
              <Bell size={18} strokeWidth={2} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F43F5E] text-white text-xs font-bold flex items-center justify-center border-2 border-[var(--bg-app)]">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
          ) : undefined
        }
      />

      {/* Banner de Atualização Disponível (Opcional / Não-bloqueante) */}
      {updateInfo && updateInfo.isNewer && (
        <div className="ds-card p-4 border-[var(--primary)]/30 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <Sparkles size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-sm text-[var(--text-primary)] truncate">
                Nova versão disponível ({updateInfo.tagName})
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                Atualização opcional com melhorias
              </p>
            </div>
          </div>
          <button
            onClick={onOpenUpdateModal}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <Download size={14} strokeWidth={2} />
            <span>Atualizar</span>
          </button>
        </div>
      )}

      {/* Card Principal: Saldo Geral + Seletor de Período + A Receber e A Pagar */}
      <div className="ds-card p-5 sm:p-6 space-y-5">
        {/* Topo do Card: Saldo Líquido e Seletor de Mês / Todos */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider block">
              Balanço Geral
            </span>
            <p
              className={`text-display mt-1 tabular-nums ${
                saldoGeral > 0.01
                  ? 'text-[#10B981]'
                  : saldoGeral < -0.01
                  ? 'text-[#F43F5E]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {saldoGeral > 0.01 ? '+ ' : saldoGeral < -0.01 ? '- ' : ''}R${' '}
              {moneyConverter(Math.abs(saldoGeral))}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <button
              type="button"
              onClick={() =>
                setPeriodoSelecionado(periodoSelecionado === 'all' ? ymAtual : 'all')
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border shrink-0 ${
                periodoSelecionado === 'all'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              Todos
            </button>

            <div className="relative flex-1 sm:flex-initial sm:min-w-[190px] min-w-0">
              <Calendar
                size={13}
                strokeWidth={2}
                className="text-[var(--primary)] pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              />
              <select
                value={periodoSelecionado}
                onChange={(e) => setPeriodoSelecionado(e.target.value)}
                className="w-full appearance-none bg-[var(--bg-subtle)] text-[var(--text-primary)] text-xs font-semibold pl-7 pr-6 py-1.5 rounded-xl border border-[var(--border-color)] outline-none focus:border-[var(--primary)] transition-colors cursor-pointer truncate"
              >
                <option value="all">Todos os meses</option>
                {mesesDisponiveis.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatarMesAno(ym, ymAtual)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                strokeWidth={2}
                className="text-[var(--text-secondary)] pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
              />
            </div>
          </div>
        </div>

        {/* Cards Semânticos: A Receber (Emerald #10B981) e A Pagar (Rose #F43F5E) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => onNavigateToRachas?.('a_receber')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateToRachas?.('a_receber');
              }
            }}
            className={`bg-[var(--emerald-bg)] rounded-2xl p-3 sm:p-4 flex flex-col justify-between border border-[var(--emerald-border)] min-w-0 transition-all select-none ${
              onNavigateToRachas ? 'cursor-pointer hover:opacity-90 active:scale-[0.98]' : ''
            }`}
            title="Filtrar rachas a receber"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#10B981] rounded-full flex items-center justify-center text-white shrink-0 shadow-sm">
                <TrendingUp size={15} strokeWidth={2} />
              </div>
              <p className="text-[11px] sm:text-xs text-[#10B981] font-bold uppercase tracking-normal whitespace-nowrap">
                A receber
              </p>
            </div>
            <p className="font-display font-bold text-[#10B981] text-lg sm:text-2xl tracking-tight truncate tabular-nums">
              R$ {moneyConverter(totalReceber)}
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => onNavigateToRachas?.('a_pagar')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateToRachas?.('a_pagar');
              }
            }}
            className={`bg-[var(--rose-bg)] rounded-2xl p-3 sm:p-4 flex flex-col justify-between border border-[var(--rose-border)] min-w-0 transition-all select-none ${
              onNavigateToRachas ? 'cursor-pointer hover:opacity-90 active:scale-[0.98]' : ''
            }`}
            title="Filtrar rachas a pagar"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#F43F5E] rounded-full flex items-center justify-center text-white shrink-0 shadow-sm">
                <TrendingDown size={15} strokeWidth={2} />
              </div>
              <p className="text-[11px] sm:text-xs text-[#F43F5E] font-bold uppercase tracking-normal whitespace-nowrap">
                A pagar
              </p>
            </div>
            <p className="font-display font-bold text-[#F43F5E] text-lg sm:text-2xl tracking-tight truncate tabular-nums">
              R$ {moneyConverter(totalPagar)}
            </p>
          </div>
        </div>
      </div>

      {/* Seção Pendências com Amigos */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-h2 text-[var(--text-primary)]">Amigos com pendências</h3>
          {dashboard.amigosDevedores.length > 0 && (
            <span className="text-caption text-[var(--text-secondary)]">
              {dashboard.amigosDevedores.length}{' '}
              {dashboard.amigosDevedores.length === 1 ? 'pendente' : 'pendentes'}
            </span>
          )}
        </div>

        {dashboard.amigosDevedores.length === 0 ? (
          <div className="ds-card p-6 text-center">
            <p className="text-[var(--text-secondary)] text-sm flex items-center justify-center gap-2">
              <CheckCircle2 size={18} strokeWidth={2} className="text-[#10B981] shrink-0" />
              <span>Tudo em dia com seus amigos.</span>
            </p>
          </div>
        ) : (
          <div
            data-horizontal-scroll="true"
            className="flex gap-4 overflow-x-auto pt-2 pb-3 px-1 scrollbar-hide -mt-1"
          >
            {dashboard.amigosDevedores.map((amigo) => {
              const nome = amigo.nome || amigo.name || 'Amigo';
              const cor = amigo.cor || amigo.color || 'bg-teal-600';
              const divida = Number(amigo.divida || 0);
              const voceDeve = Number(amigo.voceDeve || 0);
              const saldoLiquido = Number((divida - voceDeve).toFixed(2));
              const isVoceDeve = saldoLiquido < -0.01;
              const valorExibido = Math.abs(saldoLiquido);

              return (
                <div
                  key={amigo.id}
                  role="button"
                  tabIndex={0}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAmigoSelecionado({
                        ...amigo,
                        nome,
                        cor,
                        divida: isVoceDeve ? 0 : valorExibido,
                        dividaNumerica: isVoceDeve ? 0 : valorExibido,
                        voceDeve: isVoceDeve ? valorExibido : 0,
                        voceDeveNumerico: isVoceDeve ? valorExibido : 0,
                        saldoLiquido,
                      });
                    }
                  }}
                  className="flex flex-col items-center gap-2 min-w-[80px] max-w-[88px] cursor-pointer active:scale-95 transition-transform shrink-0 select-none"
                >
                  <div className="relative">
                    <div
                      style={
                        amigo.avatar_url ? undefined : { backgroundColor: getAvatarColor(cor) }
                      }
                      className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center shadow-sm border-2 border-[var(--bg-surface)]"
                    >
                      {amigo.avatar_url ? (
                        <img
                          src={amigo.avatar_url}
                          alt={nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-display font-bold text-white">
                          {nome[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div
                      className={`absolute -top-0.5 -right-0.5 w-5 h-5 ${
                        isVoceDeve ? 'bg-[#F43F5E]' : 'bg-[#10B981]'
                      } rounded-full border-2 border-[var(--bg-app)] flex items-center justify-center shadow-sm select-none`}
                    >
                      <span className="text-xs font-bold text-white leading-none select-none block">
                        {isVoceDeve ? '-' : '+'}
                      </span>
                    </div>
                  </div>
                  <div className="text-center w-full">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-full flex items-center justify-center gap-1 mx-auto">
                      <span className="truncate">{nome.split(' ')[0]}</span>
                      {(amigo.has_account || amigo.is_registered) && (
                        <BadgeCheck size={13} strokeWidth={2} className="text-[var(--primary)] fill-[var(--primary-light)] shrink-0" />
                      )}
                    </p>
                    <p
                      className={`text-xs font-display font-bold truncate tabular-nums mt-0.5 ${
                        isVoceDeve ? 'text-[#F43F5E]' : 'text-[#10B981]'
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
          <h3 className="text-h2 text-[var(--text-primary)]">Grupos com pendências</h3>
          {dashboard.gruposPendentes.length > 0 && (
            <span className="text-caption text-[var(--text-secondary)]">
              {dashboard.gruposPendentes.length}{' '}
              {dashboard.gruposPendentes.length === 1 ? 'pendente' : 'pendentes'}
            </span>
          )}
        </div>

        {dashboard.gruposPendentes.length === 0 ? (
          <div className="ds-card p-6 text-center">
            <p className="text-[var(--text-secondary)] text-sm flex items-center justify-center gap-2">
              <CheckCircle2 size={18} strokeWidth={2} className="text-[#10B981] shrink-0" />
              <span>Nenhum grupo com pendências.</span>
            </p>
          </div>
        ) : (
          <div
            data-horizontal-scroll="true"
            className="flex gap-4 overflow-x-auto pt-2 pb-3 px-1 scrollbar-hide -mt-1"
          >
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
                  role="button"
                  tabIndex={0}
                  onClick={() => setGrupoSelecionadoId(grupo.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setGrupoSelecionadoId(grupo.id);
                    }
                  }}
                  className="flex flex-col items-center gap-2 min-w-[80px] max-w-[88px] cursor-pointer active:scale-95 transition-transform shrink-0 select-none"
                >
                  <div className="relative">
                    <div
                      style={grupo.avatar_url ? undefined : { backgroundColor: cor }}
                      className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center shadow-sm border-2 border-[var(--bg-surface)]"
                    >
                      {grupo.avatar_url ? (
                        <img
                          src={grupo.avatar_url}
                          alt={nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-display font-bold text-white">
                          {nome[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div
                      className={`absolute -top-0.5 -right-0.5 w-5 h-5 ${
                        isVoceDeve ? 'bg-[#F43F5E]' : 'bg-[#10B981]'
                      } rounded-full border-2 border-[var(--bg-app)] flex items-center justify-center shadow-sm select-none`}
                    >
                      <span className="text-xs font-bold text-white leading-none select-none block">
                        {isVoceDeve ? '-' : '+'}
                      </span>
                    </div>
                  </div>
                  <div className="text-center w-full">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-full mx-auto">
                      {nome}
                    </p>
                    <p
                      className={`text-xs font-display font-bold truncate tabular-nums mt-0.5 ${
                        isVoceDeve ? 'text-[#F43F5E]' : 'text-[#10B981]'
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
