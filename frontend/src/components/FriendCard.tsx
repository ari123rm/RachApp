// src/components/FriendCard.tsx
import { Star, QrCode, Phone, BadgeCheck } from 'lucide-react';
import { formatPhoneBR } from '../utils/phoneFormatter';
import moneyConverter from '../utils/moneyConverter';
import { getAvatarColor } from '../utils/avatarColor';

interface FriendCardProps {
  amigo: any;
  onClick: () => void;
  onToggleFavorito: (e: React.MouseEvent) => void;
}

export function FriendCard({ amigo, onClick, onToggleFavorito }: FriendCardProps) {
  const nome = amigo.nome || amigo.name || 'Amigo';
  const cor = amigo.cor || amigo.color || 'bg-teal-600';
  const favorito = amigo.favorito ?? amigo.is_favorite ?? false;
  const pixKey = amigo.pix_key || amigo.pix || '';
  const telefone = amigo.telefone || amigo.phone || '';
  const isRegistered = Boolean(amigo.has_account || amigo.is_registered);

  const dividaNum = Number(amigo.dividaNumerica ?? 0);
  const voceDeveNum = Number(amigo.voceDeveNumerico ?? 0);
  const saldoLiquido = Number((dividaNum - voceDeveNum).toFixed(2));

  return (
    <div
      onClick={onClick}
      className="ds-card p-4 flex items-center justify-between hover:border-[#0F766E]/40 transition-all cursor-pointer active:scale-[0.99] gap-3"
    >
      {/* Lado Esquerdo: Avatar Circular 48x48px e Nome */}
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-1">
        <div
          style={amigo.avatar_url ? undefined : { backgroundColor: getAvatarColor(cor) }}
          className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-display font-bold text-white text-base shrink-0 shadow-sm"
        >
          {amigo.avatar_url ? (
            <img
              src={amigo.avatar_url}
              alt={nome}
              className="w-full h-full object-cover"
            />
          ) : (
            nome[0]?.toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-display font-semibold text-[var(--text-primary)] text-base sm:text-[18px] truncate">
              {nome}
            </span>
            {isRegistered && (
              <BadgeCheck
                size={16}
                strokeWidth={2}
                className="text-[#0F766E] fill-[#CCFBF1] shrink-0"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 min-w-0">
            {telefone && (
              <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1 shrink-0">
                <Phone size={12} strokeWidth={2} className="text-[var(--text-secondary)] shrink-0" />{' '}
                {formatPhoneBR(telefone)}
              </span>
            )}
            {pixKey && (
              <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1 truncate max-w-full">
                <QrCode size={12} strokeWidth={2} className="text-[#0F766E] shrink-0" />{' '}
                <span className="truncate">Pix: {pixKey}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lado Direito: Valor Monetário (Emerald para receber, Rose para pagar) e Estrela */}
      <div className="flex items-center gap-3 shrink-0">
        {saldoLiquido > 0.01 && (
          <div className="text-right">
            <span className="font-display font-bold text-[#10B981] text-sm sm:text-base block tabular-nums">
              + R$ {moneyConverter(saldoLiquido)}
            </span>
            <span className="text-xs font-medium text-[#10B981] block">te deve</span>
          </div>
        )}
        {saldoLiquido < -0.01 && (
          <div className="text-right">
            <span className="font-display font-bold text-[#F43F5E] text-sm sm:text-base block tabular-nums">
              - R$ {moneyConverter(Math.abs(saldoLiquido))}
            </span>
            <span className="text-xs font-medium text-[#F43F5E] block">você deve</span>
          </div>
        )}

        <button
          onClick={onToggleFavorito}
          className="text-[var(--text-secondary)] hover:text-[#F59E0B] transition-colors p-2 -m-1 rounded-full shrink-0"
        >
          <Star
            size={18}
            strokeWidth={2}
            className={favorito ? 'text-[#F59E0B] fill-[#F59E0B]' : ''}
          />
        </button>
      </div>
    </div>
  );
}
