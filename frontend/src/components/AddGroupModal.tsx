// src/components/AddGroupModal.tsx
import { useState, useEffect } from 'react';
import { X, Users, LoaderCircle, Search, Check, ArrowRight, UserPlus } from 'lucide-react';
import { dbService } from '../services/database';
import { AddFriendModal } from './AddFriendModal';
import { formatPhoneBR } from '../utils/phoneFormatter';
import type { Amigo, Grupo } from '../types';

interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  groupToEdit?: Grupo | null;
}

export function AddGroupModal({ isOpen, onClose, onSuccess, groupToEdit }: AddGroupModalProps) {
  const [nome, setNome] = useState('');
  const [buscaAmigo, setBuscaAmigo] = useState('');
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);

  const isEditing = !!groupToEdit;

  const carregarAmigos = async () => {
    const lista = await dbService.amigos.getAll();
    setAmigos(lista);
  };

  useEffect(() => {
    if (isOpen) {
      carregarAmigos();
      if (groupToEdit) {
        setNome(groupToEdit.name || '');
        const fIds = (groupToEdit.members || [])
          .filter((m) => m.friend?.id)
          .map((m) => m.friend!.id);
        setSelecionados(fIds);
      } else {
        setNome('');
        setSelecionados([]);
      }
      setBuscaAmigo('');
    }
  }, [isOpen, groupToEdit]);

  if (!isOpen) return null;

  const toggleAmigo = (id: string) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((i) => i !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const handleSalvar = async () => {
    if (!nome.trim()) {
      alert('O nome do grupo é obrigatório!');
      return;
    }
    setIsLoading(true);
    try {
      if (isEditing && groupToEdit) {
        await dbService.grupos.update(groupToEdit.id, {
          name: nome.trim(),
          friendIds: selecionados,
        });
      } else {
        await dbService.grupos.create({
          name: nome.trim(),
          friendIds: selecionados,
        });
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      alert('Erro ao salvar grupo.');
    } finally {
      setIsLoading(false);
    }
  };

  const amigosFiltrados = amigos.filter((a) =>
    (a.nome || a.name || '').toLowerCase().includes(buscaAmigo.toLowerCase())
  );

  const totalPessoas = selecionados.length + 1;

  return (
    <div className="fixed inset-0 bg-black/75 z-[60] flex items-end sm:items-center justify-center transition-opacity">
      <div className="bg-[#05080f] sm:bg-[#1c1c1e] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up relative max-h-[92vh] overflow-y-auto border border-white/10">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">
          {isEditing ? 'Editar Grupo' : 'Criar Grupo'}
        </h2>

        {/* Nome do Grupo */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-400 text-xs uppercase font-bold">Nome do Grupo</label>
            <span className="text-xs text-gray-500">{nome.length}/30</span>
          </div>
          <div className="bg-[#1c1c1e] sm:bg-[#2c2c2e] rounded-2xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
            <Users size={18} className="text-[#2DD4BF] mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Ex: Apê República, Viagem..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={30}
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Participantes */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <label className="text-white font-bold text-base">Participantes</label>
              <span className="text-xs bg-[#2DD4BF]/20 text-[#2DD4BF] font-bold px-2.5 py-0.5 rounded-full">
                {totalPessoas} {totalPessoas === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsAddFriendOpen(true)}
              className="bg-[#2DD4BF]/15 hover:bg-[#2DD4BF]/25 text-[#2DD4BF] border border-[#2DD4BF]/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <UserPlus size={14} /> Novo Amigo
            </button>
          </div>

          {/* Busca de Amigo */}
          <div className="bg-[#1c1c1e] sm:bg-[#2c2c2e] rounded-xl p-3 flex items-center text-gray-400 border border-white/5 mb-3">
            <Search size={16} className="mr-2.5" />
            <input
              type="text"
              placeholder="Buscar amigo cadastrado..."
              value={buscaAmigo}
              onChange={(e) => setBuscaAmigo(e.target.value)}
              className="bg-transparent w-full outline-none text-sm text-white placeholder:text-gray-500"
            />
          </div>

          {/* Chips de Selecionados */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            <div className="flex items-center gap-1.5 bg-[#1c1c1e] border border-[#2DD4BF]/40 px-3 py-1.5 rounded-full shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#2DD4BF] text-[#05080f] text-[10px] font-black flex items-center justify-center">
                V
              </div>
              <span className="text-xs text-white font-medium">Você</span>
            </div>

            {amigos
              .filter((a) => selecionados.includes(a.id))
              .map((amigo) => {
                const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
                return (
                  <button
                    key={amigo.id}
                    type="button"
                    onClick={() => toggleAmigo(amigo.id)}
                    className="flex items-center gap-1.5 bg-[#1c1c1e] border border-white/10 px-3 py-1.5 rounded-full shrink-0 hover:border-red-400/50"
                  >
                    <div
                      className={`w-5 h-5 rounded-full ${corAmigo} text-white text-[10px] font-bold flex items-center justify-center`}
                    >
                      {nomeAmigo[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs text-white font-medium">{nomeAmigo.split(' ')[0]}</span>
                    <X size={12} className="text-gray-400" />
                  </button>
                );
              })}
          </div>

          {/* Lista de Amigos Selecionáveis */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {amigosFiltrados.length === 0 ? (
              <div className="text-center py-4 bg-[#1c1c1e] rounded-2xl border border-white/5">
                <p className="text-gray-400 text-xs mb-2">Nenhum amigo encontrado.</p>
                <button
                  type="button"
                  onClick={() => setIsAddFriendOpen(true)}
                  className="text-xs text-[#2DD4BF] font-bold hover:underline"
                >
                  + Cadastrar novo amigo agora
                </button>
              </div>
            ) : (
              amigosFiltrados.map((amigo) => {
                const isSelected = selecionados.includes(amigo.id);
                const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
                const telFormatado = formatPhoneBR(amigo.telefone || amigo.phone || '');
                return (
                  <div
                    key={amigo.id}
                    onClick={() => toggleAmigo(amigo.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#2DD4BF]/10 border-[#2DD4BF]/40'
                        : 'bg-[#1c1c1e] sm:bg-[#2c2c2e]/60 border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full ${corAmigo} flex items-center justify-center font-bold text-white text-sm`}
                      >
                        {nomeAmigo[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="text-white font-medium text-sm block">{nomeAmigo}</span>
                        {telFormatado && (
                          <span className="text-[11px] text-gray-500">{telFormatado}</span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#2DD4BF] text-[#05080f]'
                          : 'border-2 border-gray-600 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <button
          onClick={handleSalvar}
          disabled={isLoading}
          className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] disabled:opacity-50 text-[#05080f] font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <>
              <span>{isEditing ? 'Salvar Alterações' : 'Criar Grupo'}</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>

      {/* Modal de Criar Novo Amigo diretamente do fluxo de Grupo */}
      <AddFriendModal
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
        onSuccess={async (novoAmigo) => {
          await carregarAmigos();
          if (novoAmigo?.id) {
            setSelecionados((prev) =>
              prev.includes(novoAmigo.id) ? prev : [...prev, novoAmigo.id]
            );
          }
        }}
      />
    </div>
  );
}