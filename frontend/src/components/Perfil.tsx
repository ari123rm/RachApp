// src/components/Perfil.tsx
import { useState, useEffect } from 'react';
import {
  User,
  QrCode,
  Trash2,
  Save,
  LoaderCircle,
  ShieldCheck,
  Phone,
  ChevronRight,
  Pencil,
  X,
  Settings,
  Palette,
} from 'lucide-react';
import { dbService } from '../services/database';
import { PixModal } from './PixModal';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { SettingsModal } from './SettingsModal';
import { TopBar } from './TopBar';
import { formatPhoneBR, isValidPhoneBR } from '../utils/phoneFormatter';
import { AvatarEditModal } from './AvatarEditModal';
import { useTheme } from '../utils/theme';
import type { SyncStatus } from '../types';
import type { AppReleaseInfo } from '../services/updateService';

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
  const { preset: currentPreset } = useTheme();

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: null,
  });

  useEffect(() => {
    const carregarPerfil = async () => {
      try {
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
      <div className="space-y-4">
        <TopBar title="Meu Perfil" subtitle="Seus dados públicos e chave Pix" />
        <div className="flex justify-center items-center h-64">
          <LoaderCircle size={40} strokeWidth={2} className="animate-spin text-[var(--primary)]" />
        </div>
      </div>
    );
  }

  const userInitial = (nome || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-4 pb-20">
      <TopBar
        title="Meu Perfil"
        subtitle="Seus dados públicos e chave Pix"
        rightContent={
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="h-10 px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--primary)] text-[var(--text-primary)] font-semibold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 relative shrink-0"
            title="Abrir Configurações"
          >
            <Settings size={16} strokeWidth={2} className="text-[var(--primary)]" />
            <span>Configurações</span>
            {updateInfo?.isNewer && (
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            )}
          </button>
        }
      />

      {/* Card Principal do Usuário com Avatar Grande Centralizado */}
      <section className="ds-card p-5 flex flex-col items-center text-center">
        <div className="relative">
          <div
            onClick={() => setIsAvatarModalOpen(true)}
            className="w-24 h-24 rounded-full overflow-hidden bg-[var(--bg-surface)] border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] shadow-md flex items-center justify-center cursor-pointer relative group transition-colors"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={nome || 'Foto de Perfil'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)] text-3xl font-display font-bold select-none">
                {userInitial}
              </div>
            )}

            {isSavingPhoto && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <LoaderCircle size={24} strokeWidth={2} className="animate-spin text-white" />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsAvatarModalOpen(true)}
            title="Editar foto de perfil"
            className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white shadow-md flex items-center justify-center border-2 border-[var(--bg-surface)] transition-transform active:scale-90"
          >
            <Pencil size={14} strokeWidth={2} />
          </button>
        </div>

        <h2 className="text-lg sm:text-xl font-display font-bold text-[var(--text-primary)] mt-3 break-words max-w-xs">
          {nome || 'Seu Perfil'}
        </h2>
        {email && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{email}</p>}

        {pix && (
          <button
            type="button"
            onClick={() => setIsPixPreviewOpen(true)}
            className="mt-4 h-10 px-4 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 font-semibold text-xs inline-flex items-center gap-2 transition-all active:scale-95"
          >
            <QrCode size={15} strokeWidth={2} />
            <span>Testar Meu QR Code Pix</span>
          </button>
        )}
      </section>

      {/* Dados Públicos e Chave Pix */}
      <section className="ds-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-display font-semibold text-[var(--text-primary)] flex items-center gap-2 min-w-0">
            <ShieldCheck size={19} strokeWidth={2} className="text-[var(--primary)] shrink-0" />
            <span className="truncate">Dados Públicos e Pix</span>
          </h2>
          <button
            type="button"
            onClick={handleToggleEditDados}
            title={isEditingDados ? 'Cancelar edição' : 'Editar dados públicos'}
            className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border shrink-0 ${
              isEditingDados
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
            }`}
          >
            {isEditingDados ? (
              <>
                <X size={14} strokeWidth={2} />
                <span>Cancelar</span>
              </>
            ) : (
              <>
                <Pencil size={14} strokeWidth={2} />
                <span>Editar</span>
              </>
            )}
          </button>
        </div>

        <div>
          <label className="block text-[var(--text-secondary)] text-xs mb-1.5 uppercase font-semibold tracking-wider">
            Seu Nome
          </label>
          <div
            className={`h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border transition-all ${
              isEditingDados
                ? 'border-[var(--primary)] ring-2 ring-[var(--primary-focus-ring)] bg-[var(--bg-surface)]'
                : 'border-[var(--border-color)] opacity-85'
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
                ? 'border-[var(--primary)] ring-2 ring-[var(--primary-focus-ring)] bg-[var(--bg-surface)]'
                : 'border-[var(--border-color)] opacity-85'
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
                ? 'border-[var(--primary)] ring-2 ring-[var(--primary-focus-ring)] bg-[var(--bg-surface)]'
                : 'border-[var(--border-color)] opacity-85'
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
              className="flex-1 h-12 bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold rounded-xl transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarPerfil}
              disabled={isSavingProfile}
              className="flex-[2] ds-btn-primary text-sm"
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

      {/* Atalho para abrir a Tela de Configurações (Temas Scalar, Sincronização, Senha e Atualizações) */}
      <section className="ds-card p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center justify-between gap-3 text-left group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <Settings size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-display font-semibold text-[var(--text-primary)] truncate">
                  Configurações do Aplicativo
                </h2>
                {updateInfo?.isNewer && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--amber-bg)] text-[#F59E0B] border border-[var(--amber-border)] shrink-0">
                    Atualização
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate flex items-center gap-1.5">
                <Palette size={12} className="text-[var(--primary)] shrink-0" />
                <span>Tema {currentPreset.name} • Sincronização, Senha e Versão</span>
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

      {/* Logout (Alerta / Pagar Rose #F43F5E) */}
      <section className="pt-1">
        <button
          type="button"
          onClick={handleSairApp}
          className="w-full h-12 border border-[var(--rose-border)] bg-[var(--rose-bg)] text-[#F43F5E] hover:opacity-90 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] text-sm"
        >
          <Trash2 size={18} strokeWidth={2} />
          <span>Sair da Conta</span>
        </button>
      </section>

      {/* Tela 2: Configurações */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        syncStatus={syncStatus}
        updateInfo={updateInfo}
        onOpenUpdateModal={onOpenUpdateModal}
        onUpdateDetected={onUpdateDetected}
        onOpenPasswordScreen={() => setIsPasswordScreenOpen(true)}
      />

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
