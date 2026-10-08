// src/components/RideCard.tsx

// Aqui definimos o que o Card precisa receber para ser montado
interface RideProps {
  data: string;
  tag: string;
  titulo: string;
  valorTotal: string;
  participantes: { id: number; nome: string; cor: string }[];
  onClick?: () => void; // 🟢 NOVO: Função de clique opcional
}

export function RideCard({ data, tag, titulo, valorTotal, participantes, onClick}: RideProps) {
  return (
    <div className="bg-[#1c1c1e] rounded-2xl p-4 flex justify-between items-center mb-3 shadow-sm border border-white/5" onClick={onClick}>
      
      {/* Lado Esquerdo: Informações e Avatares */}
      <div className="flex-1">
        <p className="text-gray-300 text-sm mb-2 font-medium">
          {data} | {tag} - {titulo}
        </p>
        
        <div className="flex items-center gap-2">
          {/* Grupo de Avatares (Sobrepostos) */}
          <div className="flex -space-x-2">
            {participantes.map((p) => (
              <div 
                key={p.id} 
                className={`w-7 h-7 rounded-full ${p.cor} flex items-center justify-center border-2 border-[#1c1c1e] text-[10px] font-bold text-white`}
              >
                {p.nome[0]}
              </div>
            ))}
          </div>
          <span className="text-gray-500 text-xs ml-1">
            Com: {participantes.filter(p => p.nome !== 'Você').map(p => p.nome).join(', ')}
          </span>
        </div>
      </div>

      {/* Lado Direito: Valor */}
      <div className="ml-4">
        <div className="bg-[#2DD4BF]/20 text-[#2DD4BF] px-3 py-1.5 rounded-lg font-semibold text-sm">
          R$ {valorTotal}
        </div>
      </div>

    </div>
  );
}