// src/components/AuthScreen.tsx
import { useState } from 'react';
import { dbService, getApiBaseUrl, setCustomApiUrl } from '../services/database';
import {
  LoaderCircle,
  Mail,
  Lock,
  User,
  QrCode,
  Phone,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  KeyRound,
  Server,
} from 'lucide-react';
import { formatPhoneBR, isValidPhoneBR } from '../utils/phoneFormatter';
import appIcon from '../assets/icon.png';

export function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<'login' | 'register' | 'verify' | 'reset'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getApiBaseUrl());
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    pix_key: '',
    code: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);
    try {
      if (step === 'login') {
        await dbService.auth.login(formData.email, formData.password);
        onLogin();
      } else if (step === 'register') {
        if (!isValidPhoneBR(formData.phone)) {
          setErrorMsg('Informe um número de WhatsApp válido com DDD (ex: (85) 99999-8888).');
          setIsLoading(false);
          return;
        }
        const res = await dbService.auth.register({
          ...formData,
          phone: formatPhoneBR(formData.phone),
        });
        if (res.verification_code) {
          setSimulatedCode(res.verification_code);
          setFormData((prev) => ({ ...prev, code: res.verification_code }));
        }
        setStep('verify');
      } else if (step === 'verify') {
        await dbService.auth.verify(formData.email, formData.code);
        onLogin();
      } else if (step === 'reset') {
        if (!formData.email.trim()) {
          setErrorMsg('Informe seu e-mail ou WhatsApp cadastrado.');
          setIsLoading(false);
          return;
        }
        if (!formData.password || formData.password.length < 4) {
          setErrorMsg('A nova senha deve ter pelo menos 4 caracteres.');
          setIsLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setErrorMsg('A confirmação da nova senha não confere.');
          setIsLoading(false);
          return;
        }
        await dbService.auth.resetPassword({
          identifier: formData.email.trim(),
          newPassword: formData.password,
        });
        setSuccessMsg('Senha redefinida com sucesso! Faça login com sua nova senha.');
        setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
        setTimeout(() => {
          setSuccessMsg('');
          setStep('login');
        }, 1200);
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.error ||
        error.message ||
        'Erro na operação. Verifique se o servidor está rodando.';
      if (msg === 'VERIFICATION_REQUIRED') {
        setStep('verify');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Tela separada de Redefinição de Senha
  if (step === 'reset') {
    return (
      <div className="min-h-screen bg-[#05080f] flex flex-col px-4 sm:px-6 py-6 sm:py-8 pt-safe pb-safe animate-slide-up overflow-y-auto">
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setSuccessMsg('');
              setStep('login');
            }}
            className="self-start mb-6 flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium"
          >
            <ChevronLeft size={20} /> Voltar para o Login
          </button>

          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30 rounded-3xl mx-auto mb-4 flex items-center justify-center">
              <KeyRound size={30} />
            </div>
            <h1 className="text-2xl font-bold text-white">Redefinir Senha</h1>
            <p className="text-gray-400 mt-1 text-sm">
              Informe seu e-mail ou WhatsApp cadastrado para criar uma nova senha
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3.5 flex items-center gap-2.5 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-[#34C759]/15 border border-[#34C759]/30 text-[#34C759] rounded-xl p-3.5 flex items-center gap-2.5 text-sm">
              <CheckCircle size={18} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
              <Mail size={20} className="text-gray-400 mr-3 shrink-0" />
              <input
                type="text"
                placeholder="Seu E-mail ou WhatsApp (com DDD)"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-transparent w-full outline-none text-white"
              />
            </div>

            <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
              <Lock size={20} className="text-gray-400 mr-3 shrink-0" />
              <input
                type="password"
                placeholder="Nova Senha"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-transparent w-full outline-none text-white"
              />
            </div>

            <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
              <Lock size={20} className="text-gray-400 mr-3 shrink-0" />
              <input
                type="password"
                placeholder="Confirmar Nova Senha"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="bg-transparent w-full outline-none text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-4 rounded-xl mt-4 flex justify-center items-center transition-colors disabled:opacity-50"
            >
              {isLoading ? <LoaderCircle className="animate-spin" /> : 'Salvar Nova Senha'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05080f] flex flex-col justify-center px-4 sm:px-6 py-6 sm:py-10 pt-safe pb-safe overflow-y-auto">
      <div className="max-w-md w-full mx-auto my-auto">
        <div className="mb-8 text-center">
          <img
            src={appIcon}
            alt="RachApp"
            className="w-24 h-24 rounded-3xl mx-auto mb-4 shadow-lg shadow-teal-500/20 object-cover border border-white/10"
          />
          <h1 className="text-3xl font-bold text-white">RachApp</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {step === 'login' && 'Faça login na sua conta para acessar seus rachas'}
            {step === 'register' && 'Crie sua conta gratuita'}
            {step === 'verify' && 'Verifique seu número de WhatsApp'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3.5 text-sm space-y-2">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>
                {errorMsg === 'Network Error'
                  ? `Não foi possível conectar ao servidor (${getApiBaseUrl()}).`
                  : errorMsg}
              </span>
            </div>
            {errorMsg === 'Network Error' && (
              <button
                type="button"
                onClick={() => setShowServerConfig(true)}
                className="text-xs text-[#2DD4BF] underline font-semibold block"
              >
                Configurar endereço do servidor
              </button>
            )}
          </div>
        )}

        {showServerConfig && (
          <div className="mb-4 bg-[#1c1c1e] border border-white/10 rounded-xl p-3.5 space-y-2.5">
            <label className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1.5">
              <Server size={13} className="text-[#2DD4BF]" /> URL da API do Servidor
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="http://SEU_IP_VPS:5000/api"
                className="flex-1 bg-[#2c2c2e] text-white text-xs rounded-lg px-3 py-2 outline-none border border-white/10 focus:border-[#2DD4BF]"
              />
              <button
                type="button"
                onClick={() => {
                  const updated = setCustomApiUrl(serverUrlInput);
                  setServerUrlInput(updated);
                  setShowServerConfig(false);
                  setErrorMsg('');
                }}
                className="bg-[#2DD4BF] text-[#05080f] text-xs font-bold px-3 py-2 rounded-lg"
              >
                Salvar
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {step !== 'verify' && (
            <>
              {step === 'register' && (
                <>
                  <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                    <User size={20} className="text-gray-400 mr-3 shrink-0" />
                    <input
                      type="text"
                      placeholder="Seu Nome"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-transparent w-full outline-none text-white"
                    />
                  </div>
                  <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                    <Phone size={20} className="text-gray-400 mr-3 shrink-0" />
                    <input
                      type="tel"
                      placeholder="WhatsApp ex: (85) 99999-8888"
                      required
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: formatPhoneBR(e.target.value) })
                      }
                      className="bg-transparent w-full outline-none text-white"
                    />
                  </div>
                </>
              )}

              <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                <Mail size={20} className="text-gray-400 mr-3 shrink-0" />
                <input
                  type="text"
                  placeholder={step === 'login' ? 'E-mail ou WhatsApp' : 'E-mail'}
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-transparent w-full outline-none text-white"
                />
              </div>

              <div>
                <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                  <Lock size={20} className="text-gray-400 mr-3 shrink-0" />
                  <input
                    type="password"
                    placeholder="Senha"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="bg-transparent w-full outline-none text-white"
                  />
                </div>
                {step === 'login' && (
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setStep('reset');
                      }}
                      className="text-xs text-[#2DD4BF] hover:underline font-medium"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                )}
              </div>

              {step === 'register' && (
                <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                  <QrCode size={20} className="text-gray-400 mr-3 shrink-0" />
                  <input
                    type="text"
                    placeholder="Sua Chave Pix (CPF, E-mail, Celular ou Aleatória)"
                    value={formData.pix_key}
                    onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                    className="bg-transparent w-full outline-none text-white"
                  />
                </div>
              )}
            </>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              {simulatedCode && (
                <div className="bg-[#2DD4BF]/10 border border-[#2DD4BF]/30 text-[#2DD4BF] rounded-xl p-3 text-xs flex items-center justify-center gap-1.5">
                  <Phone size={14} className="shrink-0" />
                  <strong>Código de Verificação:</strong>{' '}
                  <span className="font-mono font-bold text-sm underline">{simulatedCode}</span>
                </div>
              )}
              <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                <CheckCircle size={20} className="text-gray-400 mr-3 shrink-0" />
                <input
                  type="text"
                  placeholder="Código de 6 dígitos"
                  required
                  maxLength={6}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="bg-transparent w-full outline-none text-center tracking-[0.5em] text-xl font-bold text-white"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-4 rounded-xl mt-6 flex justify-center items-center transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <LoaderCircle className="animate-spin" />
            ) : step === 'login' ? (
              'Entrar'
            ) : step === 'register' ? (
              'Continuar'
            ) : (
              'Verificar e Entrar'
            )}
          </button>
        </form>

        {step !== 'verify' ? (
          <p className="text-center text-gray-500 mt-8">
            {step === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setStep(step === 'login' ? 'register' : 'login');
              }}
              className="text-[#2DD4BF] font-bold ml-2 hover:underline"
            >
              {step === 'login' ? 'Criar Conta' : 'Fazer Login'}
            </button>
          </p>
        ) : (
          <p className="text-center text-gray-500 mt-6">
            <button
              type="button"
              onClick={() => setStep('login')}
              className="text-gray-400 hover:text-white text-sm underline"
            >
              Voltar para Login
            </button>
          </p>
        )}
      </div>
    </div>
  );
}