// src/components/RideCard.tsx
import {
  Check,
  CheckCircle2,
  Clock,
  Car,
  Utensils,
  ShoppingCart,
  Home,
  Briefcase,
  Receipt,
} from 'lucide-react';
import { getAvatarColor } from '../utils/avatarColor';
import moneyConverter from '../utils/moneyConverter';
import type { RideUserStatus } from '../utils/rideStatus';

interface RideProps {
  data: string;
  tag: string;
  titulo: string;
  valorTotal: string;
  participantes: { id: number | string; nome: string; cor: string; avatar_url?: string | null }[];
  userStatus?: RideUserStatus;
  paidByName?: string | null;
  onClick?: () => void;
}

export function formatRideDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const mIdx = parseInt(month, 10) - 1;
  const mName = monthNames[mIdx] || month;
  const currentYear = String(new Date().getFullYear());
  if (year === currentYear) {
    return `${parseInt(day, 10)} ${mName}`;
  }
  return `${parseInt(day, 10)} ${mName} ${year.slice(-2)}`;
}

export function formatRideDateHeader(dateStr: string): string {
  if (!dateStr) return 'Sem data';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return dateStr;

  const dateObj = new Date(year, month - 1, day);
  const diasSemana = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
  ];
  const diaSemana = diasSemana[dateObj.getDay()] || '';
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const currentYear = new Date().getFullYear();
  const dataFormatada = year === currentYear ? `${dd}/${mm}` : `${dd}/${mm}/${year}`;
  return diaSemana ? `${dataFormatada}, ${diaSemana}` : dataFormatada;
}

export function getCategoryIcon(tag: string) {
  const lower = (tag || '').toLowerCase();
  if (
    lower.includes('transporte') ||
    lower.includes('uber') ||
    lower.includes('99') ||
    lower.includes('carro') ||
    lower.includes('gasolina') ||
    lower.includes('viagem')
  ) {
    return Car;
  }
  if (
    lower.includes('comida') ||
    lower.includes('jantar') ||
    lower.includes('almoço') ||
    lower.includes('almoco') ||
    lower.includes('lanche') ||
    lower.includes('pizza') ||
    lower.includes('restaurante') ||
    lower.includes('bar') ||
    lower.includes('ifood')
  ) {
    return Utensils;
  }
  if (lower.includes('mercado') || lower.includes('compra') || lower.includes('supermercado')) {
    return ShoppingCart;
  }
  if (
    lower.includes('casa') ||
    lower.includes('aluguel') ||
    lower.includes('luz') ||
    lower.includes('agua') ||
    lower.includes('água') ||
    lower.includes('internet') ||
    lower.includes('energia')
  ) {
    return Home;
  }
  if (lower.includes('trabalho') || lower.includes('escritorio') || lower.includes('escritório')) {
    return Briefcase;
  }
  return Receipt;
}

export function RideStatusView({
  userStatus,
  valorTotal,
}: {
  userStatus?: RideUserStatus;
  valorTotal?: string;
}) {
  if (!userStatus) {
    return (
      <div className="bg-[var(--primary-light)] text-[var(--primary)] px-3 py-1 rounded-xl font-bold font-display text-xs tabular-nums">
        R$ {valorTotal}
      </div>
    );
  }

  if (userStatus.status === 'pagante') {
    return (
      <div className="text-right flex flex-col items-end shrink-0 max-w-[140px] sm:max-w-[170px]">
        <span className="inline-flex items-center gap-1.5 text-xs bg-[var(--emerald-bg)] text-[#10B981] border border-[var(--emerald-border)] px-2.5 py-0.5 rounded-full font-medium shrink-0">
          <CheckCircle2 size={12} strokeWidth={2} /> Pagante
        </span>
        {userStatus.amountOwedToYou > 0.01 ? (
          <span className="text-xs font-bold font-display text-[#10B981] mt-1 truncate max-w-full tabular-nums">
            + R$ {moneyConverter(userStatus.amountOwedToYou)}
          </span>
        ) : (
          <span className="text-xs font-medium text-[#10B981] mt-1 flex items-center gap-1 shrink-0">
            <Check size={12} strokeWidth={2} /> Quitado
          </span>
        )}
      </div>
    );
  }

  if (userStatus.status === 'pendente') {
    return (
      <div className="text-right flex flex-col items-end shrink-0 max-w-[140px] sm:max-w-[170px]">
        <span className="inline-flex items-center gap-1.5 text-xs bg-[var(--rose-bg)] text-[#F43F5E] border border-[var(--rose-border)] px-2.5 py-0.5 rounded-full font-medium shrink-0">
          <Clock size={12} strokeWidth={2} /> Pendente
        </span>
        <span className="text-xs font-bold font-display text-[#F43F5E] mt-1 truncate max-w-full tabular-nums">
          - R$ {moneyConverter(userStatus.amountYouOwe)}
        </span>
      </div>
    );
  }

  return (
    <div className="text-right flex flex-col items-end shrink-0 max-w-[140px] sm:max-w-[170px]">
      <span className="inline-flex items-center gap-1.5 text-xs bg-[var(--emerald-bg)] text-[#10B981] border border-[var(--emerald-border)] px-2.5 py-0.5 rounded-full font-medium shrink-0">
        <Check size={12} strokeWidth={2} /> Pago
      </span>
      <span className="text-xs text-[var(--text-secondary)] font-medium mt-1 truncate max-w-full tabular-nums">
        Sua parte: R$ {moneyConverter(userStatus.myShare)}
      </span>
    </div>
  );
}

