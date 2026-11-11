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

  const sheetRef = useModalBackHandler(isOpen, onClose);

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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="bg-[var(--bg-surface)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--border-color)] shadow-lg flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-slide-up pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle de arrastar para baixo */}
        <div
          data-sheet-handle="true"
          className="w-full pt-2.5 pb-1 flex justify-center items-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
        >
          <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full" />
        </div>

        {/* Cabeçalho */}
        <div
          data-sheet-handle="true"
          className="flex items-center justify-between p-4 pt-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 select-none"
        >
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-full transition-colors"
          >
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
          <h2 className="text-h2 text-[var(--text-primary)]">Alterar / Redefinir Senha</h2>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-full transition-colors"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-[var(--primary-light)] text-[var(--primary)] rounded-full mx-auto mb-3 flex items-center justify-center">
              <KeyRound size={24} strokeWidth={2} />
            </div>
            <h3 className="text-h1 text-[var(--text-primary)]">Segurança da Conta</h3>
            <p className="text-[var(--text-secondary)] text-xs mt-1">
              {mode === 'change'
                ? 'Informe sua senha atual para definir uma nova senha.'
                : 'Redefina sua senha confirmando seu e-mail ou WhatsApp.'}
            </p>
          </div>

          {/* Alternador entre Alterar com senha atual ou Redefinir */}
          <div className="flex bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border-color)] mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('change');
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'change'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'reset'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Esqueci a senha atual
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 bg-[var(--rose-bg)] border border-[var(--rose-border)] text-[#F43F5E] rounded-xl p-3.5 flex items-center gap-2.5 text-sm">
              <AlertCircle size={18} strokeWidth={2} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-[var(--emerald-bg)] border border-[var(--emerald-border)] text-[#10B981] rounded-xl p-3.5 flex items-center gap-2.5 text-sm">
              <CheckCircle2 size={18} strokeWidth={2} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'change' ? (
              <div>
                <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1.5">
                  Senha Atual
                </label>
                <div className="h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-[var(--bg-surface)] transition-all">
                  <Lock size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
                  <input
                    type="password"
                    placeholder="Digite sua senha atual"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1.5">
                  Seu E-mail ou WhatsApp
                </label>
                <div className="h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-[var(--bg-surface)] transition-all">
                  <Lock size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
                  <input
                    type="text"
                    placeholder="Confirme seu e-mail ou WhatsApp"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1.5">
                Nova Senha
              </label>
              <div className="h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-[var(--bg-surface)] transition-all">
                <Lock size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
                <input
                  type="password"
                  placeholder="Digite a nova senha"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1.5">
                Confirmar Nova Senha
              </label>
              <div className="h-12 bg-[var(--bg-subtle)] rounded-xl px-4 flex items-center border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-[var(--bg-surface)] transition-all">
                <Lock size={18} strokeWidth={2} className="text-[var(--text-secondary)] mr-3 shrink-0" />
                <input
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="bg-transparent w-full outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full ds-btn-primary mt-2"
            >
              {isSaving ? (
                <LoaderCircle className="animate-spin" size={20} strokeWidth={2} />
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
