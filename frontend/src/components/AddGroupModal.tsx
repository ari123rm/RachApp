// src/components/AddGroupModal.tsx
import { useState } from 'react';
import { X, Users, LoaderCircle } from 'lucide-react';
import { dbService } from '../services/api';

interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddGroupModal({ isOpen, onClose, onSuccess }: AddGroupModalProps) {
  const [nome, setNome] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSalvar = async () => {
    if (!nome.trim()) return alert("O nome do grupo é obrigatório!");
    setIsLoading(true);
    try {
      await dbService.grupos.create(nome);
      setNome('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      alert("Erro ao criar grupo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center transition-opacity">
      <div className="bg-[#1c1c1e] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up relative">
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-white">
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold text-white mb-6">Criar Novo Grupo</h2>

        <div className="flex flex-col items-center justify-center mb-8 gap-3">
          <div className="w-20 h-20 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shadow-xl border-4 border-white/5">
            <Users size={32} />
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-gray-400 text-sm mb-2">Nome do Grupo</label>
          <div className="bg-[#2c2c2e] rounded-xl p-4 flex items-center text-white focus-within:ring-2 focus-within:ring-[#2DD4BF]">
            <input 
              type="text" 
              placeholder="Ex: Viagem, Casa, Churrasco..." 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              maxLength={30}
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-600" 
            />
          </div>
        </div>

        <button 
          onClick={handleSalvar} 
          disabled={isLoading} 
          className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] disabled:opacity-50 text-[#05080f] font-bold py-4 rounded-xl text-lg transition-all active:scale-95"
        >
          {isLoading ? <LoaderCircle className="animate-spin" /> : 'Criar Grupo'}
        </button>
      </div>
    </div>
  );
}