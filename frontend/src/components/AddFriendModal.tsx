// src/components/AddFriendModal.tsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, QrCode, Palette, Check, BookUser } from 'lucide-react';
import { dbService } from '../services/database';
import { formatPhoneBR, isValidPhoneBR, stripCountryCode } from '../utils/phoneFormatter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { getAvatarColor, PRESET_AVATAR_COLORS, hslToHex, hexToHsl } from '../utils/avatarColor';
import { ImportContactsModal } from './ImportContactsModal';
import type { Amigo } from '../types';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (amigoSalvo?: Amigo) => void;
  friendToEdit?: Amigo | null;
}

export function AddFriendModal({ isOpen, onClose, onSuccess, friendToEdit }: AddFriendModalProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [corSelecionada, setCorSelecionada] = useState(PRESET_AVATAR_COLORS[0]);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [hue, setHue] = useState(172);
  const [hexInput, setHexInput] = useState(getAvatarColor(PRESET_AVATAR_COLORS[0]));
  const [erro, setErro] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImportContactsOpen, setIsImportContactsOpen] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const sheetRef = useModalBackHandler(isOpen, onClose);

  const isEditing = !!friendToEdit;

  useEffect(() => {
    if (isOpen) {
      setErro('');
      if (friendToEdit) {
        setNome(friendToEdit.nome || friendToEdit.name || '');
        setTelefone(formatPhoneBR(friendToEdit.telefone || friendToEdit.phone || ''));
        setPixKey(friendToEdit.pix_key || friendToEdit.pix || '');
        const initialCor = friendToEdit.cor || friendToEdit.color || PRESET_AVATAR_COLORS[0];
        const hex = getAvatarColor(initialCor);
        setCorSelecionada(initialCor);
        setHexInput(hex);
        setHue(hexToHsl(hex).h);
        const isPreset = PRESET_AVATAR_COLORS.some(
          (c) => c.toLowerCase() === hex.toLowerCase()
        );
        setIsCustomMode(!isPreset);
      } else {
        setNome('');
        setTelefone('');
        setPixKey('');
        setCorSelecionada(PRESET_AVATAR_COLORS[0]);
        setHexInput(PRESET_AVATAR_COLORS[0]);
        setHue(hexToHsl(PRESET_AVATAR_COLORS[0]).h);
        setIsCustomMode(false);
      }
    }
  }, [isOpen, friendToEdit]);

  if (!isOpen) return null;

  const inicial = nome ? nome.trim().charAt(0).toUpperCase() : '?';

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErro('');
    setTelefone(formatPhoneBR(e.target.value));
  };

  const handleSalvar = async () => {
    setErro('');
    if (!nome.trim()) {
      setErro('O nome do amigo é obrigatório!');
      return;
    }

    const phoneDigits = stripCountryCode(telefone);
    if (phoneDigits.length > 0 && !isValidPhoneBR(phoneDigits)) {
      setErro('Informe um WhatsApp válido com DDD (ex: (85) 99999-8888).');
      return;
    }

    setIsLoading(true);
    try {
      let saved: Amigo;
      if (isEditing && friendToEdit) {
        saved = await dbService.amigos.update(friendToEdit.id, {
          nome: nome.trim(),
          telefone: phoneDigits,
          pix_key: pixKey.trim(),
          cor: corSelecionada,
          favorito: friendToEdit.favorito ?? friendToEdit.is_favorite ?? false,
        });
      } else {
        saved = await dbService.amigos.create({
          nome: nome.trim(),
          telefone: phoneDigits,
          pix_key: pixKey.trim(),
          cor: corSelecionada,
          favorito: false,
        });
      }

      if (onSuccess) onSuccess(saved);
      onClose();
    } catch (error: any) {
      setErro(error?.message || 'Erro ao salvar o amigo.');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="bg-[var(--bg-surface)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up relative overflow-y-auto max-h-[92dvh] sm:max-h-[90vh] border border-[var(--border-color)] shadow-lg pb-safe"
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
          className="text-h1 text-[var(--text-primary)] mb-4 pr-8 select-none"
        >
          {isEditing ? 'Editar Amigo' : 'Adicionar Amigo'}
        </h2>

        {!isEditing && (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => setIsImportContactsOpen(true)}
              className="w-full ds-btn-secondary text-xs"
            >
              <BookUser size={17} strokeWidth={2} />
              <span>Adicionar da Lista de Contatos do Celular</span>
            </button>
          </div>
        )}

        {erro && (
          <div className="mb-4 bg-[var(--rose-bg)] border border-[var(--rose-border)] text-[#F43F5E] text-xs font-medium p-3 rounded-xl">
            {erro}
          </div>
        )}

        {/* Preview do Avatar (Circular) */}
        <div className="flex flex-col items-center justify-center mb-6 gap-2">
          <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold tracking-wider">
            Visual do Amigo
          </p>
          <div
            style={{ backgroundColor: getAvatarColor(corSelecionada) }}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-md border-4 border-[var(--bg-subtle)] transition-colors duration-300"
          >
            <span className="text-3xl font-display font-bold text-white tracking-tight">
              {inicial}
            </span>
          </div>
        </div>

        {/* Campo: Nome (48px height, 12px radius) */}
        <div className="mb-4">
          <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">
            Nome do Amigo
          </label>
          <div className="h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-[var(--bg-surface)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15 transition-all">
            <User size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Ex: Pimenta, Ryan, Bia..."
              value={nome}
              onChange={(e) => {
                setErro('');
                setNome(e.target.value);
              }}
              maxLength={30}
              className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
            />
          </div>
        </div>

        {/* Campo: WhatsApp formatado */}
        <div className="mb-4">
          <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">
            WhatsApp com DDD (Opcional)
          </label>
          <div className="h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-[var(--bg-surface)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15 transition-all">
            <Phone size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
            <input
              type="tel"
              placeholder="(85) 99999-8888"
              value={telefone}
              onChange={handlePhoneChange}
              maxLength={15}
              className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
            />
          </div>
        </div>

        {/* Campo: Pix */}
        <div className="mb-4">
          <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">
            Chave Pix do Amigo (Opcional)
          </label>
          <div className="h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-[var(--bg-surface)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15 transition-all">
            <QrCode size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
            <input
              type="text"
              placeholder="CPF, E-mail, Telefone ou Chave Aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
            />
          </div>
        </div>

        {/* Escolha de Cor */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2.5">
            <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold tracking-wider">
              Cor do Avatar
            </label>
            <button
              type="button"
              onClick={() => {
                const nextMode = !isCustomMode;
                setIsCustomMode(nextMode);
                if (nextMode) {
                  const currentHex = getAvatarColor(corSelecionada);
                  setHexInput(currentHex);
                  setHue(hexToHsl(currentHex).h);
                }
              }}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition-all flex items-center gap-1.5 active:scale-95 border ${
                isCustomMode
                  ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/30'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              <Palette size={13} strokeWidth={2} />
              {isCustomMode ? 'Cores Rápidas' : 'Personalizar'}
            </button>
          </div>

          {/* Grid de 14 Cores Rápidas */}
          <div className="bg-[var(--bg-subtle)] p-3 rounded-2xl border border-[var(--border-color)]">
            <div className="grid grid-cols-7 gap-2.5">
              {PRESET_AVATAR_COLORS.map((cor) => {
                const isActive =
                  !isCustomMode &&
                  getAvatarColor(corSelecionada).toLowerCase() === cor.toLowerCase();
                return (
                  <button
                    key={cor}
                    type="button"
                    style={{ backgroundColor: cor }}
                    onClick={() => {
                      setCorSelecionada(cor);
                      setHexInput(cor);
                      setHue(hexToHsl(cor).h);
                      setIsCustomMode(false);
                    }}
                    className={`aspect-square w-full rounded-full transition-all duration-150 relative flex items-center justify-center active:scale-90 shadow-sm ${
                      isActive
                        ? 'scale-110 ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-subtle)] shadow-md z-10'
                        : 'opacity-85 hover:opacity-100 hover:scale-105'
                    }`}
                  >
                    {isActive && (
                      <Check size={14} strokeWidth={2.5} className="text-white drop-shadow" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel Avançado / Personalizado */}
          {isCustomMode && (
            <div className="mt-3 bg-[var(--bg-subtle)] p-3.5 rounded-2xl border border-[var(--border-color)] space-y-3.5 animate-slide-up">
              <div>
                <div className="flex justify-between items-center text-xs text-[var(--text-secondary)] mb-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span
                      style={{ backgroundColor: getAvatarColor(corSelecionada) }}
                      className="w-3 h-3 rounded-full inline-block shadow-sm"
                    />
                    Ajustar Tom
                  </span>
                  <span className="text-[var(--text-secondary)] font-mono text-xs">{hue}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hue}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setHue(val);
                    const newHex = hslToHex(val, 85, 52);
                    setCorSelecionada(newHex);
                    setHexInput(newHex);
                  }}
                  className="hue-slider w-full h-3 rounded-full appearance-none cursor-pointer outline-none transition-all"
                  style={{
                    background:
                      'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                  }}
                />
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <div
                  style={{ backgroundColor: getAvatarColor(corSelecionada) }}
                  className="w-10 h-10 rounded-full border border-[var(--border-color)] shrink-0 shadow-sm transition-colors duration-200"
                />
                <div className="flex-1 bg-[var(--bg-surface)] rounded-xl px-3 py-2 flex items-center border border-[var(--border-color)] focus-within:border-[var(--primary)] transition-colors">
                  <span className="text-[var(--text-secondary)] text-sm font-mono mr-1">#</span>
                  <input
                    type="text"
                    value={hexInput.replace(/^#/, '')}
                    maxLength={6}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
                      setHexInput(`#${raw}`);
                      if (raw.length === 6) {
                        const fullHex = `#${raw}`;
                        setCorSelecionada(fullHex);
                        setHue(hexToHsl(fullHex).h);
                      }
                    }}
                    placeholder="0F766E"
                    className="bg-transparent w-full outline-none text-[var(--text-primary)] font-mono text-sm uppercase placeholder:text-[var(--text-secondary)]"
                  />
                </div>

                <input
                  ref={colorInputRef}
                  type="color"
                  value={getAvatarColor(corSelecionada)}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setCorSelecionada(val);
                    setHexInput(val);
                    setHue(hexToHsl(val).h);
                  }}
                  className="sr-only"
                  id="system-color-picker"
                />
                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  title="Abrir seletor do sistema / conta-gotas"
                  className="bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2.5 rounded-xl border border-[var(--border-color)] transition-colors shrink-0 active:scale-95 flex items-center justify-center"
                >
                  <Palette size={18} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSalvar}
          disabled={isLoading}
          className="w-full ds-btn-primary"
        >
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar Amigo'}
        </button>
      </div>

      <ImportContactsModal
        isOpen={isImportContactsOpen}
        onClose={() => setIsImportContactsOpen(false)}
        onImported={(imported) => {
          if (onSuccess) onSuccess(imported[0]);
          onClose();
        }}
      />
    </div>,
    document.body
  );
}