export function RideCard({
  tag,
  titulo,
  valorTotal,
  participantes,
  userStatus,
  paidByName,
  onClick,
}: RideProps) {
  const cleanTag = (tag || '').trim() || 'Uber';
  const cleanTitle = (titulo || '').trim();
  const displayTitle = cleanTitle || cleanTag;

  const CategoryIcon = getCategoryIcon(cleanTag || displayTitle);

  const tagFontSizeClass =
    cleanTag.length > 10
      ? 'text-[9px] sm:text-[10px] tracking-tighter'
      : cleanTag.length > 7
      ? 'text-[9.5px] sm:text-[10.5px] tracking-tight'
      : 'text-[10px] sm:text-[11px]';

  // Ordena para que os amigos apareçam primeiro nos avatares e 'Você' fique por último
  const amigos = participantes.filter((p) => p.nome !== 'Você');
  const voce = participantes.find((p) => p.nome === 'Você');
  const orderedParticipants = voce ? [...amigos, voce] : amigos;

  // Limita a no máximo 3 bolinhas na pilha (ex: 2 avatares + +N quando houver > 3 participantes)
  const maxVisible = orderedParticipants.length > 3 ? 2 : 3;
  const visibleAvatars = orderedParticipants.slice(0, maxVisible);
  const extraCount = Math.max(0, orderedParticipants.length - maxVisible);

  const isPagante = userStatus?.status === 'pagante';
  const hasTeDevem = isPagante && (userStatus?.amountOwedToYou || 0) > 0.01;
  const isPendente = userStatus?.status === 'pendente' && (userStatus?.amountYouOwe || 0) > 0.01;

  const firstPayerName = paidByName ? paidByName.trim().split(/\s+/)[0] : '';
  const payerLabel = isPagante
    ? 'Pago por você'
    : firstPayerName
    ? `Pago por ${firstPayerName}`
    : 'Pago por você';

  return (
    <div
      onClick={onClick}
      className="ds-card !px-3 !py-2.5 sm:!px-3.5 sm:!py-3 flex items-center justify-between gap-2.5 sm:gap-3 transition-all cursor-pointer hover:border-[var(--primary)]/40 active:scale-[0.99]"
    >
      {/* Esquerda: Ícone da categoria + Nome da tag embaixo */}
      <div className="flex flex-col items-center justify-center gap-1 shrink-0 min-w-[46px] max-w-[72px] sm:max-w-[84px]">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--bg-subtle)] text-[var(--primary)] flex items-center justify-center shrink-0 border border-[var(--border-color)]">
          <CategoryIcon size={18} strokeWidth={2} />
        </div>
        <span
          className={`${tagFontSizeClass} font-semibold text-[var(--text-secondary)] leading-none whitespace-nowrap truncate max-w-full text-center`}
          title={cleanTag}
        >
          {cleanTag}
        </span>
      </div>

      {/* Meio: Título da despesa + Quem pagou e valor total + Pilha de avatares */}
      <div className="min-w-0 flex-1">
        <h4 className="font-display font-semibold text-[15px] sm:text-base text-[var(--text-primary)] tracking-tight truncate leading-snug">
          {displayTitle}
        </h4>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate tabular-nums">
          <span>{payerLabel}</span>
          <span className="mx-1">•</span>
          <span className="font-semibold text-[var(--text-primary)]">R$ {valorTotal}</span>
        </p>

        {/* Pilha de Avatares */}
        <div className="flex items-center gap-2 mt-1.5 min-w-0">
          <div className="flex -space-x-1.5 shrink-0">
            {visibleAvatars.map((p) => (
              <div
                key={p.id}
                style={p.avatar_url ? undefined : { backgroundColor: getAvatarColor(p.cor) }}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden flex items-center justify-center border-2 border-[var(--bg-surface)] text-[10px] font-semibold text-white shrink-0 shadow-sm"
                title={p.nome}
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.nome} className="w-full h-full object-cover" />
                ) : (
                  p.nome?.[0]?.toUpperCase() || '?'
                )}
              </div>
            ))}
            {extraCount > 0 && (
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-semibold text-[10px] flex items-center justify-center border-2 border-[var(--bg-surface)] shrink-0">
                +{extraCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Direita: Valor monetário + Status Semântico */}
      <div className="text-right flex flex-col items-end justify-center shrink-0">
        {hasTeDevem ? (
          <>
            <span className="font-display font-bold text-sm sm:text-base text-[#10B981] tabular-nums whitespace-nowrap">
              + R$ {moneyConverter(userStatus?.amountOwedToYou || 0)}
            </span>
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--emerald-bg)] text-[#10B981] border border-[var(--emerald-border)] whitespace-nowrap">
              <CheckCircle2 size={11} strokeWidth={2} /> A receber
            </span>
          </>
        ) : isPendente ? (
          <>
            <span className="font-display font-bold text-sm sm:text-base text-[#F43F5E] tabular-nums whitespace-nowrap">
              - R$ {moneyConverter(userStatus?.amountYouOwe || 0)}
            </span>
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--rose-bg)] text-[#F43F5E] border border-[var(--rose-border)] whitespace-nowrap">
              <Clock size={11} strokeWidth={2} /> Você deve
            </span>
          </>
        ) : (
          <>
            <span className="font-display font-bold text-sm sm:text-base text-[#10B981] tabular-nums whitespace-nowrap">
              R$ {moneyConverter(userStatus?.myShare || 0)}
            </span>
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--emerald-bg)] text-[#10B981] border border-[var(--emerald-border)] whitespace-nowrap">
              <Check size={11} strokeWidth={2} /> Pago
            </span>
          </>
        )}
      </div>
    </div>
  );
}
