// src/components/AddFriendModal.tsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, QrCode, Palette, Check } from 'lucide-react';
import { dbService } from '../services/database';
import { formatPhoneBR, isValidPhoneBR, stripCountryCode } from '../utils/phoneFormatter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { getAvatarColor, PRESET_AVATAR_COLORS, hslToHex, hexToHsl } from '../utils/avatarColor';
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
          <label className="block text-gray-400 text-xs uppercase font-bold mb-2">
            WhatsApp com DDD (Opcional)
          </label>
          <div className="bg-[#2c2c2e] rounded-xl p-3.5 flex items-center text-white focus-within:ring-2 focus-within:ring-[#2DD4BF]">
            <Phone size={18} className="text-gray-400 mr-3 shrink-0" />
            <input
              type="tel"
              placeholder="(85) 99999-8888"
              value={telefone}
              onChange={handlePhoneChange}
              maxLength={15}
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Campo: Pix */}
        <div className="mb-4">
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
          <div className="flex justify-between items-center mb-2.5">
            <label className="text-gray-400 text-xs uppercase font-bold tracking-wider">
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
              className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all flex items-center gap-1.5 active:scale-95 ${
                isCustomMode
                  ? 'bg-[#2DD4BF]/20 text-[#2DD4BF] border border-[#2DD4BF]/40'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              <Palette size={13} />
              {isCustomMode ? 'Cores Rápidas' : 'Personalizar'}
            </button>
          </div>

          {/* Grid de 14 Cores Rápidas */}
          <div className="bg-[#2c2c2e] p-3 rounded-2xl border border-white/5">
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
                        ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#2c2c2e] shadow-md z-10'
                        : 'opacity-85 hover:opacity-100 hover:scale-105'
                    }`}
                  >
                    {isActive && (
                      <Check size={14} className="text-white drop-shadow stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel Avançado / Personalizado */}
          {isCustomMode && (
            <div className="mt-3 bg-[#2c2c2e] p-3.5 rounded-2xl border border-white/10 space-y-3.5 animate-slide-up">
              {/* Slider de Matiz / Hue */}
              <div>
                <div className="flex justify-between items-center text-xs text-gray-400 mb-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span
                      style={{ backgroundColor: getAvatarColor(corSelecionada) }}
                      className="w-3 h-3 rounded-full inline-block shadow-sm"
                    />
                    Ajustar Tom
                  </span>
                  <span className="text-gray-500 font-mono text-[11px]">{hue}°</span>
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

              {/* Input Hexadecimal e Conta-Gotas */}
              <div className="flex items-center gap-2 pt-0.5">
                <div
                  style={{ backgroundColor: getAvatarColor(corSelecionada) }}
                  className="w-10 h-10 rounded-xl border border-white/20 shrink-0 shadow-inner transition-colors duration-200"
                />
                <div className="flex-1 bg-[#1c1c1e] rounded-xl px-3 py-2 flex items-center border border-white/10 focus-within:border-[#2DD4BF] transition-colors">
                  <span className="text-gray-500 text-sm font-mono mr-1">#</span>
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
                    placeholder="2DD4BF"
                    className="bg-transparent w-full outline-none text-white font-mono text-sm uppercase placeholder:text-gray-600"
                  />
                </div>

                {/* Seletor do Sistema (opcional para quem quiser o contagotas nativo) */}
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
                  className="bg-[#1c1c1e] hover:bg-[#333] text-gray-400 hover:text-white p-2.5 rounded-xl border border-white/10 transition-colors shrink-0 active:scale-95 flex items-center justify-center"
                >
                  <Palette size={18} />
                </button>
              </div>
            </div>
          )}
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
