// src/components/UpdateModal.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Sparkles, ArrowRight, ExternalLink, ShieldCheck, Check, RefreshCw } from 'lucide-react';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { triggerApkDownload, dismissUpdate, type AppReleaseInfo } from '../services/updateService';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: AppReleaseInfo;
}

export function UpdateModal({ isOpen, onClose, updateInfo }: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useModalBackHandler(isOpen, onClose);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      await triggerApkDownload(updateInfo.apkDownloadUrl);
      setDownloadSuccess(true);
    } catch {
      alert('Erro ao iniciar o download do APK.');
    } finally {
      setTimeout(() => setIsDownloading(false), 2500);
    }
  };

  const handleDismiss = () => {
    dismissUpdate(updateInfo.version);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] w-full max-w-md rounded-3xl p-6 animate-slide-up relative border border-[#2DD4BF]/30 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow suave no topo */}
        <div className="absolute -top-14 -right-14 w-32 h-32 bg-[#2DD4BF]/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors z-10"
        >
          <X size={22} />
        </button>

        {/* Ícone e Título */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#2DD4BF]/15 text-[#2DD4BF] flex items-center justify-center shrink-0 border border-[#2DD4BF]/30">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Nova Versão Disponível!</h2>
            <p className="text-xs text-gray-400">Uma atualização do RachApp está pronta</p>
          </div>
        </div>

        {/* Comparação de Versões */}
        <div className="bg-[#2c2c2e] p-3 rounded-2xl border border-white/5 flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <span className="text-[10px] text-gray-500 uppercase font-bold block">Sua Versão</span>
            <span className="text-sm font-semibold text-gray-300">v{updateInfo.currentVersion}</span>
          </div>

          <div className="text-gray-500 px-2">
            <ArrowRight size={16} />
          </div>

          <div className="text-center flex-1">
            <span className="text-[10px] text-[#2DD4BF] uppercase font-bold block">Mais Recente</span>
            <span className="text-sm font-bold text-[#2DD4BF]">{updateInfo.tagName}</span>
          </div>
        </div>

        {/* Informações da Versão */}
        <div className="mb-4 space-y-2.5">
          <p className="text-xs text-gray-300 leading-relaxed">
            Esta versão traz melhorias no desempenho, correções de bugs e aprimoramentos para o app.
          </p>

          <div className="flex items-center gap-2 text-[11px] text-gray-400 bg-white/5 p-2.5 rounded-xl border border-white/5">
            <ShieldCheck size={16} className="text-[#2DD4BF] shrink-0" />
            <span>Atualização opcional e segura. Seus dados e rachas não serão perdidos.</span>
          </div>
        </div>

        {downloadSuccess && (
          <div className="mb-4 bg-[#2DD4BF]/15 border border-[#2DD4BF]/30 text-[#2DD4BF] text-xs p-3 rounded-2xl flex items-center gap-2 animate-fade-in">
            <Check size={16} className="shrink-0" />
            <span>Download iniciado! Acompanhe o progresso na barra de notificações do seu celular.</span>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="space-y-2.5">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#2DD4BF]/10 disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Iniciando download...
              </>
            ) : (
              <>
                <Download size={18} />
                Baixar e Atualizar APK
              </>
            )}
          </button>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={handleDismiss}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Lembrar mais tarde
            </button>

            {updateInfo.htmlUrl && (
              <a
                href={updateInfo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#2DD4BF] hover:underline flex items-center gap-1 px-3 py-1.5"
              >
                <span>Ver no GitHub</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
