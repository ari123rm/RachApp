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

  const sheetRef = useModalBackHandler(isOpen, onClose);

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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="bg-[var(--bg-surface)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up relative max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto border border-[var(--border-color)] shadow-lg pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle de arrastar para baixo (sempre acessível no topo) */}
        <div
          data-sheet-handle="true"
          className="sticky -top-6 z-20 bg-[var(--bg-surface)]/95 backdrop-blur-sm w-full pt-2.5 pb-3 -mt-6 mb-2 flex justify-center items-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
        >
          <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full" />
        </div>

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-full hover:bg-[var(--bg-subtle)] transition-colors active:scale-95"
        >
          <X size={22} strokeWidth={2} />
        </button>

        <h2
          data-sheet-handle="true"
          className="text-h1 text-[var(--text-primary)] mb-5 pr-8 select-none"
        >
          {isEditing ? 'Editar Grupo' : 'Criar Grupo'}
        </h2>

        {/* Ícone do Grupo (Circular 50% conforme Design System) */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative">
            <div
              onClick={() => {
                if (canEditIcon) setIsAvatarModalOpen(true);
              }}
              className={`w-20 h-20 rounded-full overflow-hidden bg-[var(--primary-light)] border-2 border-[var(--primary)]/30 flex items-center justify-center relative transition-colors shadow-sm ${
                canEditIcon ? 'cursor-pointer hover:border-[var(--primary)]' : ''
              }`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={nome || 'Ícone do Grupo'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Users size={30} strokeWidth={2} className="text-[var(--primary)]" />
              )}
            </div>

            {canEditIcon && (
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                title="Alterar ícone do grupo"
                className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white shadow-sm flex items-center justify-center border-2 border-[var(--bg-surface)] transition-transform active:scale-90"
              >
                <Pencil size={13} strokeWidth={2} />
              </button>
            )}
          </div>

          {canEditIcon ? (
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="text-xs text-[var(--primary)] font-semibold flex items-center gap-1 hover:underline active:scale-95 transition-transform"
              >
                <Camera size={13} strokeWidth={2} />
                {avatarUrl ? 'Editar ícone' : 'Adicionar ícone'}
              </button>
              {avatarUrl && (
                <>
                  <span className="text-[var(--text-secondary)] text-xs">•</span>
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-xs text-[#F43F5E] font-semibold flex items-center gap-1 hover:underline active:scale-95 transition-transform"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                    Deixar padrão
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)] mt-1.5">
              Apenas quem criou o grupo pode editar o ícone
            </p>
          )}
        </div>

        {/* Nome do Grupo */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold">
              Nome do Grupo
            </label>
            <span className="text-xs text-[var(--text-secondary)]">{nome.length}/30</span>
          </div>
          <div className="h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-[var(--bg-surface)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15 transition-all">
            <Users size={18} strokeWidth={2} className="text-[var(--primary)] mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Ex: Apê República, Viagem..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={30}
              className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
            />
          </div>
        </div>

        {/* Participantes */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <label className="text-h2 text-[var(--text-primary)]">Participantes</label>
              <span className="text-xs bg-[var(--primary-light)] text-[var(--primary)] font-semibold px-2.5 py-0.5 rounded-full">
                {totalPessoas} {totalPessoas === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsAddFriendOpen(true)}
              className="bg-[var(--primary-light)] hover:opacity-90 text-[var(--primary)] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <UserPlus size={14} strokeWidth={2} /> Novo Amigo
            </button>
          </div>

          {/* Busca de Amigo */}
          <div className="h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center text-[var(--text-secondary)] border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-[var(--bg-surface)] mb-3 transition-all">
            <Search size={18} strokeWidth={2} className="mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Buscar amigo cadastrado..."
              value={buscaAmigo}
              onChange={(e) => setBuscaAmigo(e.target.value)}
              className="bg-transparent w-full outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
            />
          </div>

          {/* Chips de Selecionados */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            <div className="flex items-center gap-1.5 bg-[var(--primary-light)] border border-[var(--primary)]/20 px-3 py-1.5 rounded-full shrink-0">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center">
                {myAvatarUrl ? (
                  <img src={myAvatarUrl} alt="Você" className="w-full h-full object-cover" />
                ) : (
                  'V'
                )}
              </div>
              <span className="text-xs text-[var(--primary)] font-semibold">Você</span>
            </div>

            {amigos
              .filter((a) => selecionados.includes(a.id))
              .map((amigo) => {
                const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                const corAmigo = amigo.cor || amigo.color || 'bg-teal-600';
                return (
                  <button
                    key={amigo.id}
                    type="button"
                    onClick={() => toggleAmigo(amigo.id)}
                    className="flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border-color)] px-3 py-1.5 rounded-full shrink-0 hover:border-[#F43F5E]/50"
                  >
                    <div
                      style={
                        amigo.avatar_url ? undefined : { backgroundColor: getAvatarColor(corAmigo) }
                      }
                      className="w-5 h-5 rounded-full overflow-hidden text-white text-xs font-bold flex items-center justify-center"
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
                    <span className="text-xs text-[var(--text-primary)] font-medium flex items-center gap-1">
                      <span>{nomeAmigo.split(' ')[0]}</span>
                      {(amigo.has_account || amigo.is_registered) && (
                        <BadgeCheck size={12} strokeWidth={2} className="text-[var(--primary)] fill-[var(--primary-light)] shrink-0" />
                      )}
                    </span>
                    <X size={12} strokeWidth={2} className="text-[var(--text-secondary)]" />
                  </button>
                );
              })}
          </div>

          {/* Lista de Amigos Selecionáveis */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {amigosFiltrados.length === 0 ? (
              <div className="text-center py-6 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-color)]">
                <p className="text-[var(--text-secondary)] text-xs mb-2">Nenhum amigo encontrado.</p>
                <button
                  type="button"
                  onClick={() => setIsAddFriendOpen(true)}
                  className="text-xs text-[var(--primary)] font-semibold hover:underline"
                >
                  + Cadastrar novo amigo agora
                </button>
              </div>
            ) : (
              amigosFiltrados.map((amigo) => {
                const isSelected = selecionados.includes(amigo.id);
                const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                const corAmigo = amigo.cor || amigo.color || 'bg-teal-600';
                const telFormatado = formatPhoneBR(amigo.telefone || amigo.phone || '');
                return (
                  <div
                    key={amigo.id}
                    onClick={() => toggleAmigo(amigo.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--primary-light)]/40 border-[var(--primary)]/40'
                        : 'bg-[var(--bg-subtle)] border-[var(--border-color)] hover:border-[var(--primary)]/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        style={
                          amigo.avatar_url ? undefined : { backgroundColor: getAvatarColor(corAmigo) }
                        }
                        className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-display font-bold text-white text-sm shrink-0"
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
                          <span className="font-display font-semibold text-[var(--text-primary)] text-sm block">
                            {nomeAmigo}
                          </span>
                          {(amigo.has_account || amigo.is_registered) && (
                            <BadgeCheck size={15} strokeWidth={2} className="text-[var(--primary)] fill-[var(--primary-light)] shrink-0" />
                          )}
                        </div>
                        {telFormatado && (
                          <span className="text-xs text-[var(--text-secondary)]">{telFormatado}</span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[var(--primary)] text-white'
                          : 'border-2 border-[var(--border-color)] bg-transparent'
                      }`}
                    >
                      {isSelected && <Check size={14} strokeWidth={2.5} />}
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
          className="w-full ds-btn-primary"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" size={20} strokeWidth={2} />
          ) : (
            <>
              <span>{isEditing ? 'Salvar Alterações' : 'Criar Grupo'}</span>
              <ArrowRight size={18} strokeWidth={2} />
            </>
          )}
        </button>
      </div>

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

      <AvatarEditModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatarUrl={avatarUrl}
        title="Ícone do Grupo"
        maskShape="circle"
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
