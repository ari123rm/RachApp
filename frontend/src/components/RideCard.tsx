// src/components/RideCard.tsx
import { getAvatarColor } from '../utils/avatarColor';

interface RideProps {
  data: string;
  tag: string;
  titulo: string;
  valorTotal: string;
  participantes: { id: number | string; nome: string; cor: string }[];
  onClick?: () => void;
}

export function RideCard({ data, tag, titulo, valorTotal, participantes, onClick }: RideProps) {
  const visible = participantes.slice(0, 4);
  const extra = participantes.length - visible.length;

  return (
    <div
      className="bg-[#1c1c1e] rounded-2xl p-4 flex justify-between items-center mb-3 shadow-sm border border-white/5 cursor-pointer hover:bg-[#2c2c2e] transition-colors active:scale-[0.99]"
      onClick={onClick}
    >
      {/* Lado Esquerdo: Informações e Avatares */}
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-gray-300 text-sm mb-2 font-medium truncate">
          {data} | {tag} - {titulo}
        </p>

        <div className="flex items-center gap-2">
          {/* Grupo de Avatares (Sobrepostos) */}
          <div className="flex -space-x-2 shrink-0">
            {visible.map((p) => (
              <div
                key={p.id}
                style={{ backgroundColor: getAvatarColor(p.cor) }}
                className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#1c1c1e] text-[10px] font-bold text-white shrink-0 shadow-sm"
              >
                {p.nome?.[0]?.toUpperCase() || '?'}
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
