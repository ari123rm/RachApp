// src/App.tsx
import { useState, useEffect, useRef } from 'react';
import { Plus, LoaderCircle } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { Home } from './components/Home';
import { Viagens } from './components/Viagens';
import { Amigos } from './components/Amigos';
import { Perfil } from './components/Perfil';
import { AuthScreen } from './components/AuthScreen';
import { AddRideModal } from './components/AddRideModal';
import { AddFriendModal } from './components/AddFriendModal';
import { AddGroupModal } from './components/AddGroupModal';
import { App as CapApp } from '@capacitor/app';
import { Grupos } from './components/Grupos';
import { dbService } from './services/database';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [isRideModalOpen, setIsRideModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const lastSyncedRef = useRef<string | null>(null);

  const refreshData = () => setDataVersion((prev) => prev + 1);

  // Inicializa o banco SQLite local e verifica se há sessão ativa
  useEffect(() => {
    let mounted = true;
    dbService.auth
      .initSession()
      .then(({ isAuthenticated: auth }) => {
        if (mounted) {
          setIsAuthenticated(auth);
          setIsInitializing(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsAuthenticated(false);
          setIsInitializing(false);
        }
      });

    const unsub = dbService.sync.subscribe((st) => {
      if (st.state === 'synced' && st.lastSyncedAt && st.lastSyncedAt !== lastSyncedRef.current) {
        lastSyncedRef.current = st.lastSyncedAt;
        if (mounted) {
          setDataVersion((prev) => prev + 1);
        }
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Listener do botão voltar (Android / Capacitor) sempre chamado antes de qualquer return condicional
  useEffect(() => {
    let listenerHandle: any = null;

    const setupListener = async () => {
      try {
        listenerHandle = await CapApp.addListener('backButton', () => {
          const hasOpenModal = document.querySelector('.fixed.z-50, .fixed.z-\\[60\\]');

          if (hasOpenModal) {
            setIsRideModalOpen(false);
            setIsFriendModalOpen(false);
            setIsGroupModalOpen(false);
          } else if (activeTab !== 'home') {
            setActiveTab('home');
          } else {
            CapApp.exitApp();
          }
        });
      } catch {
        // Ignora caso não esteja rodando no Capacitor nativo
      }
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [activeTab]);

  const handleFabClick = () => {
    if (activeTab === 'amigos') setIsFriendModalOpen(true);
    else if (activeTab === 'grupos') setIsGroupModalOpen(true);
    else setIsRideModalOpen(true);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#05080f] flex flex-col items-center justify-center text-[#2DD4BF]">
        <LoaderCircle size={44} className="animate-spin mb-3" />
        <p className="text-sm text-gray-400">Carregando seus dados...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLogin={() => {
          setIsAuthenticated(true);
          refreshData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#05080f] text-white font-sans relative pb-20">
      <main className="p-4 max-w-lg mx-auto">
        {activeTab === 'home' && <Home key={`home-${dataVersion}`} onDataChange={refreshData} />}
        {activeTab === 'viagens' && (
          <Viagens key={`viagens-${dataVersion}`} onDataChange={refreshData} />
        )}
        {activeTab === 'amigos' && (
          <Amigos key={`amigos-${dataVersion}`} onDataChange={refreshData} />
        )}
        {activeTab === 'grupos' && (
          <Grupos key={`grupos-${dataVersion}`} onDataChange={refreshData} />
        )}
        {activeTab === 'perfil' && <Perfil onDataChange={() => setIsAuthenticated(false)} />}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {(activeTab === 'home' ||
        activeTab === 'viagens' ||
        activeTab === 'amigos' ||
        activeTab === 'grupos') && (
        <button
          onClick={handleFabClick}
          className="fixed bottom-20 right-6 w-14 h-14 bg-[#2DD4BF] hover:bg-[#25b5a3] rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 transition-transform active:scale-95 z-40"
        >
          <Plus size={32} className="text-[#05080f] stroke-[2.5px]" />
        </button>
      )}

      <AddRideModal
        isOpen={isRideModalOpen}
        onClose={() => setIsRideModalOpen(false)}
        onSuccess={refreshData}
      />
      <AddFriendModal
        isOpen={isFriendModalOpen}
        onClose={() => setIsFriendModalOpen(false)}
        onSuccess={refreshData}
      />
      <AddGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onSuccess={refreshData}
      />
    </div>
  );
}

export default App;
