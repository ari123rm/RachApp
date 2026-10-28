// src/components/ChangePasswordScreen.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Lock, LoaderCircle, CheckCircle2, AlertCircle, KeyRound, X } from 'lucide-react';
import { dbService } from '../services/database';
import { useModalBackHandler } from '../utils/modalBackHandler';

interface ChangePasswordScreenProps {
  isOpen: boolean;
  onClose: () => void;
  userIdentifier?: string;
}

export function ChangePasswordScreen({
  isOpen,
  onClose,
  userIdentifier,
}: ChangePasswordScreenProps) {
  const [mode, setMode] = useState<'change' | 'reset'>('change');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [identificador, setIdentificador] = useState(userIdentifier || '');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useModalBackHandler(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!novaSenha || novaSenha.length < 4) {
      setErrorMsg('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErrorMsg('A confirmação de senha não confere.');
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'change') {
        if (!senhaAtual) {
          setErrorMsg('Informe sua senha atual.');
          setIsSaving(false);
          return;
        }
        await dbService.auth.updatePassword({
          currentPassword: senhaAtual,
          newPassword: novaSenha,
        });
      } else {
        if (!identificador.trim()) {
          setErrorMsg('Informe seu e-mail ou WhatsApp cadastrado.');
          setIsSaving(false);
          return;
        }
        await dbService.auth.resetPassword({
          identifier: identificador.trim(),
          newPassword: novaSenha,
        });
      }

      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setSuccessMsg('Sua senha foi atualizada com sucesso!');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1200);
    } catch (error: any) {
      setErrorMsg(
        error.response?.data?.error || error.message || 'Não foi possível alterar a senha.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-slide-up pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0b0f19]/95 backdrop-blur-md shrink-0">
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <ChevronLeft size={26} />
          </button>
          <h2 className="text-base font-semibold text-white">Alterar / Redefinir Senha</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-[#2DD4BF]/15 text-[#2DD4BF] rounded-3xl mx-auto mb-3 flex items-center justify-center border border-[#2DD4BF]/30">
              <KeyRound size={26} />
            </div>
            <h3 className="text-xl font-bold text-white">Segurança da Conta</h3>
            <p className="text-gray-400 text-xs mt-1">
              {mode === 'change'
                ? 'Informe sua senha atual para definir uma nova senha.'
                : 'Redefina sua senha confirmando seu e-mail ou WhatsApp.'}
            </p>
          </div>

          {/* Alternador entre Alterar com senha atual ou Redefinir */}
          <div className="flex bg-[#1c1c1e] p-1 rounded-xl border border-white/5 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('change');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                mode === 'change'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sei minha senha atual
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                mode === 'reset'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Esqueci a senha atual
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3.5 flex items-center gap-2.5 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-[#34C759]/15 border border-[#34C759]/30 text-[#34C759] rounded-xl p-3.5 flex items-center gap-2.5 text-sm">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'change' ? (
              <div>
                <label className="block text-gray-400 text-xs uppercase font-bold mb-1.5">
                  Senha Atual
                </label>
                <div className="bg-[#1c1c1e] rounded-xl p-3.5 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                  <Lock size={18} className="text-gray-400 mr-3 shrink-0" />
                  <input
                    type="password"
                    placeholder="Digite sua senha atual"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="bg-transparent w-full outline-none text-white text-sm"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-gray-400 text-xs uppercase font-bold mb-1.5">
                  Seu E-mail ou WhatsApp
                </label>
                <div className="bg-[#1c1c1e] rounded-xl p-3.5 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                  <Lock size={18} className="text-gray-400 mr-3 shrink-0" />
                  <input
                    type="text"
                    placeholder="Confirme seu e-mail ou WhatsApp"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    className="bg-transparent w-full outline-none text-white text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-xs uppercase font-bold mb-1.5">
                Nova Senha
              </label>
              <div className="bg-[#1c1c1e] rounded-xl p-3.5 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                <Lock size={18} className="text-gray-400 mr-3 shrink-0" />
                <input
                  type="password"
                  placeholder="Digite a nova senha"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="bg-transparent w-full outline-none text-white text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-xs uppercase font-bold mb-1.5">
                Confirmar Nova Senha
              </label>
              <div className="bg-[#1c1c1e] rounded-xl p-3.5 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                <Lock size={18} className="text-gray-400 mr-3 shrink-0" />
                <input
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="bg-transparent w-full outline-none text-white text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-4 rounded-xl mt-2 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <LoaderCircle className="animate-spin" size={20} />
              ) : (
                'Confirmar Nova Senha'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
