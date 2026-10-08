// src/components/FriendCard.tsx
import { Star } from 'lucide-react';

interface FriendCardProps {
  amigo: any;
  onClick: () => void;
  onToggleFavorito: (e: React.MouseEvent) => void;
}

export function FriendCard({ amigo, onClick, onToggleFavorito }: FriendCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-[#1c1c1e] rounded-2xl p-3 flex items-center justify-between border border-white/5 hover:bg-[#2c2c2e] transition-colors cursor-pointer active:scale-[0.98]"
    >
      {/* Lado Esquerdo: Avatar e Nome */}
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full ${amigo.cor} flex items-center justify-center font-bold text-white text-lg`}>
          {amigo.nome[0]}
        </div>
        <span className="font-semibold text-white text-base">{amigo.nome}</span>
      </div>

      {/* Lado Direito: Dívida e Estrela */}
      <div className="flex items-center gap-4">
        {amigo.divida !== "0,00" && (
          <span className="font-bold text-[#FF453A]">
            R$ {amigo.divida}
          </span>
        )}
        
        {/* Botão de Favoritar */}
        <button 
          onClick={onToggleFavorito}
          className="text-gray-500 hover:text-yellow-500 transition-colors p-2 -m-2 rounded-full"
        >
          <Star 
            size={22} 
            className={amigo.favorito ? "text-yellow-500 fill-yellow-500" : ""} 
          />
        </button>
      </div>
    </div>
  );
}