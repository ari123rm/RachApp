// src/components/RideCard.tsx
import { Check, CheckCircle2, Clock } from 'lucide-react';
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

export function RideStatusView({
  userStatus,
  valorTotal,
}: {
  userStatus?: RideUserStatus;
  valorTotal?: string;
}) {
  if (!userStatus) {
    return (
      <div className="bg-[#2DD4BF]/20 text-[#2DD4BF] px-2.5 py-1 rounded-lg font-bold text-xs tabular-nums">
        R$ {valorTotal}
      </div>
    );
  }

  if (userStatus.status === 'pagante') {
    return (
      <div className="text-right flex flex-col items-end shrink-0 max-w-[135px] sm:max-w-[165px]">
        <span className="inline-flex items-center gap-1.5 text-[11px] bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30 px-2.5 py-0.5 rounded-full font-bold shrink-0">
          <CheckCircle2 size={12} strokeWidth={2.5} /> Pagante
        </span>
        {userStatus.amountOwedToYou > 0.01 ? (
          <span className="text-[11px] font-bold text-[#2DD4BF] mt-1 truncate max-w-full tabular-nums">
            Te devem R$ {moneyConverter(userStatus.amountOwedToYou)}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-emerald-400 mt-1 flex items-center gap-1 shrink-0">
            <Check size={12} strokeWidth={2.5} /> Quitado
          </span>
        )}
      </div>
    );
  }

  if (userStatus.status === 'pendente') {
    return (
      <div className="text-right flex flex-col items-end shrink-0 max-w-[135px] sm:max-w-[165px]">
        <span className="inline-flex items-center gap-1.5 text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold shrink-0">
          <Clock size={12} strokeWidth={2.5} /> Pendente
        </span>
        <span className="text-[11px] font-bold text-amber-400 mt-1 truncate max-w-full tabular-nums">
          Deve R$ {moneyConverter(userStatus.amountYouOwe)}
        </span>
      </div>
    );
  }

  return (
    <div className="text-right flex flex-col items-end shrink-0 max-w-[135px] sm:max-w-[165px]">
      <span className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold shrink-0">
        <Check size={12} strokeWidth={2.5} /> Quitado
      </span>
      <span className="text-[11px] text-gray-500 font-medium mt-1 truncate max-w-full tabular-nums">
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
  onClick,
}: RideProps) {
  const cleanTag = (tag || '').trim();
  const cleanTitle = (titulo || '').trim();

  let displayTitle = cleanTitle;
  if (cleanTag && !cleanTitle.toLowerCase().startsWith(cleanTag.toLowerCase())) {
    displayTitle = `${cleanTag} - ${cleanTitle}`;
  }

  const formattedDate = formatRideDate(data);
  const displayCategory = cleanTag || 'Transporte';

  // Ordena para que os amigos apareçam primeiro nos avatares e 'Você' fique por último
  const amigos = participantes.filter((p) => p.nome !== 'Você');
  const voce = participantes.find((p) => p.nome === 'Você');
  const orderedParticipants = voce ? [...amigos, voce] : amigos;

  const nomesAmigos = amigos.map((p) => p.nome);
  const textoParticipantes = nomesAmigos.length > 0 ? nomesAmigos.join(', ') : 'Você';

  // Mostra até 3 avatares e contador (+N) se houver mais de 3
  const visibleAvatars = orderedParticipants.slice(0, 3);
  const extraCount = orderedParticipants.length - 3;

  const isPagante = userStatus?.status === 'pagante';
  const hasTeDevem = isPagante && (userStatus?.amountOwedToYou || 0) > 0.01;
  const isPendente = userStatus?.status === 'pendente' && (userStatus?.amountYouOwe || 0) > 0.01;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-4 sm:p-4.5 space-y-3.5 transition-all cursor-pointer active:scale-[0.99] ${
        hasTeDevem
          ? 'bg-[#131b26] border border-[#2DD4BF]/50 shadow-lg shadow-teal-500/5'
          : 'bg-[#131b26] border border-white/5 hover:border-white/10'
      }`}
    >
      {/* Linha 1: Título / Subtítulo e Badge de Status */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-bold text-white tracking-tight truncate leading-snug">
            {displayTitle}
          </h4>
          <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">
            {formattedDate} • {displayCategory}
          </p>
        </div>

        {/* Badge de Status no canto superior direito */}
        <div className="shrink-0">
          {hasTeDevem ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30">
              <CheckCircle2 size={13} strokeWidth={2.5} /> Pagante
            </span>
          ) : isPendente ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Clock size={13} strokeWidth={2.5} /> Pendente
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Check size={13} strokeWidth={2.5} /> Quitado
            </span>
          )}
        </div>
      </div>

      {/* Linha 2: Avatares sobrepostos + Lista de Participantes + Total */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex -space-x-1.5 shrink-0">
            {visibleAvatars.map((p) => (
              <div
                key={p.id}
                style={p.avatar_url ? undefined : { backgroundColor: getAvatarColor(p.cor) }}
                className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center border-2 border-[#131b26] text-[10px] font-bold text-white shrink-0 shadow-sm"
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.nome} className="w-full h-full object-cover" />
                ) : (
                  p.nome?.[0]?.toUpperCase() || '?'
                )}
              </div>
            ))}
            {extraCount > 0 && (
              <div className="w-6 h-6 rounded-full bg-slate-800 text-gray-300 font-bold text-[10px] flex items-center justify-center border-2 border-[#131b26] shrink-0">
                +{extraCount}
              </div>
            )}
          </div>

          <span className="text-xs text-gray-300 font-medium truncate">
            Com: {textoParticipantes}
          </span>
        </div>

        <div className="shrink-0 text-xs text-gray-400 font-normal">
          Total: <span className="font-bold text-white tabular-nums ml-1">R$ {valorTotal}</span>
        </div>
      </div>

      {/* Linha 3: Card interno inferior (Sua parte / Te devem no total / Você deve) */}
      {hasTeDevem ? (
        <div className="bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 rounded-xl px-3.5 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[#2DD4BF]">
            <span className="w-2 h-2 rounded-full bg-[#2DD4BF] animate-pulse shrink-0" />
            <span>Te devem no total</span>
          </div>
          <span className="text-sm sm:text-base font-extrabold text-[#2DD4BF] tabular-nums">
            R$ {moneyConverter(userStatus?.amountOwedToYou || 0)}
          </span>
        </div>
      ) : isPendente ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span>Você deve</span>
          </div>
          <span className="text-sm sm:text-base font-extrabold text-amber-400 tabular-nums">
            R$ {moneyConverter(userStatus?.amountYouOwe || 0)}
          </span>
        </div>
      ) : (
        <div className="bg-[#0c121e]/80 border border-white/[0.04] rounded-xl px-3.5 py-2.5 sm:py-3 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">Sua parte</span>
          <span className="text-sm sm:text-base font-bold text-[#2DD4BF] tabular-nums">
            R$ {moneyConverter(userStatus?.myShare || 0)}
          </span>
        </div>
      )}
    </div>
  );
}
