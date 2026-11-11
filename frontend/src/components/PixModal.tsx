// src/components/PixModal.tsx
import { createPortal } from 'react-dom';
import React, { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode, Share2, Lightbulb } from 'lucide-react';
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 border border-[var(--border-color)] shadow-lg relative max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto animate-slide-up pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-[var(--border-color)] rounded-full mx-auto mb-3.5 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-full hover:bg-[var(--bg-subtle)] transition-colors active:scale-95"
        >
          <X size={22} strokeWidth={2} />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-11 h-11 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <QrCode size={22} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-h2 text-[var(--text-primary)] truncate">
              {allowEditAmount ? 'Teste de QR Code Pix' : 'Pagamento via Pix'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              Recebedor: {recipientName}
            </p>
          </div>
        </div>

        {/* Bloco de Valor */}
        {allowEditAmount ? (
          <div className="bg-[var(--bg-subtle)] rounded-2xl p-4 text-center mb-4 border border-[var(--border-color)] relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wider">
                Valor para Teste
              </span>
              <span className="text-xs text-[var(--primary)] font-semibold bg-[var(--primary-light)] px-2.5 py-0.5 rounded-full">
                Editável
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5 py-1">
              <span className="text-2xl font-display font-bold text-[var(--primary)]">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={handleAmountChange}
                placeholder="0,00"
                className="bg-transparent text-display text-[var(--text-primary)] outline-none w-44 text-center border-b border-dashed border-[var(--border-color)] focus:border-[var(--primary)] focus:text-[var(--primary)] transition-all"
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
                  className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95 border ${
                    currentAmount === preset
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  R$ {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleSelectPreset(0)}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95 border ${
                  currentAmount === 0
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
                }`}
                title="Sem valor pré-definido no QR Code"
              >
                Sem valor
              </button>
            </div>

            {currentAmount === 0 ? (
              <p className="text-xs text-[#F59E0B] mt-2 flex items-center justify-center gap-1.5">
                <Lightbulb size={14} strokeWidth={2} className="shrink-0 text-[#F59E0B]" />
                <span>QR Code aberto: o valor será digitado no app do banco.</span>
              </p>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                QR Code e Copia e Cola atualizados em tempo real.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-[var(--bg-subtle)] rounded-2xl p-4 text-center mb-4 border border-[var(--border-color)]">
            <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold">
              Valor do Acerto
            </p>
            <p className="text-display text-[var(--primary)] mt-1 tabular-nums">
              R$ {moneyConverter(amount)}
            </p>
          </div>
        )}

        {!pixKey ? (
          <div className="bg-[var(--amber-bg)] border border-[var(--amber-border)] text-[#F59E0B] rounded-2xl p-4 text-sm text-center mb-4">
            Nenhuma chave Pix cadastrada para <strong>{recipientName}</strong>. Cadastre a chave na aba Perfil ou nos detalhes do amigo!
          </div>
        ) : (
          <>
            {qrCodeUrl && (
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-[var(--border-color)]">
                  <img src={qrCodeUrl} alt="QR Code Pix" className="w-48 h-48" />
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-2">
                  Escaneie o QR Code no aplicativo do seu banco
                </p>
              </div>
            )}

            <div className="space-y-3 mb-5">
              <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-xl p-3.5 flex items-center justify-between gap-2.5">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold">
                    Chave Pix
                  </p>
                  <p className="text-sm text-[var(--text-primary)] font-medium truncate">
                    {pixKey}
                  </p>
                </div>
                <button
                  onClick={handleCopyKey}
                  className="bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  {copiedKey ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                  {copiedKey ? 'Copiada!' : 'Copiar'}
                </button>
              </div>

              {copiaECola && (
                <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-xl p-3.5 flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold">
                      Pix Copia e Cola
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] font-mono truncate">
                      {copiaECola}
                    </p>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    {copiedCode ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                    {copiedCode ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <button
          onClick={handleSendWhatsApp}
          className="w-full h-12 bg-[#10B981] hover:opacity-95 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-sm"
        >
          <Share2 size={18} strokeWidth={2} />
          {allowEditAmount ? 'Compartilhar no WhatsApp' : 'Enviar Cobrança no WhatsApp'}
        </button>
      </div>
    </div>,
    document.body
  );
}
