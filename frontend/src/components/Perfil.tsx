// src/components/Perfil.tsx
import { useState, useEffect } from 'react';
import { User, QrCode, Lock, Trash2, Save, LoaderCircle, ShieldCheck } from 'lucide-react';
import { dbService } from '../services/api';

interface PerfilProps {
  onDataChange: () => void;
}

export function Perfil({ onDataChange }: PerfilProps) {
  const [nome, setNome] = useState('');
  const [pix, setPix] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    // Busca o usuário do cache local (que foi atualizado no login)
    const userStr = localStorage.getItem('@Rachapp:user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setNome(user.name || '');
      setPix(user.pix_key || '');
    }
    setIsLoading(false);
  }, []);

  const handleSalvarPerfil = async () => {
    setIsSavingProfile(true);
    try {
      await dbService.auth.updateProfile({ name: nome, pix_key: pix });
      alert("Perfil atualizado com sucesso!");
    } catch (error) {
      alert("Erro ao atualizar perfil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSalvarSenha = async () => {
    if (!senhaAtual || !novaSenha) return alert("Preencha as senhas.");
    setIsSavingPassword(true);
    try {
      await dbService.auth.updatePassword({ currentPassword: senhaAtual, newPassword: novaSenha });
      setSenhaAtual('');
      setNovaSenha('');
      alert("Senha alterada com segurança!");
    } catch (error: any) {
      alert(error.response?.data?.error || "Erro ao alterar senha.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSairApp = () => {
    if (window.confirm("Deseja sair da sua conta?")) {
      dbService.auth.logout();
      onDataChange(); // Força o App a voltar para a tela de login
    }
  };

  if (isLoading) return <div className="flex justify-center h-64"><LoaderCircle size={40} className="animate-spin text-[#2DD4BF]" /></div>;

  return (
    <div className="space-y-6 pb-20">
      <header className="mt-2">
        <h1 className="text-3xl font-bold text-white mb-2">Seu Perfil</h1>
        <p className="text-gray-500 text-sm">Gerencie seus dados de cobrança e segurança</p>
      </header>

      {/* Dados do Perfil */}
      <section className="bg-[#1c1c1e] rounded-3xl p-5 border border-white/5 space-y-5">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <ShieldCheck size={20} className="text-[#2DD4BF]" />
          Dados Públicos
        </h2>
        <div>
          <label className="block text-gray-400 text-xs mb-2 uppercase font-bold tracking-wider">Seu Nome</label>
          <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center text-white focus-within:ring-1 focus-within:ring-[#2DD4BF]">
            <User size={18} className="text-gray-400 mr-3" />
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="bg-transparent w-full outline-none text-white" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-xs mb-2 uppercase font-bold tracking-wider">Sua Chave Pix Principal</label>
          <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center text-white focus-within:ring-1 focus-within:ring-[#2DD4BF]">
            <QrCode size={18} className="text-gray-400 mr-3" />
            <input type="text" value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF, E-mail ou Celular" className="bg-transparent w-full outline-none text-white" />
          </div>
        </div>
        <button onClick={handleSalvarPerfil} disabled={isSavingProfile} className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
          {isSavingProfile ? <LoaderCircle className="animate-spin" size={20} /> : <Save size={20} />} Salvar Dados
        </button>
      </section>

      {/* Segurança */}
      <section className="bg-[#1c1c1e] rounded-3xl p-5 border border-white/5 space-y-5">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Lock size={20} className="text-[#2DD4BF]" />
          Segurança
        </h2>
        <div>
          <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center text-white focus-within:ring-1 focus-within:ring-[#2DD4BF] mb-3">
            <input type="password" placeholder="Senha Atual" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} className="bg-transparent w-full outline-none text-white text-sm" />
          </div>
          <div className="bg-[#2c2c2e] rounded-xl p-3 flex items-center text-white focus-within:ring-1 focus-within:ring-[#2DD4BF]">
            <input type="password" placeholder="Nova Senha" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} className="bg-transparent w-full outline-none text-white text-sm" />
          </div>
        </div>
        <button onClick={handleSalvarSenha} disabled={isSavingPassword || !senhaAtual || !novaSenha} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl flex items-center justify-center disabled:opacity-50">
          {isSavingPassword ? <LoaderCircle className="animate-spin" size={20} /> : 'Alterar Senha'}
        </button>
      </section>

      {/* Logout */}
      <section className="pt-4">
        <button onClick={handleSairApp} className="w-full border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
          <Trash2 size={18} /> Sair da Conta
        </button>
      </section>
    </div>
  );
}