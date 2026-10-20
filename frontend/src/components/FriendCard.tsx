// src/components/FriendCard.tsx
import { Star, QrCode, Phone, CheckCircle2 } from 'lucide-react';
import { formatPhoneBR } from '../utils/phoneFormatter';
import moneyConverter from '../utils/moneyConverter';

interface FriendCardProps {
  amigo: any;
  onClick: () => void;
  onToggleFavorito: (e: React.MouseEvent) => void;
}

export function FriendCard({ amigo, onClick, onToggleFavorito }: FriendCardProps) {
  const nome = amigo.nome || amigo.name || 'Amigo';
  const cor = amigo.cor || amigo.color || 'bg-sky-500';
  const favorito = amigo.favorito ?? amigo.is_favorite ?? false;
  const pixKey = amigo.pix_key || amigo.pix || '';
  const telefone = amigo.telefone || amigo.phone || '';
  const isVerified = Boolean(amigo.is_verified || amigo.has_account);

  const dividaNum = Number(amigo.dividaNumerica ?? 0);
  const voceDeveNum = Number(amigo.voceDeveNumerico ?? 0);
  const saldoLiquido = Number((dividaNum - voceDeveNum).toFixed(2));

  return (
    <div
      onClick={onClick}
      className="bg-[#1c1c1e] rounded-2xl p-3.5 flex items-center justify-between border border-white/5 hover:bg-[#2c2c2e] transition-colors cursor-pointer active:scale-[0.99]"
    >
      {/* Lado Esquerdo: Avatar e Nome */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`w-12 h-12 rounded-full ${cor} flex items-center justify-center font-bold text-white text-lg shrink-0`}
        >
          {nome[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-white text-base truncate">{nome}</span>
            {isVerified && (
              <span title="Usuário cadastrado no Rachapp" className="inline-flex items-center text-teal-400 shrink-0">
                <CheckCircle2 size={16} className="fill-[#2DD4BF] text-[#05080f]" />
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            {telefone && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Phone size={10} className="text-gray-500" /> {formatPhoneBR(telefone)}
              </span>
            )}
            {pixKey && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1 truncate max-w-[160px]">
                <QrCode size={11} className="text-[#2DD4BF] shrink-0" /> Pix: {pixKey}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lado Direito: Dívida (Amarela para devedor / Vermelha se você deve) e Estrela */}
      <div className="flex items-center gap-3 shrink-0">
        {saldoLiquido > 0.01 && (
          <div className="text-right">
            <span className="font-bold text-yellow-400 text-sm block">
              R$ {moneyConverter(saldoLiquido)}
            </span>
            <span className="text-[10px] text-gray-500">te deve</span>
          </div>
        )}
        {saldoLiquido < -0.01 && (
          <div className="text-right">
            <span className="font-bold text-red-400 text-sm block">
              R$ {moneyConverter(Math.abs(saldoLiquido))}
            </span>
            <span className="text-[10px] text-gray-500">você deve</span>
          </div>
        )}

        <button
          onClick={onToggleFavorito}
          className="text-gray-500 hover:text-yellow-500 transition-colors p-2 -m-1 rounded-full"
        >
          <Star size={20} className={favorito ? 'text-yellow-500 fill-yellow-500' : ''} />
        </button>
      </div>
    </div>
  );
}
