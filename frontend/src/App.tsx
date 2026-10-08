// src/App.tsx
import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { Home } from './components/Home';
import { Viagens } from './components/Viagens';
import { Amigos } from './components/Amigos';
import { Perfil } from './components/Perfil';
import { AuthScreen } from './components/AuthScreen';
import { AddRideModal } from './components/AddRideModal';
import { AddFriendModal } from './components/AddFriendModal';
import { App as CapApp } from '@capacitor/app';
import { Grupos } from './components/Grupos';

function App() {
  // Verifica se existe um token salvo para iniciar logado
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('@Rachapp:token'));
  
  const [activeTab, setActiveTab] = useState('home');
  const [isRideModalOpen, setIsRideModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const refreshData = () => setDataVersion(prev => prev + 1);

  const handleFabClick = () => {
    if (activeTab === 'amigos') setIsFriendModalOpen(true);
    else setIsRideModalOpen(true);
  };

  // Se não estiver logado, exibe apenas a tela de login
  if (!isAuthenticated) {
    return <AuthScreen onLogin={() => setIsAuthenticated(true)} />;
  }
  
  useEffect(() => {
    let listenerHandle: any = null;

    const setupListener = async () => {
      listenerHandle = await CapApp.addListener('backButton', () => {
        const hasOpenModal = document.querySelector('.fixed.z-50');
        
        if (hasOpenModal) {
          setIsRideModalOpen(false);
          setIsFriendModalOpen(false);
        } else if (activeTab !== 'home') {
          setActiveTab('home');
        } else {
          CapApp.exitApp();
        }
      });
    };

    setupListener();

    return () => {
      // Agora verificamos se o handle existe antes de chamar o remove
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#05080f] text-white font-sans relative pb-20">
      <main className="p-4">
        {activeTab === 'home' && <Home key={`home-${dataVersion}`} />}
        {activeTab === 'viagens' && <Viagens key={`viagens-${dataVersion}`} />}
        {activeTab === 'amigos' && <Amigos key={`amigos-${dataVersion}`} onDataChange={refreshData} />}
        {activeTab === 'grupos' && <Grupos key={`grupos-${dataVersion}`} />}
        {activeTab === 'perfil' && <Perfil onDataChange={() => setIsAuthenticated(false)} />}
      </main>
      
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {(activeTab === 'home' || activeTab === 'viagens' || activeTab === 'amigos' || activeTab === 'grupos') && (
        <button 
          onClick={handleFabClick}
          className="fixed bottom-20 right-6 w-14 h-14 bg-[#2DD4BF] hover:bg-[#25b5a3] rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 transition-transform z-40"
        >
          <Plus size={32} className="text-[#05080f] stroke-[2.5px]" />
        </button>
      )}

      <AddRideModal isOpen={isRideModalOpen} onClose={() => setIsRideModalOpen(false)} onSuccess={refreshData} />
      <AddFriendModal isOpen={isFriendModalOpen} onClose={() => setIsFriendModalOpen(false)} onSuccess={refreshData} />
    </div>
  );
}

export default App;