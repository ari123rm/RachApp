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
  return `${parseInt(day, 10)} de ${mName}, ${year}`;
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
      <div className="bg-[#CCFBF1] text-[#0F766E] px-3 py-1 rounded-xl font-bold font-display text-xs tabular-nums">
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
  data,
  tag,
  titulo,
  valorTotal,
  participantes,
  userStatus,
  paidByName,
  onClick,
}: RideProps) {
  const cleanTag = (tag || '').trim();
  const cleanTitle = (titulo || '').trim();

  let displayTitle = cleanTitle;
  if (cleanTag && !cleanTitle.toLowerCase().startsWith(cleanTag.toLowerCase())) {
    displayTitle = `${cleanTag} - ${cleanTitle}`;
  }

  const formattedDate = formatRideDate(data);
  const CategoryIcon = getCategoryIcon(cleanTag || displayTitle);

  // Ordena para que os amigos apareçam primeiro nos avatares e 'Você' fique por último
  const amigos = participantes.filter((p) => p.nome !== 'Você');
  const voce = participantes.find((p) => p.nome === 'Você');
  const orderedParticipants = voce ? [...amigos, voce] : amigos;

  // Mostra até 3 avatares e contador (+N) se houver mais de 3 (Pilha de Avatares 32x32px)
  const visibleAvatars = orderedParticipants.slice(0, 3);
  const extraCount = orderedParticipants.length - 3;

  const isPagante = userStatus?.status === 'pagante';
  const hasTeDevem = isPagante && (userStatus?.amountOwedToYou || 0) > 0.01;
  const isPendente = userStatus?.status === 'pendente' && (userStatus?.amountYouOwe || 0) > 0.01;

  const payerLabel = isPagante
    ? 'Pago por você'
    : paidByName
    ? `Pago por ${paidByName}`
    : cleanTag || 'Despesa';

  return (
    <div
      onClick={onClick}
      className="ds-card p-4 flex items-center justify-between gap-4 transition-all cursor-pointer hover:border-[#0F766E]/40 active:scale-[0.99]"
    >
      {/* Esquerda: Ícone da categoria da despesa em círculo com fundo cinza claro */}
      <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] text-[#0F766E] flex items-center justify-center shrink-0 border border-[var(--border-color)]">
        <CategoryIcon size={22} strokeWidth={2} />
      </div>

      {/* Meio: Título da despesa (H2) + Quem pagou e a data (Body 2) + Pilha de avatares 32x32px */}
      <div className="min-w-0 flex-1">
        <h4 className="font-display font-semibold text-[17px] sm:text-[18px] text-[var(--text-primary)] tracking-tight truncate leading-snug">
          {displayTitle}
        </h4>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5 truncate">
          {payerLabel} • {formattedDate}
        </p>

        {/* Pilha de Avatares (Avatar Stack 32x32px com borda de 2px na cor da superfície) */}
        <div className="flex items-center gap-2 mt-2 min-w-0">
          <div className="flex -space-x-2 shrink-0">
            {visibleAvatars.map((p) => (
              <div
                key={p.id}
                style={p.avatar_url ? undefined : { backgroundColor: getAvatarColor(p.cor) }}
                className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border-2 border-[var(--bg-surface)] text-xs font-semibold text-white shrink-0 shadow-sm"
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
              <div className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-semibold text-xs flex items-center justify-center border-2 border-[var(--bg-surface)] shrink-0">
                +{extraCount}
              </div>
            )}
          </div>
          <span className="text-xs font-medium text-[var(--text-secondary)] truncate">
            Total R$ {valorTotal}
          </span>
        </div>
      </div>

      {/* Direita: Valor monetário (Plus Jakarta Sans, Bold) + Status Semântico */}
      <div className="text-right flex flex-col items-end justify-center shrink-0">
        {hasTeDevem ? (
          <>
            <span className="font-display font-bold text-base sm:text-lg text-[#10B981] tabular-nums">
              + R$ {moneyConverter(userStatus?.amountOwedToYou || 0)}
            </span>
            <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--emerald-bg)] text-[#10B981] border border-[var(--emerald-border)]">
              <CheckCircle2 size={12} strokeWidth={2} /> A receber
            </span>
          </>
        ) : isPendente ? (
          <>
            <span className="font-display font-bold text-base sm:text-lg text-[#F43F5E] tabular-nums">
              - R$ {moneyConverter(userStatus?.amountYouOwe || 0)}
            </span>
            <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--rose-bg)] text-[#F43F5E] border border-[var(--rose-border)]">
              <Clock size={12} strokeWidth={2} /> Você deve
            </span>
          </>
        ) : (
          <>
            <span className="font-display font-bold text-base sm:text-lg text-[#10B981] tabular-nums">
              R$ {moneyConverter(userStatus?.myShare || 0)}
            </span>
            <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--emerald-bg)] text-[#10B981] border border-[var(--emerald-border)]">
              <Check size={12} strokeWidth={2} /> Pago
            </span>
          </>
        )}
      </div>
    </div>
  );
}
