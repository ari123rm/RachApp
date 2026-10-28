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
      <div className="bg-[#2DD4BF]/20 text-[#2DD4BF] px-3 py-1.5 rounded-lg font-semibold text-sm">
        R$ {valorTotal}
      </div>
    );
  }

  if (userStatus.status === 'pagante') {
    return (
      <div className="text-right flex flex-col items-end">
        <span className="inline-flex items-center gap-1 text-[11px] bg-[#2DD4BF]/20 text-[#2DD4BF] border border-[#2DD4BF]/30 px-2.5 py-0.5 rounded-full font-bold">
          <Wallet size={11} /> Pagante
        </span>
        {userStatus.amountOwedToYou > 0.01 ? (
          <span className="text-[11px] font-bold text-amber-400 mt-1">
            Te devem R$ {moneyConverter(userStatus.amountOwedToYou)}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-[#34C759] mt-1 flex items-center gap-0.5">
            <Check size={11} /> Quitado
          </span>
        )}
      </div>
    );
  }

  if (userStatus.status === 'pendente') {
    return (
      <div className="text-right flex flex-col items-end">
        <span className="inline-flex items-center gap-1 text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
          <Clock size={11} /> Pendente
        </span>
        <span className="text-[11px] font-bold text-red-400 mt-1">
          Deve R$ {moneyConverter(userStatus.amountYouOwe)}
        </span>
      </div>
    );
  }

  return (
    <div className="text-right flex flex-col items-end">
      <span className="inline-flex items-center gap-1 text-[11px] bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30 px-2.5 py-0.5 rounded-full font-bold">
        <Check size={11} /> Quitado
      </span>
      <span className="text-[11px] text-gray-500 font-medium mt-1">
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
      className="bg-[#1c1c1e] rounded-2xl p-4 flex justify-between items-center mb-3 shadow-sm border border-white/5 cursor-pointer hover:bg-[#2c2c2e] transition-colors active:scale-[0.99]"
      onClick={onClick}
    >
      {/* Lado Esquerdo: Informações e Avatares */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-gray-300 text-sm font-medium truncate">
            {data} | {tag} - {titulo}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Grupo de Avatares (Sobrepostos) */}
          <div className="flex -space-x-2 shrink-0">
            {visible.map((p) => (
              <div
                key={p.id}
                style={p.avatar_url ? undefined : { backgroundColor: getAvatarColor(p.cor) }}
                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center border-2 border-[#1c1c1e] text-[10px] font-bold text-white shrink-0 shadow-sm"
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
              <div className="w-7 h-7 rounded-full bg-gray-700 text-gray-200 font-bold text-[10px] flex items-center justify-center border-2 border-[#1c1c1e] shrink-0">
                +{extra}
              </div>
            )}
          </div>
          <span className="text-gray-500 text-xs ml-1 truncate">
            Com: {participantes.filter((p) => p.nome !== 'Você').map((p) => p.nome).join(', ') || 'Você'}
            {' • '}
            <span className="text-gray-400 font-medium">Total R$ {valorTotal}</span>
          </span>
        </div>
      </div>

      {/* Lado Direito: Status do Racha para a Pessoa */}
      <div className="ml-2 shrink-0">
        <RideStatusView userStatus={userStatus} valorTotal={valorTotal} />
      </div>
    </div>
  );
}
