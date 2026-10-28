import { createPortal } from 'react-dom';
// src/components/ReceiptModals.tsx
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
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] w-full max-w-md rounded-3xl p-5 border border-white/10 shadow-2xl relative max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center shrink-0">
              <FileCheck2 size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-base truncate">{title}</h3>
              {receipts.length > 1 && (
                <p className="text-[11px] text-[#2DD4BF] font-semibold">
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
              className="p-2 text-gray-400 hover:text-[#2DD4BF] rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <Share2 size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Seletor de Comprovantes quando há mais de 1 */}
        {receipts.length > 1 && (
          <div className="mb-3">
            <p className="text-[11px] text-gray-400 font-semibold mb-1.5">
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-[#2DD4BF] text-[#05080f] shadow-md shadow-teal-500/20'
                        : 'bg-[#2c2c2e] text-gray-300 hover:text-white border border-white/10'
                    }`}
                  >
                    <FileCheck2 size={13} />
                    Comprovante {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-[#05080f] rounded-2xl p-2 border border-white/5 flex items-center justify-center min-h-[240px] relative">
          {receipts.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setActiveIndex((prev) => (prev - 1 + receipts.length) % receipts.length)
              }
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/15 flex items-center justify-center shadow-lg z-10"
              title="Comprovante anterior"
            >
              <ChevronLeft size={20} />
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/15 flex items-center justify-center shadow-lg z-10"
              title="Próximo comprovante"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-4">
          {onViewDetails && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewDetails();
              }}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold py-2.5 rounded-xl transition-colors text-xs"
            >
              Ver Detalhes do Racha
            </button>
          )}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-gray-300 font-bold py-3 rounded-xl transition-colors text-sm"
            >
              Fechar
            </button>
            <button
              type="button"
              disabled={isSharing}
              onClick={handleShare}
              className="flex-1 bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 disabled:opacity-50"
            >
              {sharedFeedback ? (
                <>
                  <Check size={18} />
                  <span>Compartilhado!</span>
                </>
              ) : isSharing ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Share2 size={18} />
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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[75] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={22} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center shrink-0">
            <QrCode size={22} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Pagar {recipientName.split(' ')[0]}</h3>
            <p className="text-xs text-gray-400">
              Faça o Pix e anexe o comprovante para dar baixa
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium p-3 rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* Valor do Pagamento */}
        <div className="bg-[#05080f] rounded-2xl p-4 text-center mb-4 border border-white/5">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Valor a Pagar</p>
          {allowCustomAmount ? (
            <div className="flex items-center justify-center gap-1">
              <span className="text-xl font-bold text-[#2DD4BF]">R$</span>
              <input
                type="tel"
                value={amountStr}
                onChange={handleAmountChange}
                className="bg-transparent text-3xl font-black text-[#2DD4BF] text-center w-40 outline-none border-b border-[#2DD4BF]/40 focus:border-[#2DD4BF]"
              />
            </div>
          ) : (
            <p className="text-3xl font-black text-[#2DD4BF]">
              R$ {moneyConverter(numericAmount)}
            </p>
          )}
        </div>

        {/* Dados Pix do Credor */}
        {pixKey.trim() ? (
          <div className="mb-4 space-y-2.5">
            {qrCodeUrl && (
              <div className="flex flex-col items-center justify-center mb-2">
                <div className="bg-white p-2.5 rounded-2xl shadow-md">
                  <img src={qrCodeUrl} alt="QR Code Pix" className="w-36 h-36" />
                </div>
              </div>
            )}

            <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="overflow-hidden">
                <p className="text-[10px] text-gray-400 uppercase font-bold">
                  Chave Pix de {recipientName.split(' ')[0]}
                </p>
                <p className="text-xs text-white font-medium truncate">{pixKey}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyKey}
                className="bg-[#2DD4BF]/20 text-[#2DD4BF] hover:bg-[#2DD4BF]/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
              >
                {copiedKey ? <Check size={13} /> : <Copy size={13} />}
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
                  type="button"
                  onClick={handleCopyCode}
                  className="bg-[#2DD4BF] text-[#05080f] hover:bg-[#25b5a3] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                  {copiedCode ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-3 text-xs text-center mb-4">
            {recipientName.split(' ')[0]} ainda não cadastrou chave Pix. Realize o pagamento e anexe o comprovante abaixo!
          </div>
        )}

        {/* Upload Obrigatório de Comprovante */}
        <div className="mb-5">
          <label className="block text-gray-300 text-xs uppercase font-bold mb-2">
            Comprovante(s) de Pagamento <span className="text-amber-400">* Obrigatório</span>
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
              className="w-full border-2 border-dashed border-[#2DD4BF]/40 hover:border-[#2DD4BF] bg-[#2DD4BF]/5 hover:bg-[#2DD4BF]/10 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              {isCompressing ? (
                <>
                  <LoaderCircle size={26} className="animate-spin text-[#2DD4BF]" />
                  <span className="text-xs text-gray-300 font-medium">
                    Processando imagem...
                  </span>
                </>
              ) : (
                <>
                  <div className="w-11 h-11 rounded-full bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center">
                    <Upload size={20} />
                  </div>
                  <span className="text-sm font-bold text-white">
                    Anexar Imagem do Comprovante
                  </span>
                  <span className="text-[11px] text-gray-400">
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
                  className="bg-[#05080f] border border-[#2DD4BF]/40 rounded-2xl p-3 relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#34C759] flex items-center gap-1.5">
                      <ImageIcon size={14} />{' '}
                      {receiptList.length > 1
                        ? `Comprovante ${idx + 1} de ${receiptList.length}`
                        : 'Comprovante anexado'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setReceiptList((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                      }
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  </div>
                  <img
                    src={url}
                    alt={`Preview do Comprovante ${idx + 1}`}
                    className="w-full max-h-36 object-contain rounded-xl bg-black/40"
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="w-full py-2.5 rounded-xl border border-dashed border-[#2DD4BF]/40 hover:border-[#2DD4BF] bg-[#2DD4BF]/10 hover:bg-[#2DD4BF]/15 text-[#2DD4BF] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                {isCompressing ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    <span>Adicionando comprovante...</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
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
            className="flex-1 bg-transparent border border-white/10 text-white font-bold py-3.5 rounded-xl hover:bg-white/5 transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isCompressing || receiptList.length === 0}
            className="flex-1 bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3.5 px-4 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm"
          >
            {isSubmitting ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <>
                <Check size={17} strokeWidth={2.5} />
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
