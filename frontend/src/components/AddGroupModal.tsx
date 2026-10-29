// src/components/AddGroupModal.tsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  LoaderCircle,
  Search,
  Check,
  ArrowRight,
  UserPlus,
  BadgeCheck,
  Pencil,
  Camera,
  Trash2,
} from 'lucide-react';
import { dbService } from '../services/database';
import { AddFriendModal } from './AddFriendModal';
import { formatPhoneBR } from '../utils/phoneFormatter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { AvatarEditModal } from './AvatarEditModal';
import { getAvatarColor } from '../utils/avatarColor';
import type { Amigo, Grupo } from '../types';

interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  groupToEdit?: Grupo | null;
}

export function AddGroupModal({ isOpen, onClose, onSuccess, groupToEdit }: AddGroupModalProps) {
  const [nome, setNome] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [buscaAmigo, setBuscaAmigo] = useState('');
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);

  useModalBackHandler(isOpen, onClose);

  const isEditing = !!groupToEdit;
  const canEditIcon =
    !isEditing ||
    !groupToEdit?.created_by ||
    !currentUserId ||
    groupToEdit.created_by === currentUserId ||
    groupToEdit.created_by === 'me';

  const carregarAmigos = async () => {
    const [lista, sessionUser] = await Promise.all([
      dbService.amigos.getAll(),
      dbService.auth.getSessionUser(),
    ]);
    setAmigos(lista);
    if (sessionUser) {
      setCurrentUserId(sessionUser.id || '');
      setMyAvatarUrl(sessionUser.avatar_url || null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarAmigos();
      if (groupToEdit) {
        setNome(groupToEdit.name || '');
        setAvatarUrl(groupToEdit.avatar_url || null);
        const fIds = (groupToEdit.members || [])
          .filter((m) => m.friend?.id)
          .map((m) => m.friend!.id);
        setSelecionados(fIds);
      } else {
        setNome('');
        setAvatarUrl(null);
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
          ...(canEditIcon ? { avatar_url: avatarUrl } : {}),
        });
      } else {
        await dbService.grupos.create({
          name: nome.trim(),
          friendIds: selecionados,
          avatar_url: avatarUrl,
        });
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      alert('Erro ao salvar grupo.');
    } finally {
      setIsLoading(false);
    }
  };

  const amigosFiltrados = amigos.filter((a) =>
    (a.nome || a.name || '').toLowerCase().includes(buscaAmigo.toLowerCase())
  );

  const totalPessoas = selecionados.length + 1;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl p-5 sm:p-6 animate-slide-up relative max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3.5 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors active:scale-95"
        >
          <X size={24} />
        </button>

        <h2 className="text-xl font-bold text-white mb-5 pr-8">
          {isEditing ? 'Editar Grupo' : 'Criar Grupo'}
        </h2>

        {/* Ícone do Grupo (Apenas o criador pode alterar) */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative">
            <div
              onClick={() => {
                if (canEditIcon) setIsAvatarModalOpen(true);
              }}
              className={`w-20 h-20 rounded-2xl overflow-hidden bg-[#2c2c2e] border-2 border-[#2DD4BF]/40 flex items-center justify-center relative transition-colors ${
                canEditIcon ? 'cursor-pointer hover:border-[#2DD4BF]' : ''
              }`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={nome || 'Ícone do Grupo'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Users size={30} className="text-[#2DD4BF]" />
              )}
            </div>

            {canEditIcon && (
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                title="Alterar ícone do grupo"
                className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] shadow-md flex items-center justify-center border-2 border-[#1c1c1e] transition-transform active:scale-90"
              >
                <Pencil size={12} className="stroke-[2.5px]" />
              </button>
            )}
          </div>

          {canEditIcon ? (
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="text-[11px] text-[#2DD4BF] font-bold flex items-center gap-1 hover:underline active:scale-95 transition-transform"
              >
                <Camera size={12} />
                {avatarUrl ? 'Editar ícone' : 'Adicionar ícone'}
              </button>
              {avatarUrl && (
                <>
                  <span className="text-gray-600 text-xs">•</span>
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-[11px] text-red-400 font-bold flex items-center gap-1 hover:underline active:scale-95 transition-transform"
                  >
                    <Trash2 size={12} />
                    Deixar padrão
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 mt-1.5">
              Apenas quem criou o grupo pode editar o ícone
            </p>
          )}
        </div>

        {/* Nome do Grupo */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-400 text-xs uppercase font-bold">Nome do Grupo</label>
            <span className="text-xs text-gray-500">{nome.length}/30</span>
          </div>
          <div className="bg-[#2c2c2e] rounded-2xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
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
          <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center text-gray-400 border border-white/5 mb-3">
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
            <div className="flex items-center gap-1.5 bg-[#05080f] border border-[#2DD4BF]/40 px-3 py-1.5 rounded-full shrink-0">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-[#2DD4BF] text-[#05080f] text-[10px] font-black flex items-center justify-center">
                {myAvatarUrl ? (
                  <img src={myAvatarUrl} alt="Você" className="w-full h-full object-cover" />
                ) : (
                  'V'
                )}
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
                    className="flex items-center gap-1.5 bg-[#05080f] border border-white/10 px-3 py-1.5 rounded-full shrink-0 hover:border-red-400/50"
                  >
                    <div
                      style={
                        amigo.avatar_url ? undefined : { backgroundColor: getAvatarColor(corAmigo) }
                      }
                      className="w-5 h-5 rounded-full overflow-hidden text-white text-[10px] font-bold flex items-center justify-center"
                    >
                      {amigo.avatar_url ? (
                        <img
                          src={amigo.avatar_url}
                          alt={nomeAmigo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        nomeAmigo[0]?.toUpperCase()
                      )}
                    </div>
                    <span className="text-xs text-white font-medium flex items-center gap-1">
                      <span>{nomeAmigo.split(' ')[0]}</span>
                      {(amigo.has_account || amigo.is_registered) && (
                        <BadgeCheck size={11} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
                      )}
                    </span>
                    <X size={12} className="text-gray-400" />
                  </button>
                );
              })}
          </div>

          {/* Lista de Amigos Selecionáveis */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {amigosFiltrados.length === 0 ? (
              <div className="text-center py-4 bg-[#05080f] rounded-2xl border border-white/5">
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
                        : 'bg-[#2c2c2e]/60 border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        style={
                          amigo.avatar_url ? undefined : { backgroundColor: getAvatarColor(corAmigo) }
                        }
                        className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-sm shrink-0"
                      >
                        {amigo.avatar_url ? (
                          <img
                            src={amigo.avatar_url}
                            alt={nomeAmigo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          nomeAmigo[0]?.toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-medium text-sm block">{nomeAmigo}</span>
                          {(amigo.has_account || amigo.is_registered) && (
                            <BadgeCheck size={15} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
                          )}
                        </div>
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

      {/* Modal de Recortar e Editar Ícone do Grupo */}
      <AvatarEditModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatarUrl={avatarUrl}
        title="Ícone do Grupo"
        maskShape="square"
        onSave={(croppedUrl) => {
          setAvatarUrl(croppedUrl);
          setIsAvatarModalOpen(false);
        }}
        onDelete={() => {
          setAvatarUrl(null);
          setIsAvatarModalOpen(false);
        }}
      />
    </div>,
    document.body
  );
}
