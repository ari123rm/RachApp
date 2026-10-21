import { createPortal } from 'react-dom';
// src/components/PixModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode, Share2 } from 'lucide-react';
import { generatePixCopiaECola, generatePixQRCodeDataUrl } from '../utils/pixGenerator';
import moneyConverter from '../utils/moneyConverter';
import { openWhatsApp } from '../utils/phoneFormatter';
import { useModalBackHandler } from '../utils/modalBackHandler';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixKey: string;
  recipientName: string;
  amount: number;
  description?: string;
  whatsappPhone?: string;
  whatsappCustomMessage?: string;
  allowEditAmount?: boolean;
  onAmountChange?: (newAmount: number) => void;
}

export function PixModal({
  isOpen,
  onClose,
  pixKey,
  recipientName,
  amount,
  description = 'Acerto RachApp',
  whatsappPhone,
  whatsappCustomMessage,
  allowEditAmount = false,
  onAmountChange,
}: PixModalProps) {
  const [currentAmount, setCurrentAmount] = useState<number>(amount);
  const [amountInput, setAmountInput] = useState<string>(() =>
    amount > 0 ? moneyConverter(amount) : ''
  );
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copiaECola, setCopiaECola] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useModalBackHandler(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setCurrentAmount(amount);
      setAmountInput(amount > 0 ? moneyConverter(amount) : '');
    }
  }, [isOpen, amount]);

  const activeAmount = allowEditAmount ? currentAmount : amount;

  useEffect(() => {
    if (isOpen && pixKey) {
      const payload = generatePixCopiaECola({
        pixKey,
        merchantName: recipientName || 'RachApp',
        amount: activeAmount > 0 ? activeAmount : undefined,
        description,
      });
      setCopiaECola(payload);
      generatePixQRCodeDataUrl(payload)
        .then(setQrCodeUrl)
        .catch(() => setQrCodeUrl(''));
    } else {
      setQrCodeUrl('');
      setCopiaECola('');
    }
  }, [isOpen, pixKey, recipientName, activeAmount, description]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const apenasNumeros = e.target.value.replace(/\D/g, '');
    if (apenasNumeros === '') {
      setAmountInput('');
      setCurrentAmount(0);
      onAmountChange?.(0);
      return;
    }
    const valorEmCentavos = Number(apenasNumeros) / 100;
    setCurrentAmount(valorEmCentavos);
    setAmountInput(
      valorEmCentavos.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    onAmountChange?.(valorEmCentavos);
  };

  const handleSelectPreset = (preset: number) => {
    setCurrentAmount(preset);
    setAmountInput(
      preset > 0
        ? preset.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : ''
    );
    onAmountChange?.(preset);
  };

  if (!isOpen) return null;

  const handleCopyKey = async () => {
    if (!pixKey) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pixKey);
      } else {
        throw new Error('Fallback');
      }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = pixKey;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyCode = async () => {
    if (!copiaECola) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(copiaECola);
      } else {
        throw new Error('Fallback');
      }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = copiaECola;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const valorTexto = activeAmount > 0 ? `R$ ${moneyConverter(activeAmount)}` : 'Valor a definir';
    const defaultMsg =
      whatsappCustomMessage ||
      `Olá! Segue o resumo do acerto pelo RachApp:\nValor: ${valorTexto}\nChave Pix (${recipientName}): ${pixKey}${
        copiaECola ? `\n\nPix Copia e Cola:\n${copiaECola}` : ''
      }`;
    openWhatsApp(whatsappPhone, defaultMsg);
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center">
            <QrCode size={22} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">
              {allowEditAmount ? 'Teste de QR Code Pix' : 'Pagamento via Pix'}
            </h3>
            <p className="text-xs text-gray-400">Recebedor: {recipientName}</p>
          </div>
        </div>

        {/* Bloco de Valor */}
        {allowEditAmount ? (
          <div className="bg-[#05080f] rounded-2xl p-4 text-center mb-4 border border-[#2DD4BF]/30 relative shadow-inner">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">
                Valor para Teste
              </span>
              <span className="text-[10px] text-[#2DD4BF] font-semibold bg-[#2DD4BF]/15 px-2 py-0.5 rounded-full border border-[#2DD4BF]/30">
                Editável
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5 py-1">
              <span className="text-2xl font-black text-[#2DD4BF]">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={handleAmountChange}
                placeholder="0,00"
                className="bg-transparent text-3xl font-black text-white outline-none w-44 text-center border-b border-dashed border-gray-600 focus:border-[#2DD4BF] focus:text-[#2DD4BF] transition-all"
                autoFocus
              />
            </div>

            {/* Presets rápidos */}
            <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
              {[1, 5, 10, 25, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all active:scale-95 ${
                    currentAmount === preset
                      ? 'bg-[#2DD4BF] text-[#05080f] shadow-sm shadow-[#2DD4BF]/20'
                      : 'bg-[#2c2c2e] text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  R$ {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleSelectPreset(0)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all active:scale-95 ${
                  currentAmount === 0
                    ? 'bg-[#2DD4BF] text-[#05080f] shadow-sm shadow-[#2DD4BF]/20'
                    : 'bg-[#2c2c2e] text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
                title="Sem valor pré-definido no QR Code"
              >
                Sem valor
              </button>
            </div>

            {currentAmount === 0 ? (
              <p className="text-[11px] text-amber-300/80 mt-2">
                💡 QR Code aberto: o valor será digitado no app do banco.
              </p>
            ) : (
              <p className="text-[10px] text-gray-400 mt-2">
                QR Code e Copia e Cola atualizados em tempo real.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-[#05080f] rounded-2xl p-4 text-center mb-4 border border-white/5">
            <p className="text-xs text-gray-400 uppercase font-semibold">Valor do Acerto</p>
            <p className="text-3xl font-black text-[#2DD4BF] mt-1">
              R$ {moneyConverter(amount)}
            </p>
          </div>
        )}

        {!pixKey ? (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl p-4 text-sm text-center mb-4">
            Nenhuma chave Pix cadastrada para <strong>{recipientName}</strong>. Cadastre a chave na aba Perfil ou nos detalhes do amigo!
          </div>
        ) : (
          <>
            {qrCodeUrl && (
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="bg-white p-3 rounded-2xl shadow-lg">
                  <img src={qrCodeUrl} alt="QR Code Pix" className="w-48 h-48" />
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Escaneie o QR Code no aplicativo do seu banco
                </p>
              </div>
            )}

            <div className="space-y-3 mb-5">
              <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="overflow-hidden">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Chave Pix</p>
                  <p className="text-sm text-white font-medium truncate">{pixKey}</p>
                </div>
                <button
                  onClick={handleCopyKey}
                  className="bg-[#2DD4BF]/20 text-[#2DD4BF] hover:bg-[#2DD4BF]/30 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey ? 'Copiada!' : 'Copiar'}
                </button>
              </div>

              {copiaECola && (
                <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="overflow-hidden">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Pix Copia e Cola</p>
                    <p className="text-xs text-gray-300 font-mono truncate">{copiaECola}</p>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="bg-[#2DD4BF] text-[#05080f] hover:bg-[#25b5a3] px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"
                  >
                    {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                    {copiedCode ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <button
          onClick={handleSendWhatsApp}
          className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Share2 size={18} />
          {allowEditAmount ? 'Compartilhar no WhatsApp' : 'Enviar Cobrança no WhatsApp'}
        </button>
      </div>
    </div>,
    document.body
  );
}
