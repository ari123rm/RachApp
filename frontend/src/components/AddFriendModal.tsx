// src/components/AddFriendModal.tsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, QrCode, Palette } from 'lucide-react';
import { dbService } from '../services/database';
import { formatPhoneBR, isValidPhoneBR, stripCountryCode } from '../utils/phoneFormatter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { getAvatarColor, PRESET_AVATAR_COLORS } from '../utils/avatarColor';
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
  const [erro, setErro] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useModalBackHandler(isOpen, onClose);

  const isEditing = !!friendToEdit;

  useEffect(() => {
    if (isOpen) {
      setErro('');
      if (friendToEdit) {
        setNome(friendToEdit.nome || friendToEdit.name || '');
        setTelefone(formatPhoneBR(friendToEdit.telefone || friendToEdit.phone || ''));
        setPixKey(friendToEdit.pix_key || friendToEdit.pix || '');
        setCorSelecionada(friendToEdit.cor || friendToEdit.color || PRESET_AVATAR_COLORS[0]);
      } else {
        setNome('');
        setTelefone('');
        setPixKey('');
        setCorSelecionada(PRESET_AVATAR_COLORS[0]);
      }
    }
  }, [isOpen, friendToEdit]);

  if (!isOpen) return null;

  const inicial = nome ? nome.trim().charAt(0).toUpperCase() : '?';

  const isCustomColor = !PRESET_AVATAR_COLORS.some(
    (c) => c.toLowerCase() === getAvatarColor(corSelecionada).toLowerCase()
  );

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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] w-full max-w-md rounded-3xl p-6 animate-slide-up relative overflow-y-auto max-h-[90vh] border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">
          {isEditing ? 'Editar Amigo' : 'Adicionar Amigo'}
        </h2>

        {erro && (
          <div className="mb-4 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium p-3 rounded-xl">
            {erro}
          </div>
        )}

        {/* Preview do Avatar */}
        <div className="flex flex-col items-center justify-center mb-6 gap-2">
          <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Visual do Amigo</p>
          <div
            style={{ backgroundColor: getAvatarColor(corSelecionada) }}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl border-4 border-white/10 transition-colors duration-300"
          >
            <span className="text-4xl font-black text-white tracking-tighter">{inicial}</span>
          </div>
        </div>

        {/* Campo: Nome */}
        <div className="mb-4">
          <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Nome do Amigo</label>
          <div className="bg-[#2c2c2e] rounded-xl p-3.5 flex items-center text-white focus-within:ring-2 focus-within:ring-[#2DD4BF]">
            <User size={18} className="text-gray-400 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Ex: Pimenta, Ryan, Bia..."
              value={nome}
              onChange={(e) => {
                setErro('');
                setNome(e.target.value);
              }}
              maxLength={30}
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Campo: WhatsApp formatado */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-400 text-xs uppercase font-bold">WhatsApp (com DDD)</label>
            <span className="text-[10px] text-gray-500">Aceita com ou sem +55</span>
          </div>
          <div className="bg-[#2c2c2e] rounded-xl p-3.5 flex items-center text-white focus-within:ring-2 focus-within:ring-[#2DD4BF]">
            <Phone size={18} className="text-gray-400 mr-3 shrink-0" />
            <input
              type="tel"
              placeholder="(85) 99999-8888"
              value={telefone}
              onChange={handlePhoneChange}
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Campo: Chave Pix */}
        <div className="mb-5">
          <label className="block text-gray-400 text-xs uppercase font-bold mb-2">
            Chave Pix do Amigo (Opcional)
          </label>
          <div className="bg-[#2c2c2e] rounded-xl p-3.5 flex items-center text-white focus-within:ring-2 focus-within:ring-[#2DD4BF]">
            <QrCode size={18} className="text-gray-400 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="CPF, E-mail, Telefone ou Chave Aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Escolha de Cor */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-400 text-xs uppercase font-bold">
              Cor de Destaque
            </label>
            <span className="text-[10px] text-gray-500">
              {isCustomColor ? 'Cor personalizada' : 'Selecione ou personalize'}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2 bg-[#2c2c2e] p-3 rounded-2xl border border-white/5">
            {PRESET_AVATAR_COLORS.map((cor) => {
              const isActive =
                getAvatarColor(corSelecionada).toLowerCase() === cor.toLowerCase();
              return (
                <button
                  key={cor}
                  type="button"
                  style={{ backgroundColor: cor }}
                  onClick={() => setCorSelecionada(cor)}
                  className={`w-9 h-9 rounded-full transition-all duration-200 relative ${
                    isActive
                      ? 'scale-110 ring-4 ring-white/30 shadow-lg'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                    </div>
                  )}
                </button>
              );
            })}

            {/* 7ª Bolinha: Seletor de Cor Personalizada */}
            <div className="relative">
              <input
                ref={colorInputRef}
                type="color"
                value={getAvatarColor(corSelecionada)}
                onChange={(e) => setCorSelecionada(e.target.value)}
                className="sr-only"
                id="custom-color-picker"
              />
              <button
                type="button"
                onClick={() => colorInputRef.current?.click()}
                style={
                  isCustomColor
                    ? { backgroundColor: getAvatarColor(corSelecionada) }
                    : undefined
                }
                className={`w-9 h-9 rounded-full transition-all duration-200 relative flex items-center justify-center ${
                  isCustomColor
                    ? 'scale-110 ring-4 ring-white/30 shadow-lg'
                    : 'bg-gradient-to-tr from-pink-500 via-amber-400 to-cyan-400 hover:scale-105 opacity-90 hover:opacity-100'
                }`}
                title="Escolher qualquer cor personalizada"
              >
                <Palette
                  size={16}
                  className={
                    isCustomColor ? 'text-white drop-shadow' : 'text-[#05080f] drop-shadow-sm'
                  }
                />
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleSalvar}
          disabled={isLoading}
          className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] disabled:opacity-50 text-[#05080f] font-bold py-4 rounded-xl text-base transition-all active:scale-95"
        >
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar Amigo'}
        </button>
      </div>
    </div>,
    document.body
  );
}
