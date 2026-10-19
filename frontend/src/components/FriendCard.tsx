// src/components/FriendCard.tsx
import { Star, QrCode, Phone } from 'lucide-react';
import { formatPhoneBR } from '../utils/phoneFormatter';

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
  const dividaStr =
    typeof amigo.divida === 'number'
      ? amigo.divida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : amigo.divida || '0,00';

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
          <span className="font-semibold text-white text-base block truncate">{nome}</span>
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

      {/* Lado Direito: Dívida e Estrela */}
      <div className="flex items-center gap-3 shrink-0">
        {dividaStr !== '0,00' && (
          <div className="text-right">
            <span className="font-bold text-[#FF453A] text-sm block">R$ {dividaStr}</span>
            <span className="text-[10px] text-gray-500">pendente</span>
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