// src/components/AddFriendModal.tsx
import { useState } from 'react';
import { X, User, Phone } from 'lucide-react';
import { dbService } from '../services/database'; // 🟢 IMPORTANDO O SERVIÇO

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// 🟢 PALETA DE CORES PRÉ-DEFINIDAS (Nativas do Tailwind que ficam boas no Dark Mode)
const CORES_PALETA = [
  "bg-sky-500",    // Azul Claro
  "bg-pink-500",   // Rosa
  "bg-amber-500",  // Laranja/Amarelo
  "bg-green-500",  // Verde
  "bg-purple-500", // Roxo
  "bg-indigo-500", // Indigo
  "bg-teal-500",   // Ciano/Teal
];

export function AddFriendModal({ isOpen, onClose, onSuccess }: AddFriendModalProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [isLoading, setIsLoading] = useState(false); // 🟢 ESTADO DE CARREGANDO
  // 🟢 NOVO ESTADO: Guarda a cor selecionada (começa com a primeira da paleta)
  const [corSelecionada, setCorSelecionada] = useState(CORES_PALETA[0]);

  // Se não estiver aberto, não renderiza
  if (!isOpen) return null;

  // 🟢 LÓGICA PARA PEGAR A INICIAL (Ex: "João Silva" -> "J")
  const inicial = nome ? nome.charAt(0).toUpperCase() : "?";

  // 🟢 FUNÇÃO PARA SALVAR NO BANCO 🟢
  const handleSalvar = async () => {
    if (!nome.trim()) return alert("O nome é obrigatório!");

    setIsLoading(true);
    try {
      await dbService.amigos.create({
        nome: nome,
        telefone: telefone,
        cor: corSelecionada,
        favorito: false
      });
      
      // Limpa os campos
      setNome('');
      setTelefone('');
      setCorSelecionada(CORES_PALETA[0]);
      
      // Avisa quem chamou o modal que salvou e fecha
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      alert("Erro ao salvar o amigo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center transition-opacity">
      
      <div className="bg-[#1c1c1e] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up relative overflow-y-auto max-h-[90vh]">
        
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-white">
          <X size={24} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">Adicionar Amigo</h2>

        {/* 🟢 SEÇÃO DE PREVIEW DO AVATAR 🟢 */}
        <div className="flex flex-col items-center justify-center mb-8 gap-3">
          <p className="text-gray-500 text-sm">Visual do Amigo</p>
          <div className={`w-24 h-24 rounded-full ${corSelecionada} flex items-center justify-center shadow-xl border-4 border-white/5 transition-colors duration-300`}>
            <span className="text-5xl font-black text-white tracking-tighter">
              {inicial}
            </span>
          </div>
        </div>

        {/* Campo: Nome */}
        <div className="mb-5">
          <label className="block text-gray-400 text-sm mb-2">Nome do Amigo</label>
          <div className="bg-[#2c2c2e] rounded-xl p-4 flex items-center text-white focus-within:ring-2 focus-within:ring-[#2DD4BF]">
            <User size={20} className="text-gray-400 mr-3" />
            <input 
              type="text" 
              placeholder="Ex: João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={20} // Limita o tamanho do nome
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Campo: WhatsApp */}
        <div className="mb-6">
          <label className="block text-gray-400 text-sm mb-2">WhatsApp (com DDD)</label>
          <div className="bg-[#2c2c2e] rounded-xl p-4 flex items-center text-white focus-within:ring-2 focus-within:ring-[#2DD4BF]">
            <Phone size={20} className="text-gray-400 mr-3" />
            <input 
              type="tel" 
              placeholder="11999998888"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* 🟢 SEÇÃO DE ESCOLHA DE COR 🟢 */}
        <div className="mb-8">
          <label className="block text-gray-400 text-sm mb-3">Escolha uma Cor de Destaque</label>
          <div className="flex justify-between items-center gap-2 bg-[#2c2c2e] p-3 rounded-2xl border border-white/5">
            {CORES_PALETA.map((cor) => {
              const isActive = cor === corSelecionada;
              return (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setCorSelecionada(cor)}
                  className={`w-10 h-10 rounded-full ${cor} transition-all duration-200 relative ${
                    isActive 
                      ? 'scale-110 ring-4 ring-white/30 shadow-lg' 
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Ícone de Check se estiver selecionada */}
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Botão Salvar */}
        <button 
          onClick={handleSalvar}
          disabled={isLoading}
          className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] disabled:opacity-50 text-[#05080f] font-bold py-4 rounded-xl text-lg transition-all active:scale-95"
        >
          {isLoading ? 'Salvando...' : 'Salvar Amigo'}
        </button>

      </div>
    </div>
  );
}