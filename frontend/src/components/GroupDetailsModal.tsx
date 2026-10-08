// src/components/GroupDetailsModal.tsx
import { useState, useEffect } from 'react';
import { ChevronLeft, UserPlus, LoaderCircle, Users, Receipt } from 'lucide-react';
import { dbService } from '../services/api';
import moneyConverter from '../utils/moneyConverter';

interface GroupDetailsProps {
  grupoId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GroupDetailsModal({ grupoId, isOpen, onClose }: GroupDetailsProps) {
  const [grupo, setGrupo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [novoMembro, setNovoMembro] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const carregarDetalhes = async () => {
    if (!grupoId) return;
    setIsLoading(true);
    try {
      const dados = await dbService.grupos.getById(grupoId);
      setGrupo(dados);
    } catch (error) {
      console.error("Erro ao carregar detalhes do grupo:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) carregarDetalhes();
  }, [isOpen, grupoId]);

  const handleAddMembro = async () => {
    if (!novoMembro.trim()) return alert("Digite o e-mail ou WhatsApp do seu amigo.");
    setIsAdding(true);
    try {
      await dbService.grupos.addMember(grupoId!, novoMembro);
      setNovoMembro('');
      alert("Membro adicionado com sucesso!");
      await carregarDetalhes(); // Recarrega a lista para mostrar o novo amigo
    } catch (error: any) {
      alert(error.response?.data?.error || "Erro ao adicionar membro.");
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#05080f] z-50 flex flex-col animate-slide-up overflow-y-auto pb-6">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <button onClick={onClose} className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors">
          <ChevronLeft size={28} />
        </button>
        <h2 className="text-lg font-semibold text-white">Detalhes do Grupo</h2>
        <div className="w-10"></div> {/* Espaçador para centralizar o título */}
      </div>

      {isLoading || !grupo ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <LoaderCircle size={40} className="animate-spin text-[#2DD4BF]" />
        </div>
      ) : (
        <div className="px-6 flex-1 mt-6">
          {/* Cabeçalho do Grupo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shadow-lg mb-4">
              <Users size={36} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">{grupo.name}</h3>
            <p className="text-gray-500 text-sm">{grupo.members?.length || 0} participantes</p>
          </div>

          {/* Adicionar Novo Membro */}
          <div className="bg-[#1c1c1e] rounded-3xl p-5 border border-white/5 mb-8">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <UserPlus size={18} className="text-[#2DD4BF]" />
              Adicionar Amigo
            </h4>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="E-mail ou WhatsApp" 
                value={novoMembro}
                onChange={(e) => setNovoMembro(e.target.value)}
                className="bg-[#2c2c2e] rounded-xl px-4 py-3 flex-1 text-white outline-none focus:ring-1 focus:ring-[#2DD4BF]"
              />
              <button 
                onClick={handleAddMembro}
                disabled={isAdding}
                className="bg-[#2DD4BF] text-[#05080f] px-5 font-bold rounded-xl disabled:opacity-50"
              >
                {isAdding ? <LoaderCircle className="animate-spin" size={20} /> : 'Add'}
              </button>
            </div>
          </div>

          {/* Lista de Membros */}
          <div className="mb-8">
            <h4 className="text-white font-bold text-lg mb-4">Participantes</h4>
            <div className="space-y-2">
              {grupo.members.map((m: any) => (
                <div key={m.user.id} className="flex items-center gap-3 bg-[#1c1c1e] p-3 rounded-xl border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-white">
                    {m.user.name[0].toUpperCase()}
                  </div>
                  <span className="font-medium text-white">{m.user.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico de Rachas */}
          <div>
            <h4 className="text-white font-bold text-lg mb-4">Histórico de Rachas</h4>
            {grupo.expenses.length === 0 ? (
              <p className="text-gray-500 text-sm text-center italic py-4">Nenhuma despesa registada neste grupo.</p>
            ) : (
              <div className="space-y-3">
                {grupo.expenses.map((expense: any) => (
                  <div key={expense.id} className="bg-[#1c1c1e] p-4 rounded-xl border border-white/5 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">{new Date(expense.expense_date).toLocaleDateString()}</p>
                      <h5 className="text-white font-medium flex items-center gap-2">
                        <Receipt size={16} className="text-gray-500" /> {expense.title}
                      </h5>
                      <p className="text-[10px] text-gray-500 mt-1">Pago por: {expense.owner?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#2DD4BF]">R$ {moneyConverter(Number(expense.total_amount))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}