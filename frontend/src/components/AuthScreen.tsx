import { useState } from 'react';
import { dbService } from '../services/api';
import { LoaderCircle, Mail, Lock, User, QrCode, Phone, CheckCircle } from 'lucide-react';

export function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<'login' | 'register' | 'verify'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', pix_key: '', code: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (step === 'login') {
        await dbService.auth.login(formData.email, formData.password);
        onLogin();
      } else if (step === 'register') {
        await dbService.auth.register(formData);
        setStep('verify'); // Avança para a tela de OTP
      } else if (step === 'verify') {
        await dbService.auth.verify(formData.email, formData.code);
        // Após verificar, faz login automaticamente
        await dbService.auth.login(formData.email, formData.password);
        onLogin();
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || "Erro na operação";
      if (msg === 'VERIFICATION_REQUIRED') {
        setStep('verify'); // Direciona para verificação se tentar logar sem confirmar
      } else {
        alert(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05080f] flex flex-col justify-center px-6">
      <div className="mb-10 text-center">
        <div className="w-20 h-20 bg-[#2DD4BF] rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-teal-500/20">
          <span className="text-4xl font-black text-[#05080f]">R</span>
        </div>
        <h1 className="text-3xl font-bold text-white">RachApp</h1>
        <p className="text-gray-400 mt-2">
          {step === 'login' && 'Faça login na sua conta'}
          {step === 'register' && 'Crie sua conta gratuita'}
          {step === 'verify' && 'Verifique seu WhatsApp'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {step !== 'verify' && (
          <>
            {step === 'register' && (
              <>
                <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                  <User size={20} className="text-gray-400 mr-3" />
                  <input type="text" placeholder="Seu Nome" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-transparent w-full outline-none" />
                </div>
                <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                  <Phone size={20} className="text-gray-400 mr-3" />
                  <input type="tel" placeholder="WhatsApp (DDD + Número)" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-transparent w-full outline-none" />
                </div>
              </>
            )}

            <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
              <Mail size={20} className="text-gray-400 mr-3" />
              <input type="email" placeholder="E-mail" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-transparent w-full outline-none" />
            </div>

            <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
              <Lock size={20} className="text-gray-400 mr-3" />
              <input type="password" placeholder="Senha" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="bg-transparent w-full outline-none" />
            </div>
            
            {step === 'register' && (
              <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
                <QrCode size={20} className="text-gray-400 mr-3" />
                <input type="text" placeholder="Chave Pix (Opcional)" value={formData.pix_key} onChange={e => setFormData({...formData, pix_key: e.target.value})} className="bg-transparent w-full outline-none" />
              </div>
            )}
          </>
        )}

        {step === 'verify' && (
          <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center text-white border border-white/5 focus-within:border-[#2DD4BF]">
            <CheckCircle size={20} className="text-gray-400 mr-3" />
            <input type="text" placeholder="Código de 6 dígitos" required maxLength={6} value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="bg-transparent w-full outline-none text-center tracking-[0.5em] text-xl font-bold" />
          </div>
        )}

        <button type="submit" disabled={isLoading} className="w-full bg-[#2DD4BF] text-[#05080f] font-bold py-4 rounded-xl mt-6 flex justify-center items-center">
          {isLoading ? <LoaderCircle className="animate-spin" /> : (step === 'login' ? 'Entrar' : step === 'register' ? 'Continuar' : 'Verificar e Entrar')}
        </button>
      </form>

      {step !== 'verify' && (
        <p className="text-center text-gray-500 mt-8">
          {step === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'} 
          <button onClick={() => setStep(step === 'login' ? 'register' : 'login')} className="text-[#2DD4BF] font-bold ml-2">
            {step === 'login' ? 'Registar' : 'Fazer Login'}
          </button>
        </p>
      )}
    </div>
  );
}