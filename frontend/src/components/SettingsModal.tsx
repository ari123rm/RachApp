// src/components/SettingsModal.tsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Sparkles,
  Download,
  Lock,
  CloudCheck,
  RefreshCw,
  ChevronRight,
  Check,
  Palette,
  Sun,
  Moon,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { dbService } from '../services/database';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { SCALAR_THEMES, useTheme } from '../utils/theme';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import type { SyncStatus } from '../types';
import {
  getCurrentAppVersion,
  checkAppUpdate,
  triggerApkDownload,
  downloadAndStageOtaUpdate,
  applyOtaUpdateNow,
  type AppReleaseInfo,
} from '../services/updateService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  updateInfo?: AppReleaseInfo | null;
  onOpenUpdateModal?: () => void;
  onUpdateDetected?: (info: AppReleaseInfo) => void;
  onOpenPasswordScreen: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  syncStatus,
  updateInfo,
  onOpenUpdateModal,
  onUpdateDetected,
  onOpenPasswordScreen,
}: SettingsModalProps) {
  const { preset: currentPreset } = useTheme();
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');
  const [manualUpdateInfo, setManualUpdateInfo] = useState<AppReleaseInfo | null>(
    updateInfo || null
  );
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');
  const [checkFeedback, setCheckFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useModalBackHandler(isOpen && !isThemeModalOpen, onClose);

  useEffect(() => {
    if (updateInfo) {
      setManualUpdateInfo(updateInfo);
    }
  }, [updateInfo]);

  useEffect(() => {
    if (isOpen) {
      getCurrentAppVersion()
        .then((v) => setCurrentVersion(v))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeUpdate = manualUpdateInfo?.isNewer
    ? manualUpdateInfo
    : updateInfo?.isNewer
    ? updateInfo
    : null;

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await dbService.sync.now();
    } catch {
      // Silencioso
    } finally {
      setTimeout(() => setIsManualSyncing(false), 600);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setCheckFeedback(null);
    try {
      const info = await checkAppUpdate(true);
      setManualUpdateInfo(info);
      if (info?.isNewer) {
        onUpdateDetected?.(info);
      } else {
        setCheckFeedback({
          type: 'success',
          text: 'Tudo certo! Você já está usando a versão mais recente do RachApp.',
        });
      }
    } catch {
      setCheckFeedback({
        type: 'error',
        text: 'Não foi possível verificar atualizações agora. Verifique sua conexão.',
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleStartUpdate = async () => {
    if (!activeUpdate) return;

    setIsDownloadingApk(true);
    setDownloadMsg('');
    try {
      if (Capacitor.isNativePlatform() && activeUpdate.otaZipUrl) {
        setDownloadMsg('Baixando pacote OTA em segundo plano...');
        const staged = await downloadAndStageOtaUpdate(activeUpdate, (pct) => {
          setDownloadMsg(`Baixando atualização OTA (${pct}%)...`);
        });
        if (staged) {
          setDownloadMsg('Nova atualização pronta! O app será recarregado em 3 segundos...');
          setTimeout(() => {
            applyOtaUpdateNow(staged);
          }, 3000);
          return;
        }
        setDownloadMsg(
          'Não foi possível concluir o download OTA. Toque em "Ver Detalhes" para baixar o instalador APK.'
        );
        return;
      }

      if (activeUpdate.apkDownloadUrl) {
        await triggerApkDownload(activeUpdate.apkDownloadUrl);
        setDownloadMsg('Download iniciado! Verifique a barra de notificações do seu celular.');
      }
    } catch {
      setDownloadMsg('Não foi possível iniciar a atualização automaticamente.');
    } finally {
      setTimeout(() => setIsDownloadingApk(false), 2500);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[75] bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col overflow-hidden animate-fade-in">
        {/* Cabeçalho Fixo da Tela de Configurações */}
        <header className="bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-color)] px-4 sm:px-6 pt-[max(2.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-3.5 shrink-0">
          <div className="max-w-lg md:max-w-xl lg:max-w-2xl mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--primary)] flex items-center justify-center transition-all active:scale-95 shrink-0"
              title="Voltar para o Perfil"
            >
              <ChevronLeft size={20} strokeWidth={2.2} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-display font-bold text-[var(--text-primary)] truncate">
                Configurações
              </h1>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                Temas, sincronização, segurança e atualizações
              </p>
            </div>
          </div>
        </header>

        {/* Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] max-w-lg md:max-w-xl lg:max-w-2xl w-full mx-auto space-y-4 scrollbar-hide">
          {/* 1. Temas & Aparência (Abre tela dedicada de Temas) */}
          <section className="ds-card p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setIsThemeModalOpen(true)}
              className="w-full flex items-center justify-between gap-3 text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
                  <Palette size={19} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-display font-semibold text-[var(--text-primary)] truncate">
                      Temas & Aparência
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)] shrink-0">
                      {currentPreset.isDark ? <Moon size={10} /> : <Sun size={10} />}
                      <span>{currentPreset.name}</span>
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                    {SCALAR_THEMES.length} temas claros e escuros disponíveis
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex items-center -space-x-1.5">
                  <span
                    className="w-5 h-5 rounded-full border-2 border-[var(--bg-surface)] shadow-xs"
                    style={{ backgroundColor: currentPreset.preview.bg }}
                  />
                  <span
                    className="w-5 h-5 rounded-full border-2 border-[var(--bg-surface)] shadow-xs"
                    style={{ backgroundColor: currentPreset.preview.surface }}
                  />
                  <span
                    className="w-5 h-5 rounded-full border-2 border-[var(--bg-surface)] shadow-xs"
                    style={{ backgroundColor: currentPreset.preview.accent }}
                  />
                </div>
                <ChevronRight
                  size={20}
                  strokeWidth={2}
                  className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors"
                />
              </div>
            </button>
          </section>

        {/* 2. Sincronização na Nuvem */}
        <section className="ds-card p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
                <CloudCheck size={19} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-display font-semibold text-[var(--text-primary)] truncate">
                  Sincronização
                </h2>
                <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                  Backup automático na nuvem
                </p>
              </div>
            </div>

            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold border shrink-0 whitespace-nowrap ${
                syncStatus.state === 'synced'
                  ? 'bg-[var(--emerald-bg)] text-[#10B981] border-[var(--emerald-border)]'
                  : syncStatus.state === 'syncing' || isManualSyncing
                  ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/20'
                  : 'bg-[var(--amber-bg)] text-[#F59E0B] border-[var(--amber-border)]'
              }`}
            >
              {syncStatus.state === 'syncing' || isManualSyncing
                ? 'Sincronizando...'
                : syncStatus.state === 'synced'
                ? 'Atualizado'
                : `Pendente (${syncStatus.pendingCount})`}
            </span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Seus rachas, amigos e grupos ficam salvos no aparelho e sincronizados automaticamente.
          </p>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isManualSyncing || syncStatus.state === 'syncing'}
            className="w-full ds-btn-secondary text-xs h-11"
          >
            <RefreshCw
              size={15}
              strokeWidth={2}
              className={
                isManualSyncing || syncStatus.state === 'syncing' ? 'animate-spin' : ''
              }
            />
            <span>
              {isManualSyncing || syncStatus.state === 'syncing'
                ? 'Sincronizando dados...'
                : 'Sincronizar Agora'}
            </span>
          </button>
        </section>

        {/* 3. Segurança */}
        <section className="ds-card p-4 sm:p-5">
          <button
            type="button"
            onClick={onOpenPasswordScreen}
            className="w-full flex items-center justify-between gap-3 text-left group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
                <Lock size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-display font-semibold text-[var(--text-primary)] truncate">
                  Alterar ou Redefinir Senha
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                  Troque sua senha atual ou recupere o acesso
                </p>
              </div>
            </div>
            <ChevronRight
              size={20}
              strokeWidth={2}
              className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors shrink-0"
            />
          </button>
        </section>

        {/* 4. Versão e Atualizações do Aplicativo */}
        <section className="ds-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
                <Sparkles size={19} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-display font-semibold text-[var(--text-primary)] truncate">
                  Versão do Aplicativo
                </h2>
                <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                  {currentVersion ? `Versão instalada: v${currentVersion}` : 'RachApp Oficial'}
                </p>
              </div>
            </div>

            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold border shrink-0 whitespace-nowrap ${
                activeUpdate
                  ? 'bg-[var(--amber-bg)] text-[#F59E0B] border-[var(--amber-border)]'
                  : 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/20'
              }`}
            >
              {activeUpdate ? 'Nova versão' : 'Mais recente'}
            </span>
          </div>

          {activeUpdate ? (
            <div className="bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--amber-border)] space-y-3">
              <div>
                <p className="text-sm font-display font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse shrink-0" />
                  <span>Atualização disponível ({activeUpdate.tagName})</span>
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {activeUpdate.otaZipUrl && Capacitor.isNativePlatform()
                    ? 'Atualize instantaneamente via OTA sem precisar reinstalar o aplicativo.'
                    : 'Baixe a nova versão do instalador APK sem perder nenhum dado.'}
                </p>
              </div>

              {downloadMsg && (
                <div className="bg-[var(--primary-light)] text-[var(--primary)] text-xs p-3 rounded-xl flex items-center gap-2 animate-fade-in">
                  <Check size={15} strokeWidth={2} className="shrink-0" />
                  <span>{downloadMsg}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleStartUpdate}
                  disabled={isDownloadingApk}
                  className="flex-1 ds-btn-primary text-xs h-11"
                >
                  {isDownloadingApk ? (
                    <>
                      <RefreshCw size={15} strokeWidth={2} className="animate-spin" />
                      <span>Atualizando...</span>
                    </>
                  ) : (
                    <>
                      <Download size={15} strokeWidth={2} />
                      <span>
                        {activeUpdate.otaZipUrl && Capacitor.isNativePlatform()
                          ? 'Atualizar Agora (OTA)'
                          : 'Baixar e Atualizar APK'}
                      </span>
                    </>
                  )}
                </button>

                {onOpenUpdateModal && (
                  <button
                    type="button"
                    onClick={() => onOpenUpdateModal()}
                    className="h-11 bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--primary)] text-[var(--text-primary)] font-semibold px-4 rounded-xl text-xs transition-colors shrink-0 flex items-center justify-center"
                  >
                    Ver Detalhes
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {checkFeedback && (
                <div
                  className={`text-xs p-3 rounded-xl flex items-center gap-2 border ${
                    checkFeedback.type === 'success'
                      ? 'bg-[var(--emerald-bg)] text-[#10B981] border-[var(--emerald-border)]'
                      : 'bg-[var(--rose-bg)] text-[#F43F5E] border-[var(--rose-border)]'
                  }`}
                >
                  <Check size={15} strokeWidth={2} className="shrink-0" />
                  <span>{checkFeedback.text}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate}
                className="w-full ds-btn-secondary text-xs h-11"
              >
                <RefreshCw
                  size={15}
                  strokeWidth={2}
                  className={isCheckingUpdate ? 'animate-spin' : ''}
                />
                <span>
                  {isCheckingUpdate ? 'Verificando atualizações...' : 'Verificar Atualizações'}
                </span>
              </button>
            </div>
          )}
        </section>
      </div>
      </div>

      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />
    </>,
    document.body
  );
}
