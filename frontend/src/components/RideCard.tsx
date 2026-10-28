// src/components/RideCard.tsx
import { Check, Clock, Wallet } from 'lucide-react';
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
      <div className="text-right flex flex-col items-end shrink-0 max-w-[125px] sm:max-w-[155px]">
        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] bg-[#2DD4BF]/20 text-[#2DD4BF] border border-[#2DD4BF]/30 px-2 sm:px-2.5 py-0.5 rounded-full font-bold shrink-0">
          <Wallet size={11} /> Pagante
        </span>
        {userStatus.amountOwedToYou > 0.01 ? (
          <span className="text-[10px] sm:text-[11px] font-bold text-amber-400 mt-1 truncate max-w-full tabular-nums">
            Te devem R$ {moneyConverter(userStatus.amountOwedToYou)}
          </span>
        ) : (
          <span className="text-[10px] sm:text-[11px] font-semibold text-[#34C759] mt-1 flex items-center gap-0.5 shrink-0">
            <Check size={11} /> Quitado
          </span>
        )}
      </div>
    );
  }

  if (userStatus.status === 'pendente') {
    return (
      <div className="text-right flex flex-col items-end shrink-0 max-w-[125px] sm:max-w-[155px]">
        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 sm:px-2.5 py-0.5 rounded-full font-bold shrink-0">
          <Clock size={11} /> Pendente
        </span>
        <span className="text-[10px] sm:text-[11px] font-bold text-red-400 mt-1 truncate max-w-full tabular-nums">
          Deve R$ {moneyConverter(userStatus.amountYouOwe)}
        </span>
      </div>
    );
  }

  return (
    <div className="text-right flex flex-col items-end shrink-0 max-w-[125px] sm:max-w-[155px]">
      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30 px-2 sm:px-2.5 py-0.5 rounded-full font-bold shrink-0">
        <Check size={11} /> Quitado
      </span>
      <span className="text-[10px] sm:text-[11px] text-gray-500 font-medium mt-1 truncate max-w-full tabular-nums">
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
  const visible = participantes.slice(0, 4);
  const extra = participantes.length - visible.length;

  return (
    <div
      className="bg-[#1c1c1e] rounded-2xl p-3 sm:p-4 flex justify-between items-center mb-2.5 sm:mb-3 shadow-sm border border-white/5 cursor-pointer hover:bg-[#2c2c2e] transition-colors active:scale-[0.99] gap-2"
      onClick={onClick}
    >
      {/* Lado Esquerdo: Informações e Avatares */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
          <p className="text-gray-200 text-xs sm:text-sm font-semibold truncate">
            {data} | {tag} - {titulo}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Grupo de Avatares (Sobrepostos) */}
          <div className="flex -space-x-2 shrink-0">
            {visible.map((p) => (
              <div
                key={p.id}
                style={p.avatar_url ? undefined : { backgroundColor: getAvatarColor(p.cor) }}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden flex items-center justify-center border-2 border-[#1c1c1e] text-[9px] sm:text-[10px] font-bold text-white shrink-0 shadow-sm"
              >
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt={p.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  p.nome?.[0]?.toUpperCase() || '?'
                )}
              </div>
            ))}
            {extra > 0 && (
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-700 text-gray-200 font-bold text-[9px] sm:text-[10px] flex items-center justify-center border-2 border-[#1c1c1e] shrink-0">
                +{extra}
              </div>
            )}
          </div>
          <span className="text-gray-400 text-[11px] sm:text-xs truncate flex-1 min-w-0">
            Com: {participantes.filter((p) => p.nome !== 'Você').map((p) => p.nome).join(', ') || 'Você'}
            {' • '}
            <span className="text-gray-300 font-medium tabular-nums">Total R$ {valorTotal}</span>
          </span>
        </div>
      </div>

      {/* Lado Direito: Status do Racha para a Pessoa */}
      <div className="shrink-0">
        <RideStatusView userStatus={userStatus} valorTotal={valorTotal} />
      </div>
    </div>
  );
}
