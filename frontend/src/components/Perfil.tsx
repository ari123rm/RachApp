// src/components/Perfil.tsx
import { useState, useEffect } from 'react';
import {
  User,
  Sparkles,
  Download,
  QrCode,
  Lock,
  Trash2,
  Save,
  LoaderCircle,
  ShieldCheck,
  Phone,
  CloudCheck,
  RefreshCw,
  ChevronRight,
  Check,
  Pencil,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { dbService } from '../services/database';
import { PixModal } from './PixModal';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { formatPhoneBR, isValidPhoneBR } from '../utils/phoneFormatter';
import { AvatarEditModal } from './AvatarEditModal';
import { useTheme } from '../utils/theme';
import type { SyncStatus } from '../types';
import {
  getCurrentAppVersion,
  checkAppUpdate,
  triggerApkDownload,
  downloadAndStageOtaUpdate,
  applyOtaUpdateNow,
  type AppReleaseInfo,
} from '../services/updateService';

interface PerfilProps {
  dataVersion?: number;
  onDataChange: () => void;
  onProfileChange?: () => void;
  updateInfo?: AppReleaseInfo | null;
  onOpenUpdateModal?: () => void;
  onUpdateDetected?: (info: AppReleaseInfo) => void;
}

export function Perfil({
  dataVersion,
  onDataChange,
  onProfileChange,
  updateInfo,
  onOpenUpdateModal,
  onUpdateDetected,
}: PerfilProps) {
  const { theme, setTheme } = useTheme();
  const [currentVersion, setCurrentVersion] = useState('');
  const [manualUpdateInfo, setManualUpdateInfo] = useState<AppReleaseInfo | null>(updateInfo || null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [pix, setPix] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [savedDados, setSavedDados] = useState({ nome: '', telefone: '', pix: '' });
  const [isEditingDados, setIsEditingDados] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isPixPreviewOpen, setIsPixPreviewOpen] = useState(false);
  const [testPixAmount, setTestPixAmount] = useState(10);
  const [isPasswordScreenOpen, setIsPasswordScreenOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: null,
  });

  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        getCurrentAppVersion().then((v) => setCurrentVersion(v)).catch(() => {});
        const user = await dbService.settings.get();
        const loadedNome = user.name || user.nome || '';
        const loadedTel = formatPhoneBR(user.phone || user.telefone || '');
        const loadedPix = user.pix_key || user.pix || '';

        setNome(loadedNome);
        setTelefone(loadedTel);
        setEmail(user.email || '');
        setPix(loadedPix);
        setAvatarUrl(user.avatar_url || null);
        setSavedDados({ nome: loadedNome, telefone: loadedTel, pix: loadedPix });
      } finally {
        setIsLoading(false);
      }
    };
    carregarPerfil();

    const unsub = dbService.sync.subscribe((st) => setSyncStatus(st));
    return () => unsub();
  }, [dataVersion]);

  const handleSaveAvatar = async (croppedDataUrl: string) => {
    setIsSavingPhoto(true);
    try {
      setAvatarUrl(croppedDataUrl);
      await dbService.auth.updateProfile({ avatar_url: croppedDataUrl });
      onProfileChange?.();
    } catch {
      alert('Erro ao salvar foto de perfil.');
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleDeleteAvatar = async () => {
    setIsSavingPhoto(true);
    try {
      setAvatarUrl(null);
      await dbService.auth.updateProfile({ avatar_url: null });
      onProfileChange?.();
    } catch {
      alert('Erro ao remover foto de perfil.');
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleToggleEditDados = () => {
    if (isEditingDados) {
      setNome(savedDados.nome);
      setTelefone(savedDados.telefone);
      setPix(savedDados.pix);
      setIsEditingDados(false);
    } else {
      setIsEditingDados(true);
    }
  };

  const handleSalvarPerfil = async () => {
    if (!nome.trim()) return alert('O nome não pode ficar vazio.');
    if (telefone.trim() && !isValidPhoneBR(telefone)) {
      return alert('Informe um WhatsApp válido com DDD (ex: (85) 99999-8888).');
    }

    setIsSavingProfile(true);
    try {
      const formattedPhone = formatPhoneBR(telefone);
      await dbService.auth.updateProfile({
        name: nome.trim(),
        phone: formattedPhone,
        pix_key: pix.trim(),
      });
      setSavedDados({
        nome: nome.trim(),
        telefone: formattedPhone,
        pix: pix.trim(),
      });
      setIsEditingDados(false);
      onProfileChange?.();
      alert('Dados do perfil atualizados com sucesso!');
    } catch {
      alert('Erro ao atualizar perfil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSairApp = async () => {
    if (window.confirm('Deseja sair da sua conta?')) {
      await dbService.auth.logout();
      onDataChange();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoaderCircle size={40} strokeWidth={2} className="animate-spin text-[#0F766E]" />
      </div>
    );
  }

  const userInitial = (nome || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho com Foto de Perfil Grande Centralizada (Circular) e Nome */}
      <div className="flex flex-col items-center pt-4 pb-2">
        <div className="relative">
          <div
            onClick={() => setIsAvatarModalOpen(true)}
            className="w-24 h-24 rounded-full overflow-hidden bg-[var(--bg-surface)] border-2 border-[#0F766E]/30 hover:border-[#0F766E] shadow-md flex items-center justify-center cursor-pointer relative group transition-colors"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={nome || 'Foto de Perfil'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#CCFBF1] flex items-center justify-center text-[#0F766E] text-3xl font-display font-bold select-none">
                {userInitial}
              </div>
            )}

            {isSavingPhoto && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <LoaderCircle size={24} strokeWidth={2} className="animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Botão de editar foto */}
          <button
            type="button"
            onClick={() => setIsAvatarModalOpen(true)}
            title="Editar foto de perfil"
            className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#0F766E] hover:bg-[#115E59] text-white shadow-md flex items-center justify-center border-2 border-[var(--bg-app)] transition-transform active:scale-90"
          >
            <Pencil size={14} strokeWidth={2} />
          </button>
        </div>

        <h1 className="text-h1 text-[var(--text-primary)] mt-3 text-center break-words max-w-xs">
          {nome || 'Seu Perfil'}
        </h1>
        {email && <p className="text-caption text-[var(--text-secondary)] mt-1">{email}</p>}
      </div>

      {/* Aparência do App (Modo Claro Padrão / Modo Escuro) */}
      <section className="ds-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-h2 text-[var(--text-primary)]">Aparência</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Escolha entre o tema claro padrão ou escuro
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`h-12 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              theme === 'light'
                ? 'bg-[#CCFBF1] text-[#0F766E] border-[#0F766E]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sun size={18} strokeWidth={2} />
            <span>Modo Claro</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`h-12 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              theme === 'dark'
                ? 'bg-[#0F766E] text-white border-[#0F766E]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Moon size={18} strokeWidth={2} />
            <span>Modo Escuro</span>
          </button>
        </div>
      </section>

      {/* Dados Públicos e Chave Pix */}
      <section className="ds-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h2 text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck size={20} strokeWidth={2} className="text-[#0F766E] shrink-0" />
            Dados Públicos e Pix
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {pix && (
              <button
                type="button"
                onClick={() => setIsPixPreviewOpen(true)}
                className="text-xs bg-[#CCFBF1] text-[#0F766E] hover:opacity-90 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5"
              >
                <QrCode size={14} strokeWidth={2} />
                <span className="hidden xs:inline">Testar QR Pix</span>
                <span className="xs:hidden">QR Pix</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleEditDados}
              title={isEditingDados ? 'Cancelar edição' : 'Editar dados públicos'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors border ${
                isEditingDados
                  ? 'bg-[#0F766E] text-white border-[#0F766E]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              {isEditingDados ? <X size={16} strokeWidth={2} /> : <Pencil size={15} strokeWidth={2} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[var(--text-secondary)] text-xs mb-1.5 uppercase font-semibold tracking-wider">
            Seu Nome
          </label>
          <div
            className={`h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border transition-all ${
              isEditingDados
                ? 'border-[#0F766E] ring-2 ring-[#0F766E]/15 bg-[var(--bg-surface)]'
                : 'border-[var(--border-color)] opacity-80'
            }`}
          >
            <User size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
            <input
              type="text"
              value={nome}
              disabled={!isEditingDados}
              readOnly={!isEditingDados}
              onChange={(e) => setNome(e.target.value)}
              className="bg-transparent w-full outline-none text-[var(--text-primary)] text-sm disabled:cursor-default"
            />
          </div>
        </div>

        <div>
          <label className="block text-[var(--text-secondary)] text-xs mb-1.5 uppercase font-semibold tracking-wider">
            Seu WhatsApp (com DDD)
          </label>
          <div
            className={`h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border transition-all ${
              isEditingDados
                ? 'border-[#0F766E] ring-2 ring-[#0F766E]/15 bg-[var(--bg-surface)]'
                : 'border-[var(--border-color)] opacity-80'
            }`}
          >
            <Phone size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
            <input
              type="tel"
              value={telefone}
              disabled={!isEditingDados}
              readOnly={!isEditingDados}
              onChange={(e) => setTelefone(formatPhoneBR(e.target.value))}
              placeholder="(85) 99999-8888"
              className="bg-transparent w-full outline-none text-[var(--text-primary)] text-sm disabled:cursor-default"
            />
          </div>
        </div>

        <div>
          <label className="block text-[var(--text-secondary)] text-xs mb-1.5 uppercase font-semibold tracking-wider">
            Sua Chave Pix Principal
          </label>
          <div
            className={`h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border transition-all ${
              isEditingDados
                ? 'border-[#0F766E] ring-2 ring-[#0F766E]/15 bg-[var(--bg-surface)]'
                : 'border-[var(--border-color)] opacity-80'
            }`}
          >
            <QrCode size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
            <input
              type="text"
              value={pix}
              disabled={!isEditingDados}
              readOnly={!isEditingDados}
              onChange={(e) => setPix(e.target.value)}
              placeholder="CPF, E-mail, Celular ou Chave Aleatória"
              className="bg-transparent w-full outline-none text-[var(--text-primary)] text-sm disabled:cursor-default"
            />
          </div>
        </div>

        {isEditingDados && (
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleToggleEditDados}
              disabled={isSavingProfile}
              className="flex-1 h-12 bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarPerfil}
              disabled={isSavingProfile}
              className="flex-[2] ds-btn-primary"
            >
              {isSavingProfile ? (
                <LoaderCircle className="animate-spin" size={18} strokeWidth={2} />
              ) : (
                <Save size={18} strokeWidth={2} />
              )}
              <span>Salvar Dados</span>
            </button>
          </div>
        )}
      </section>

      {/* Status de Sincronização na Nuvem */}
      <section className="ds-card p-5 space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-h2 text-[var(--text-primary)] flex items-center gap-2">
            <CloudCheck size={20} strokeWidth={2} className="text-[#0F766E]" />
            Sincronização da Conta
          </h2>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              syncStatus.state === 'synced'
                ? 'bg-[var(--emerald-bg)] text-[#10B981] border-[var(--emerald-border)]'
                : syncStatus.state === 'syncing'
                ? 'bg-[#CCFBF1] text-[#0F766E] border-[#0F766E]/20'
                : 'bg-[var(--amber-bg)] text-[#F59E0B] border-[var(--amber-border)]'
            }`}
          >
            {syncStatus.state === 'synced'
              ? 'Atualizado'
              : syncStatus.state === 'syncing'
              ? 'Sincronizando...'
              : `Pendente (${syncStatus.pendingCount})`}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Seus rachas, amigos e grupos ficam salvos no aparelho e sincronizados automaticamente. Para atualizar manualmente, basta puxar a tela para baixo no topo.
        </p>
      </section>

      {/* Segurança */}
      <section className="ds-card p-5">
        <button
          onClick={() => setIsPasswordScreenOpen(true)}
          className="w-full flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center shrink-0">
              <Lock size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-h2 text-[var(--text-primary)]">Alterar ou Redefinir Senha</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Abra a tela exclusiva para trocar ou recuperar sua senha
              </p>
            </div>
          </div>
          <ChevronRight
            size={20}
            strokeWidth={2}
            className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors"
          />
        </button>
      </section>

      {/* Versão e Atualizações do Aplicativo */}
      <section className="ds-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center shrink-0">
              <Sparkles size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-h2 text-[var(--text-primary)] truncate">Versão do Aplicativo</h2>
              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                {currentVersion ? `Versão instalada: v${currentVersion}` : 'RachApp'}
              </p>
            </div>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1 shrink-0 ${
              manualUpdateInfo?.isNewer || updateInfo?.isNewer
                ? 'bg-[var(--amber-bg)] text-[#F59E0B] border-[var(--amber-border)]'
                : 'bg-[#CCFBF1] text-[#0F766E] border-[#0F766E]/20'
            }`}
          >
            {manualUpdateInfo?.isNewer || updateInfo?.isNewer ? 'Atualização disponível' : 'Mais recente'}
          </span>
        </div>

        {manualUpdateInfo?.isNewer || updateInfo?.isNewer ? (
          <div className="bg-[var(--bg-subtle)] p-4 rounded-2xl border border-[var(--amber-border)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-display font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                  Nova versão disponível: {(manualUpdateInfo || updateInfo)?.tagName}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {(manualUpdateInfo || updateInfo)?.otaZipUrl && Capacitor.isNativePlatform()
                    ? 'Atualize instantaneamente (OTA) sem precisar reinstalar o APK.'
                    : 'Baixe o APK para atualizar sem perder nenhum dado.'}
                </p>
              </div>
            </div>

            {downloadMsg && (
              <div className="bg-[#CCFBF1] text-[#0F766E] text-xs p-3 rounded-xl flex items-center gap-2 animate-fade-in">
                <Check size={15} strokeWidth={2} className="shrink-0" />
                <span>{downloadMsg}</span>
              </div>
            )}

            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 pt-1">
              <button
                onClick={async () => {
                  const targetInfo = manualUpdateInfo || updateInfo;
                  if (!targetInfo) return;

                  setIsDownloadingApk(true);
                  setDownloadMsg('');
                  try {
                    if (Capacitor.isNativePlatform() && targetInfo.otaZipUrl) {
                      setDownloadMsg('Baixando pacote OTA em segundo plano...');
                      const staged = await downloadAndStageOtaUpdate(targetInfo, (pct) => {
                        setDownloadMsg(`Baixando atualização OTA (${pct}%)...`);
                      });
                      if (staged) {
                        setDownloadMsg(
                          'Nova atualização pronta! O app será recarregado em 3 segundos...'
                        );
                        setTimeout(() => {
                          applyOtaUpdateNow(staged);
                        }, 3000);
                        return;
                      }
                      setDownloadMsg(
                        'Não foi possível concluir o download OTA. Verifique sua conexão e tente novamente, ou toque em "Ver Detalhes" para baixar o APK.'
                      );
                      return;
                    }

                    if (targetInfo.apkDownloadUrl) {
                      await triggerApkDownload(targetInfo.apkDownloadUrl);
                      setDownloadMsg(
                        'Download iniciado! Verifique a barra de notificações do seu celular.'
                      );
                    }
                  } catch {
                    alert('Não foi possível iniciar a atualização automaticamente.');
                  } finally {
                    setTimeout(() => setIsDownloadingApk(false), 2500);
                  }
                }}
                disabled={isDownloadingApk}
                className="flex-1 ds-btn-primary text-xs"
              >
                {isDownloadingApk ? (
                  <>
                    <RefreshCw size={15} strokeWidth={2} className="animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <Download size={15} strokeWidth={2} />
                    {(manualUpdateInfo || updateInfo)?.otaZipUrl && Capacitor.isNativePlatform()
                      ? 'Atualizar Agora (OTA)'
                      : 'Baixar e Atualizar APK'}
                  </>
                )}
              </button>

              {onOpenUpdateModal && (
                <button
                  onClick={() => onOpenUpdateModal()}
                  className="h-12 bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[#0F766E]/40 text-[var(--text-primary)] font-semibold px-4 rounded-xl text-xs transition-colors shrink-0"
                  title="Ver detalhes da versão"
                >
                  Ver Detalhes
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={async () => {
              setIsCheckingUpdate(true);
              try {
                const info = await checkAppUpdate(true);
                setManualUpdateInfo(info);
                if (info?.isNewer) {
                  onUpdateDetected?.(info);
                } else {
                  alert('Você já está usando a versão mais recente do RachApp!');
                }
              } catch {
                alert('Não foi possível verificar atualizações no momento.');
              } finally {
                setIsCheckingUpdate(false);
              }
            }}
            disabled={isCheckingUpdate}
            className="w-full ds-btn-secondary text-sm"
          >
            <RefreshCw size={16} strokeWidth={2} className={isCheckingUpdate ? 'animate-spin' : ''} />
            {isCheckingUpdate ? 'Verificando atualizações...' : 'Verificar Atualizações'}
          </button>
        )}
      </section>

      {/* Logout (Alerta / Pagar Rose #F43F5E) */}
      <section className="pt-1">
        <button
          onClick={handleSairApp}
          className="w-full h-12 border border-[var(--rose-border)] bg-[var(--rose-bg)] text-[#F43F5E] hover:opacity-90 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
        >
          <Trash2 size={18} strokeWidth={2} /> Sair da Conta
        </button>
      </section>

      <PixModal
        isOpen={isPixPreviewOpen}
        onClose={() => setIsPixPreviewOpen(false)}
        pixKey={pix}
        recipientName={nome || 'Usuário'}
        amount={testPixAmount}
        allowEditAmount={true}
        onAmountChange={setTestPixAmount}
        description="Teste Pix RachApp"
      />

      <ChangePasswordScreen
        isOpen={isPasswordScreenOpen}
        onClose={() => setIsPasswordScreenOpen(false)}
        userIdentifier={email || telefone}
      />

      <AvatarEditModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatarUrl={avatarUrl}
        title="Foto de Perfil"
        maskShape="circle"
        onSave={handleSaveAvatar}
        onDelete={avatarUrl ? handleDeleteAvatar : undefined}
      />
    </div>
  );
}
