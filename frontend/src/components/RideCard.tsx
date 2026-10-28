// src/components/RideCard.tsx
import { FileCheck2 } from 'lucide-react';
import { getAvatarColor } from '../utils/avatarColor';

interface RideProps {
  data: string;
  tag: string;
  titulo: string;
  valorTotal: string;
  participantes: { id: number | string; nome: string; cor: string; avatar_url?: string | null }[];
  hasReceipt?: boolean;
  onClick?: () => void;
}

export function RideCard({
  data,
  tag,
  titulo,
  valorTotal,
  participantes,
  hasReceipt,
  onClick,
}: RideProps) {
  const visible = participantes.slice(0, 4);
  const extra = participantes.length - visible.length;

  return (
    <div
      className={`bg-[#1c1c1e] rounded-2xl p-4 flex justify-between items-center mb-3 shadow-sm border cursor-pointer hover:bg-[#2c2c2e] transition-colors active:scale-[0.99] ${
        hasReceipt ? 'border-sky-500/30' : 'border-white/5'
      }`}
      onClick={onClick}
    >
      {/* Lado Esquerdo: Informações e Avatares */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-gray-300 text-sm font-medium truncate">
            {data} | {tag} - {titulo}
          </p>
          {hasReceipt && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md font-semibold shrink-0">
              <FileCheck2 size={11} /> Comprovante
            </span>
          )}
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
          </span>
        </div>
      </div>

      {/* Lado Direito: Valor */}
      <div className="ml-2 shrink-0">
        <div className="bg-[#2DD4BF]/20 text-[#2DD4BF] px-3 py-1.5 rounded-lg font-semibold text-sm">
          R$ {valorTotal}
        </div>
      </div>
    </div>
  );
}
