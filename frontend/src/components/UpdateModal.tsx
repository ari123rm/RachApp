// src/components/UpdateModal.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Check,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useModalBackHandler } from '../utils/modalBackHandler';
import {
  triggerApkDownload,
  dismissUpdate,
  downloadAndStageOtaUpdate,
  applyOtaUpdateNow,
  type AppReleaseInfo,
} from '../services/updateService';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: AppReleaseInfo;
}

export function UpdateModal({ isOpen, onClose, updateInfo }: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [otaProgress, setOtaProgress] = useState<number>(0);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useModalBackHandler(isOpen, onClose);

  if (!isOpen) return null;

  const canUseOta = Capacitor.isNativePlatform() && Boolean(updateInfo.otaZipUrl);

  const handleOtaUpdate = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);
    setOtaProgress(0);
    setStatusMessage('Baixando pacote de atualização OTA em segundo plano...');
    try {
      const staged = await downloadAndStageOtaUpdate(updateInfo, (pct) => {
        setOtaProgress(pct);
      });
      if (staged) {
        setDownloadSuccess(true);
        setStatusMessage('Nova atualização pronta! Recarregando o aplicativo...');
        setTimeout(() => {
          applyOtaUpdateNow(staged);
        }, 1200);
      } else {
        setStatusMessage(
          'Não foi possível concluir o pacote OTA. Verifique sua conexão e tente novamente, ou baixe o APK abaixo.'
        );
        setIsDownloading(false);
      }
    } catch {
      setStatusMessage('Erro ao baixar a atualização OTA. Tente novamente.');
      setIsDownloading(false);
    }
  };

  const handleApkDownload = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      await triggerApkDownload(updateInfo.apkDownloadUrl);
      setDownloadSuccess(true);
      setStatusMessage(
        'Download do APK iniciado! Acompanhe o progresso na barra de notificações do seu celular.'
      );
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up relative border border-[var(--border-color)] shadow-lg overflow-hidden pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-[var(--border-color)] rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-full hover:bg-[var(--bg-subtle)] transition-colors z-10"
        >
          <X size={20} strokeWidth={2} />
        </button>

        {/* Ícone e Título */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center shrink-0">
            <Sparkles size={22} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-h1 text-[var(--text-primary)]">Nova Versão Disponível!</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Uma atualização do RachApp está pronta
            </p>
          </div>
        </div>

        {/* Comparação de Versões */}
        <div className="bg-[var(--bg-subtle)] p-3.5 rounded-2xl border border-[var(--border-color)] flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block">
              Sua Versão
            </span>
            <span className="text-sm font-display font-semibold text-[var(--text-primary)]">
              v{updateInfo.currentVersion}
            </span>
          </div>

          <div className="text-[var(--text-secondary)] px-2">
            <ArrowRight size={16} strokeWidth={2} />
          </div>

          <div className="text-center flex-1">
            <span className="text-xs text-[#0F766E] uppercase font-semibold block">
              Mais Recente
            </span>
            <span className="text-sm font-display font-bold text-[#0F766E]">
              {updateInfo.tagName}
            </span>
          </div>
        </div>

        {/* Informações da Versão */}
        <div className="mb-4 space-y-2.5">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Esta versão traz melhorias no desempenho, correções de bugs e aprimoramentos para o app.
          </p>

          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-subtle)] p-3 rounded-xl border border-[var(--border-color)]">
            <ShieldCheck size={16} strokeWidth={2} className="text-[#0F766E] shrink-0" />
            <span>
              {canUseOta
                ? 'Atualização OTA rápida e transparente sem precisar reinstalar o APK.'
                : 'Atualização opcional e segura. Seus dados e rachas não serão perdidos.'}
            </span>
          </div>
        </div>

        {isDownloading && canUseOta && otaProgress > 0 && otaProgress < 100 && (
          <div className="mb-4 space-y-1.5">
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>Baixando atualização OTA...</span>
              <span className="text-[#0F766E] font-bold">{otaProgress}%</span>
            </div>
            <div className="w-full h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0F766E] transition-all duration-200"
                style={{ width: `${otaProgress}%` }}
              />
            </div>
          </div>
        )}

        {downloadSuccess && (
          <div className="mb-4 bg-[#CCFBF1] text-[#0F766E] text-xs p-3 rounded-xl flex items-center gap-2 animate-fade-in">
            <Check size={16} strokeWidth={2} className="shrink-0" />
            <span>
              {statusMessage ||
                'Download iniciado! Acompanhe o progresso na barra de notificações do seu celular.'}
            </span>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="space-y-2.5">
          <button
            onClick={canUseOta ? handleOtaUpdate : handleApkDownload}
            disabled={isDownloading}
            className="w-full ds-btn-primary text-sm"
          >
            {isDownloading ? (
              <>
                <RefreshCw size={18} strokeWidth={2} className="animate-spin" />
                {canUseOta
                  ? otaProgress > 0
                    ? `Atualizando (${otaProgress}%)...`
                    : 'Preparando atualização...'
                  : 'Iniciando download...'}
              </>
            ) : canUseOta ? (
              <>
                <Zap size={18} strokeWidth={2} />
                Atualizar Agora (OTA Rápido)
              </>
            ) : (
              <>
                <Download size={18} strokeWidth={2} />
                Baixar e Atualizar APK
              </>
            )}
          </button>

          {canUseOta && updateInfo.apkDownloadUrl && (
            <button
              onClick={handleApkDownload}
              disabled={isDownloading}
              className="w-full ds-btn-secondary text-xs"
            >
              <Download size={15} strokeWidth={2} />
              Baixar instalador APK completo
            </button>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={handleDismiss}
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1.5 rounded-lg transition-colors"
            >
              Lembrar mais tarde
            </button>

            {updateInfo.htmlUrl && (
              <a
                href={updateInfo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1 px-3 py-1.5"
              >
                <span>Ver no GitHub</span>
                <ExternalLink size={12} strokeWidth={2} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
