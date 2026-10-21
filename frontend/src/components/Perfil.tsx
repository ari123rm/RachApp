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
} from 'lucide-react';
import { dbService } from '../services/database';
import { PixModal } from './PixModal';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { formatPhoneBR, isValidPhoneBR } from '../utils/phoneFormatter';
import type { SyncStatus } from '../types';
import { getCurrentAppVersion, checkAppUpdate, triggerApkDownload, type AppReleaseInfo } from '../services/updateService';

interface PerfilProps {
  onDataChange: () => void;
  updateInfo?: AppReleaseInfo | null;
  onOpenUpdateModal?: () => void;
  onUpdateDetected?: (info: AppReleaseInfo) => void;
}

export function Perfil({ onDataChange, updateInfo, onOpenUpdateModal, onUpdateDetected }: PerfilProps) {
  const [currentVersion, setCurrentVersion] = useState('');
  const [manualUpdateInfo, setManualUpdateInfo] = useState<AppReleaseInfo | null>(updateInfo || null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [pix, setPix] = useState('');

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
      setIsLoading(true);
      try {
        getCurrentAppVersion().then((v) => setCurrentVersion(v)).catch(() => {});
        const user = await dbService.settings.get();
        setNome(user.name || user.nome || '');
        setTelefone(formatPhoneBR(user.phone || user.telefone || ''));
        setEmail(user.email || '');
        setPix(user.pix_key || user.pix || '');
      } finally {
        setIsLoading(false);
      }
    };
    carregarPerfil();

    const unsub = dbService.sync.subscribe((st) => setSyncStatus(st));
    return () => unsub();
  }, []);

  const handleSalvarPerfil = async () => {
    if (!nome.trim()) return alert('O nome não pode ficar vazio.');
    if (telefone.trim() && !isValidPhoneBR(telefone)) {
      return alert('Informe um WhatsApp válido com DDD (ex: (85) 99999-8888).');
    }

    setIsSavingProfile(true);
    try {
      await dbService.auth.updateProfile({
        name: nome.trim(),
        phone: formatPhoneBR(telefone),
        pix_key: pix.trim(),
      });
      alert('Dados do perfil atualizados com sucesso!');
    } catch (error) {
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
        <LoaderCircle size={40} className="animate-spin text-[#2DD4BF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="mt-2">
        <h1 className="text-3xl font-bold text-white mb-1">Seu Perfil</h1>
        <p className="text-gray-500 text-sm">
          Gerencie seus dados de cobrança Pix e segurança da conta
        </p>
      </header>

      {/* Dados do Perfil e Chave Pix */}
      <section className="bg-[#1c1c1e] rounded-3xl p-5 border border-white/5 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#2DD4BF]" />
            Dados Públicos e Pix
          </h2>
          {pix && (
            <button
              onClick={() => setIsPixPreviewOpen(true)}
              className="text-xs bg-[#2DD4BF]/15 text-[#2DD4BF] hover:bg-[#2DD4BF]/25 px-3 py-1.5 rounded-full font-bold flex items-center gap-1"
            >
              <QrCode size={13} /> Testar QR Pix
            </button>
          )}
        </div>

        <div>
          <label className="block text-gray-400 text-xs mb-1.5 uppercase font-bold tracking-wider">
            Seu Nome
          </label>
          <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center text-white focus-within:ring-1 focus-within:ring-[#2DD4BF]">
            <User size={18} className="text-gray-400 mr-3" />
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-transparent w-full outline-none text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-400 text-xs mb-1.5 uppercase font-bold tracking-wider">
            Seu WhatsApp (com DDD)
          </label>
          <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center text-white focus-within:ring-1 focus-within:ring-[#2DD4BF]">
            <Phone size={18} className="text-gray-400 mr-3" />
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatPhoneBR(e.target.value))}
              placeholder="(85) 99999-8888"
              className="bg-transparent w-full outline-none text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-400 text-xs mb-1.5 uppercase font-bold tracking-wider">
            Sua Chave Pix Principal
          </label>
          <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center text-white focus-within:ring-1 focus-within:ring-[#2DD4BF]">
            <QrCode size={18} className="text-gray-400 mr-3" />
            <input
              type="text"
              value={pix}
              onChange={(e) => setPix(e.target.value)}
              placeholder="CPF, E-mail, Celular ou Chave Aleatória"
              className="bg-transparent w-full outline-none text-white"
            />
          </div>
        </div>

        <button
          onClick={handleSalvarPerfil}
          disabled={isSavingProfile}
          className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
        >
          {isSavingProfile ? (
            <LoaderCircle className="animate-spin" size={20} />
          ) : (
            <Save size={20} />
          )}{' '}
          Salvar Dados
        </button>
      </section>

      {/* Status de Sincronização na Nuvem */}
      <section className="bg-[#1c1c1e] rounded-3xl p-5 border border-white/5 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <CloudCheck size={20} className="text-[#2DD4BF]" />
            Sincronização da Conta
          </h2>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              syncStatus.state === 'synced'
                ? 'bg-[#34C759]/20 text-[#34C759]'
                : syncStatus.state === 'syncing'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {syncStatus.state === 'synced'
              ? 'Atualizado'
              : syncStatus.state === 'syncing'
              ? 'Sincronizando...'
              : `Pendente (${syncStatus.pendingCount})`}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          Seus rachas, amigos e grupos ficam salvos no aparelho e sincronizados automaticamente com sua conta.
        </p>
        <button
          onClick={() => dbService.sync.now()}
          className="w-full bg-[#2c2c2e] hover:bg-gray-700 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <RefreshCw size={16} className={syncStatus.state === 'syncing' ? 'animate-spin' : ''} />
          Atualizar Agora
        </button>
      </section>

      {/* Segurança - Abre tela separada de alteração/redefinição de senha */}
      <section className="bg-[#1c1c1e] rounded-3xl p-5 border border-white/5">
        <button
          onClick={() => setIsPasswordScreenOpen(true)}
          className="w-full flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2DD4BF]/15 text-[#2DD4BF] flex items-center justify-center">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Alterar ou Redefinir Senha</h2>
              <p className="text-xs text-gray-400">
                Abra a tela exclusiva para trocar ou recuperar sua senha
              </p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-500 group-hover:text-white transition-colors" />
        </button>
      </section>

      {/* Versão e Atualizações do Aplicativo */}
      <section className="bg-[#1c1c1e] rounded-3xl p-5 border border-white/5 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2DD4BF]/15 text-[#2DD4BF] flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Versão do Aplicativo</h2>
              <p className="text-xs text-gray-400">
                {currentVersion ? `Versão instalada: v${currentVersion}` : 'RachApp'}
              </p>
            </div>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
              (manualUpdateInfo?.isNewer || updateInfo?.isNewer)
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30'
            }`}
          >
            {(manualUpdateInfo?.isNewer || updateInfo?.isNewer) ? 'Atualização disponível' : 'Mais recente'}
          </span>
        </div>

        {(manualUpdateInfo?.isNewer || updateInfo?.isNewer) ? (
          <div className="bg-[#2c2c2e] p-4 rounded-2xl border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Nova versão disponível: {(manualUpdateInfo || updateInfo)?.tagName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Baixe o APK para atualizar sem perder nenhum dado.
                </p>
              </div>
            </div>

            {downloadMsg && (
              <div className="bg-[#2DD4BF]/15 border border-[#2DD4BF]/30 text-[#2DD4BF] text-xs p-2.5 rounded-xl flex items-center gap-2 animate-fade-in">
                <Check size={15} className="shrink-0" />
                <span>{downloadMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={async () => {
                  const targetInfo = manualUpdateInfo || updateInfo;
                  if (!targetInfo?.apkDownloadUrl) return;

                  setIsDownloadingApk(true);
                  setDownloadMsg('');
                  try {
                    await triggerApkDownload(targetInfo.apkDownloadUrl);
                    setDownloadMsg('Download iniciado! Verifique a barra de notificações do seu celular.');
                  } catch {
                    alert('Não foi possível iniciar o download automaticamente.');
                  } finally {
                    setTimeout(() => setIsDownloadingApk(false), 2500);
                  }
                }}
                disabled={isDownloadingApk}
                className="flex-1 bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-[#2DD4BF]/10 disabled:opacity-50"
              >
                {isDownloadingApk ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Iniciando download...
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    Baixar e Atualizar APK
                  </>
                )}
              </button>

              {onOpenUpdateModal && (
                <button
                  onClick={() => onOpenUpdateModal()}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 font-medium py-2.5 px-3 rounded-xl text-xs transition-colors shrink-0"
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
            className="w-full bg-[#2c2c2e] hover:bg-gray-700 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={isCheckingUpdate ? 'animate-spin' : ''} />
            {isCheckingUpdate ? 'Verificando atualizações...' : 'Verificar Atualizações'}
          </button>
        )}
      </section>

      {/* Logout */}
      <section className="pt-2">
        <button
          onClick={handleSairApp}
          className="w-full border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Trash2 size={18} /> Sair da Conta
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
    </div>
  );
}