// src/components/PixModal.tsx
import { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode, Share2 } from 'lucide-react';
import { generatePixCopiaECola, generatePixQRCodeDataUrl } from '../utils/pixGenerator';
import moneyConverter from '../utils/moneyConverter';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixKey: string;
  recipientName: string;
  amount: number;
  description?: string;
  whatsappPhone?: string;
  whatsappCustomMessage?: string;
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
}: PixModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copiaECola, setCopiaECola] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (isOpen && pixKey) {
      const payload = generatePixCopiaECola({
        pixKey,
        merchantName: recipientName || 'RachApp',
        amount: amount > 0 ? amount : undefined,
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
  }, [isOpen, pixKey, recipientName, amount, description]);

  if (!isOpen) return null;

  const handleCopyKey = async () => {
    if (!pixKey) return;
    await navigator.clipboard.writeText(pixKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyCode = async () => {
    if (!copiaECola) return;
    await navigator.clipboard.writeText(copiaECola);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const cleanDigits = whatsappPhone ? whatsappPhone.replace(/\D/g, '') : '';
    const normDigits =
      (cleanDigits.length === 12 || cleanDigits.length === 13) && cleanDigits.startsWith('55')
        ? cleanDigits
        : cleanDigits
        ? `55${cleanDigits}`
        : '';

    const defaultMsg =
      whatsappCustomMessage ||
      `Olá! Segue o resumo do acerto pelo RachApp:\nValor: R$ ${moneyConverter(amount)}\nChave Pix (${recipientName}): ${pixKey}${
        copiaECola ? `\n\nPix Copia e Cola:\n${copiaECola}` : ''
      }`;
    const encoded = encodeURIComponent(defaultMsg);
    if (normDigits) {
      window.open(`https://wa.me/${normDigits}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1c1c1e] w-full max-w-sm rounded-3xl p-6 border border-white/10 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center">
            <QrCode size={22} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Pagamento via Pix</h3>
            <p className="text-xs text-gray-400">Recebedor: {recipientName}</p>
          </div>
        </div>

        <div className="bg-[#05080f] rounded-2xl p-4 text-center mb-4 border border-white/5">
          <p className="text-xs text-gray-400 uppercase font-semibold">Valor do Acerto</p>
          <p className="text-3xl font-black text-[#2DD4BF] mt-1">
            R$ {moneyConverter(amount)}
          </p>
        </div>

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
                    {copiedCode ? 'Copiado!' : 'Copia e Cola'}
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
          Enviar Cobrança no WhatsApp
        </button>
      </div>
    </div>
  );
}
