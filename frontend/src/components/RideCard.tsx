// src/components/RideCard.tsx

// Aqui definimos o que o Card precisa receber para ser montado
interface RideProps {
  data: string;
  tag: string;
  titulo: string;
  valorTotal: string;
  participantes: { id: number; nome: string; cor: string }[];
  isPaied?: boolean;
  onClick?: () => void;
}

export function RideCard({ data, tag, titulo, valorTotal, participantes, isPaied, onClick }: RideProps) {
  return (
    <div className="bg-[#1c1c1e] rounded-2xl p-4 flex justify-between items-center mb-3 shadow-sm border border-white/5 cursor-pointer" onClick={onClick}>
      
      {/* Lado Esquerdo: Informações e Avatares */}
      <div className="flex-1">
        <p className="text-gray-300 text-sm mb-2 font-medium">
          {data || ''} | {tag || 'Uber'} - {titulo || 'Racha'}
        </p>
        
        <div className="flex items-center gap-2">
          {/* Grupo de Avatares (Sobrepostos) */}
          <div className="flex -space-x-2">
            {(participantes || []).map((p, idx) => {
              const letra = (p?.nome || 'A').trim().charAt(0).toUpperCase() || 'A';
              const cor = p?.cor || 'bg-sky-500';
              return (
                <div 
                  key={p?.id || idx} 
                  className={`w-7 h-7 rounded-full ${cor} flex items-center justify-center border-2 border-[#1c1c1e] text-[10px] font-bold text-white`}
                >
                  {letra}
                </div>
              );
            })}
          </div>
          <span className="text-gray-500 text-xs ml-1">
            Com: {(participantes || [])
              .filter(p => p && p.nome !== 'Você')
              .map(p => p?.nome || 'Amigo')
              .join(', ') || 'Amigos'}
          </span>
        </div>
      </div>

      {/* Lado Direito: Valor e Status */}
      <div className="ml-4 text-right">
        <div className="bg-[#2DD4BF]/20 text-[#2DD4BF] px-3 py-1.5 rounded-lg font-semibold text-sm">
          R$ {valorTotal || '0,00'}
        </div>
        {isPaied !== undefined && (
          <span className={`text-[10px] font-bold block mt-1 ${isPaied ? 'text-[#34C759]' : 'text-yellow-400'}`}>
            {isPaied ? 'Quitado' : 'Pendente'}
          </span>
        )}
      </div>

    </div>
  );
}