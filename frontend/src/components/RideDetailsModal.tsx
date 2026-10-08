// src/components/RideDetailsModal.tsx
import { ChevronLeft, Receipt, Calendar, Users,Trash2 } from 'lucide-react';
import type { Corrida } from '../types/index.ts';


interface RideDetailsProps {
  ride?: Corrida; // Recebe os dados da corrida clicada
  participantes: any[]; // Lista completa dos participantes (com nome e cor) para mostrar no modal
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void; // Função para deletar a corrida
}

export function RideDetailsModal({ ride, participantes, isOpen, onClose , onDelete}: RideDetailsProps) {
  if (!isOpen || !ride) return null;
  // Lógica para dividir o valor
  // 1. Transforma a string "24,50" em número 24.50
  const valorNumerico = parseFloat(ride.valorTotal.toString().replace(',', '.'));
  // 2. Divide pela quantidade de pessoas
  const listaCompleta = [
    
    ...participantes,{ id: 'voce-logado', nome: 'Você', cor: 'bg-[#2DD4BF]' }
  ];
  const valorDividido = valorNumerico / listaCompleta.length; // Falta você, então adiciona 1 para não dividir por zero quando só tiver você na corrida
  // 3. Formata de volta para o padrão brasileiro "12,25"
  const valorFormatado = valorDividido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });



  return (
    // Fundo por cima de tudo (Tela cheia)
    <div className="fixed inset-0 bg-[#05080f] z-50 flex flex-col animate-slide-up overflow-y-auto">
      
      {/* Cabeçalho */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <button onClick={onClose} className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors">
          <ChevronLeft size={28} />
        </button>
        
        <h2 className="text-lg font-semibold text-white">Detalhes do Racha</h2>
        
        <button 
          onClick={() => {onDelete(ride.id); onClose();}}
          className="p-2 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
        >
          <Trash2 size={24} />
        </button>
      </div>

      <div className="p-6 space-y-6 flex-1">
        
        {/* Card de Resumo (Valor e Título) */}
        <div className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] p-6 rounded-3xl text-center shadow-lg border border-white/5">
          <p className="text-gray-400 text-sm mb-1">{ride.tag}</p>
          <h3 className="text-2xl font-bold text-white mb-4">{ride.titulo}</h3>
          
          <p className="text-gray-500 text-sm">Valor Total</p>
          <div className="text-4xl font-black text-[#2DD4BF] mt-1">
            R$ {ride.valorTotal}
          </div>
        </div>

        {/* Informações Extras */}
        <div className="bg-[#1c1c1e] rounded-2xl p-4 space-y-4 border border-white/5">
          <div className="flex items-center text-gray-300">
            <Calendar size={18} className="text-gray-500 mr-3" />
            <span className="text-sm">Data: <strong className="text-white ml-1">{ride.data}</strong></span>
          </div>
          <div className="flex items-center text-gray-300">
            <Receipt size={18} className="text-gray-500 mr-3" />
            <span className="text-sm">Categoria: <strong className="text-white ml-1">{ride.tag}</strong></span>
          </div>
        </div>

        {/* Divisão da Conta */}
        <div>
          <div className="flex items-center mb-4 text-gray-300">
            <Users size={18} className="text-gray-500 mr-2" />
            <h3 className="font-semibold text-lg">Divisão ({ride.participantesIds.length} pessoas)</h3>
          </div>
          
          <div className="space-y-3">
            {listaCompleta.map((p: any) => (
              <div key={p.id} className="flex justify-between items-center bg-[#1c1c1e] p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${p.cor} flex items-center justify-center font-bold text-white`}>
                    {p.nome[0]}
                  </div>
                  <span className="font-medium text-white">{p.nome}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-0.5">Parte dele(a)</p>
                  <p className="font-bold text-white">R$ {valorFormatado}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
            
      </div>
    </div>
  );
}