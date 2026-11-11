// src/components/ReceiptModals.tsx
import { createPortal } from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Check,
  Copy,
  QrCode,
  FileCheck2,
  LoaderCircle,
  Image as ImageIcon,
  Trash2,
  Share2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import moneyConverter from '../utils/moneyConverter';
import { generatePixCopiaECola, generatePixQRCodeDataUrl } from '../utils/pixGenerator';
import { compressReceiptImage, useModalBackHandler } from '../utils/modalBackHandler';
import { shareReceipt, parseReceiptUrls, serializeReceiptUrls } from '../utils/receiptShare';

interface ReceiptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl: string | string[] | null | undefined;
  title?: string;
  initialIndex?: number;
  onViewDetails?: () => void;
}

export function ReceiptViewerModal({
  isOpen,
  onClose,
  receiptUrl,
  title = 'Comprovante de Pagamento',
  initialIndex = 0,
  onViewDetails,
}: ReceiptViewerModalProps) {
  useModalBackHandler(isOpen, onClose);
  const receipts = parseReceiptUrls(receiptUrl);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const clamped = Math.min(Math.max(0, initialIndex || 0), Math.max(0, receipts.length - 1));
      setActiveIndex(clamped);
    }
  }, [isOpen, initialIndex, receiptUrl]);

  const currentReceiptUrl = receipts[activeIndex] || receipts[0] || null;

  const handleShare = async () => {
    if (!currentReceiptUrl) return;
    setIsSharing(true);
    const shareTitle =
      receipts.length > 1 ? `${title} (${activeIndex + 1}/${receipts.length})` : title;
    const result = await shareReceipt(currentReceiptUrl, shareTitle);
    setIsSharing(false);
    if (result.success) {
      setSharedFeedback(true);
      setTimeout(() => setSharedFeedback(false), 2500);
    }
  };

  if (!isOpen || receipts.length === 0 || !currentReceiptUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 border border-[var(--border-color)] shadow-xl relative max-h-[92dvh] sm:max-h-[88vh] flex flex-col pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-[var(--border-color)] rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
              <FileCheck2 size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[var(--text-primary)] text-h2 truncate">{title}</h3>
              {receipts.length > 1 && (
                <p className="text-caption text-[var(--primary)] font-semibold">
                  Comprovante {activeIndex + 1} de {receipts.length}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleShare}
              disabled={isSharing}
              title="Compartilhar comprovante em outros apps"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--primary)] rounded-full hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-50"
            >
              <Share2 size={20} strokeWidth={2} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Seletor de Comprovantes quando há mais de 1 */}
        {receipts.length > 1 && (
          <div className="mb-3">
            <p className="text-caption text-[var(--text-secondary)] font-semibold mb-1.5">
              Escolha qual comprovante deseja visualizar:
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {receipts.map((_, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`px-3 py-2 rounded-xl text-caption font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
                    }`}
                  >
                    <FileCheck2 size={14} strokeWidth={2} />
                    Comprovante {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-slate-950 rounded-2xl p-2 border border-[var(--border-color)] flex items-center justify-center min-h-[240px] relative">
          {receipts.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setActiveIndex((prev) => (prev - 1 + receipts.length) % receipts.length)
              }
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-white/15 flex items-center justify-center shadow-md z-10"
              title="Comprovante anterior"
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
          )}

          <img
            src={currentReceiptUrl}
            alt={`Comprovante de Pagamento ${activeIndex + 1}`}
            className="max-w-full max-h-[58vh] object-contain rounded-xl"
          />

          {receipts.length > 1 && (
            <button
              type="button"
              onClick={() => setActiveIndex((prev) => (prev + 1) % receipts.length)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-white/15 flex items-center justify-center shadow-md z-10"
              title="Próximo comprovante"
            >
              <ChevronRight size={20} strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 mt-4">
          {onViewDetails && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewDetails();
              }}
              className="w-full ds-btn-secondary h-11 text-body2"
            >
              Ver Detalhes do Racha
            </button>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 ds-btn-secondary"
            >
              Fechar
            </button>
            <button
              type="button"
              disabled={isSharing}
              onClick={handleShare}
              className="flex-1 ds-btn-primary"
            >
              {sharedFeedback ? (
                <>
                  <Check size={18} strokeWidth={2} />
                  <span>Compartilhado!</span>
                </>
              ) : isSharing ? (
                <>
                  <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Share2 size={18} strokeWidth={2} />
                  <span>Compartilhar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface PayWithReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  pixKey?: string;
  defaultAmount: number;
  allowCustomAmount?: boolean;
  description?: string;
  onConfirm: (amount: number, receiptBase64: string) => Promise<void>;
}

export function PayWithReceiptModal({
  isOpen,
  onClose,
  recipientName,
  pixKey = '',
  defaultAmount,
  allowCustomAmount = false,
  description = 'Acerto RachApp',
  onConfirm,
}: PayWithReceiptModalProps) {
  useModalBackHandler(isOpen, onClose);

  const [amountStr, setAmountStr] = useState('');
  const [receiptList, setReceiptList] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copiaECola, setCopiaECola] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const numericAmount = allowCustomAmount
    ? parseFloat(amountStr.replace(/\./g, '').replace(',', '.')) || 0
    : Number(defaultAmount || 0);

  useEffect(() => {
    if (isOpen) {
      setAmountStr(moneyConverter(defaultAmount));
      setReceiptList([]);
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen, defaultAmount]);

  useEffect(() => {
    if (isOpen && pixKey.trim() && numericAmount > 0) {
      const payload = generatePixCopiaECola({
        pixKey: pixKey.trim(),
        merchantName: recipientName || 'RachApp',
        amount: numericAmount,
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
  }, [isOpen, pixKey, recipientName, numericAmount, description]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) {
      setAmountStr('');
      return;
    }
    const cents = Number(digits) / 100;
    setAmountStr(
      cents.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setErrorMsg('');
    setIsCompressing(true);
    try {
      const compressedList: string[] = [];
      for (const file of files) {
        const compressed = await compressReceiptImage(file);
        compressedList.push(compressed);
      }
      setReceiptList((prev) => [...prev, ...compressedList]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao carregar imagem do comprovante.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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

  const handleSubmit = async () => {
    setErrorMsg('');
    if (numericAmount <= 0) {
      setErrorMsg('Informe um valor válido para o pagamento.');
      return;
    }
    const serialized = serializeReceiptUrls(receiptList);
    if (!serialized) {
      setErrorMsg('Anexe a foto/print do comprovante de pagamento para confirmar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(numericAmount, serialized);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.error || err?.message || 'Não foi possível registrar o pagamento.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 border border-[var(--border-color)] shadow-xl relative max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-[var(--border-color)] rounded-full mx-auto mb-4 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded-full hover:bg-[var(--bg-subtle)] transition-colors active:scale-95"
        >
          <X size={22} strokeWidth={2} />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
            <QrCode size={22} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[var(--text-primary)] text-h1 truncate">
              Pagar {recipientName.split(' ')[0]}
            </h3>
            <p className="text-body2 text-[var(--text-secondary)] truncate">
              Faça o Pix e anexe o comprovante para dar baixa
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-[var(--rose-bg)] border border-[var(--rose-border)] text-[#F43F5E] text-caption font-semibold p-3 rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* Valor do Pagamento */}
        <div className="bg-[var(--bg-subtle)] rounded-2xl p-4 text-center mb-4 border border-[var(--border-color)]">
          <p className="text-caption text-[var(--text-secondary)] uppercase font-semibold mb-1">
            Valor a Pagar
          </p>
          {allowCustomAmount ? (
            <div className="flex items-center justify-center gap-1">
              <span className="text-h2 font-bold text-[var(--primary)]">R$</span>
              <input
                type="tel"
                value={amountStr}
                onChange={handleAmountChange}
                className="bg-transparent text-display font-bold text-[var(--primary)] text-center w-40 outline-none border-b-2 border-[var(--primary)]/40 focus:border-[var(--primary)]"
              />
            </div>
          ) : (
            <p className="text-display font-bold text-[var(--primary)]">
              R$ {moneyConverter(numericAmount)}
            </p>
          )}
        </div>

        {/* Dados Pix do Credor */}
        {pixKey.trim() ? (
          <div className="mb-4 space-y-2.5">
            {qrCodeUrl && (
              <div className="flex flex-col items-center justify-center mb-2">
                <div className="bg-white p-3 rounded-2xl border border-[var(--border-color)] shadow-sm">
                  <img src={qrCodeUrl} alt="QR Code Pix" className="w-36 h-36" />
                </div>
              </div>
            )}

            <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="overflow-hidden">
                <p className="text-caption text-[var(--text-secondary)] uppercase font-semibold">
                  Chave Pix de {recipientName.split(' ')[0]}
                </p>
                <p className="text-body2 text-[var(--text-primary)] font-semibold truncate">
                  {pixKey}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyKey}
                className="bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 px-3 py-2 rounded-xl text-caption font-semibold flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedKey ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                {copiedKey ? 'Copiada!' : 'Copiar'}
              </button>
            </div>

            {copiaECola && (
              <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="overflow-hidden">
                  <p className="text-caption text-[var(--text-secondary)] uppercase font-semibold">
                    Pix Copia e Cola
                  </p>
                  <p className="text-caption text-[var(--text-primary)] font-mono truncate">
                    {copiaECola}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] px-3 py-2 rounded-xl text-caption font-semibold flex items-center gap-1 shrink-0 transition-colors"
                >
                  {copiedCode ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                  {copiedCode ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[var(--amber-bg)] border border-[var(--amber-border)] text-[#F59E0B] rounded-xl p-3 text-caption font-semibold text-center mb-4">
            {recipientName.split(' ')[0]} ainda não cadastrou chave Pix. Realize o pagamento e anexe o comprovante abaixo!
          </div>
        )}

        {/* Upload Obrigatório de Comprovante */}
        <div className="mb-5">
          <label className="block text-[var(--text-secondary)] text-caption uppercase font-semibold mb-2">
            Comprovante(s) de Pagamento <span className="text-[#F59E0B]">* Obrigatório</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {receiptList.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="w-full border-2 border-dashed border-[var(--primary)]/40 hover:border-[var(--primary)] bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              {isCompressing ? (
                <>
                  <LoaderCircle size={26} strokeWidth={2} className="animate-spin text-[var(--primary)]" />
                  <span className="text-caption text-[var(--text-secondary)] font-medium">
                    Processando imagem...
                  </span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center">
                    <Upload size={20} strokeWidth={2} />
                  </div>
                  <span className="text-body2 font-semibold text-[var(--text-primary)]">
                    Anexar Imagem do Comprovante
                  </span>
                  <span className="text-caption text-[var(--text-secondary)]">
                    Toque para escolher um ou mais prints de Pix
                  </span>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-2.5">
              {receiptList.map((url, idx) => (
                <div
                  key={idx}
                  className="bg-[var(--bg-subtle)] border border-[var(--emerald-border)] rounded-2xl p-3 relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption font-semibold text-[#10B981] flex items-center gap-1.5">
                      <ImageIcon size={14} strokeWidth={2} />{' '}
                      {receiptList.length > 1
                        ? `Comprovante ${idx + 1} de ${receiptList.length}`
                        : 'Comprovante anexado'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setReceiptList((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                      }
                      className="text-caption text-[#F43F5E] hover:opacity-80 flex items-center gap-1 font-semibold"
                    >
                      <Trash2 size={14} strokeWidth={2} /> Remover
                    </button>
                  </div>
                  <img
                    src={url}
                    alt={`Preview do Comprovante ${idx + 1}`}
                    className="w-full max-h-36 object-contain rounded-xl bg-slate-950"
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="w-full h-11 rounded-xl border border-dashed border-[var(--primary)]/40 hover:border-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15 text-[var(--primary)] text-caption font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {isCompressing ? (
                  <>
                    <LoaderCircle size={14} strokeWidth={2} className="animate-spin" />
                    <span>Adicionando comprovante...</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} strokeWidth={2} />
                    <span>Adicionar outro comprovante (Pix separado)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 ds-btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isCompressing || receiptList.length === 0}
            className="flex-1 ds-btn-primary"
          >
            {isSubmitting ? (
              <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />
            ) : (
              <>
                <Check size={18} strokeWidth={2} />
                Confirmar Pagamento
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
