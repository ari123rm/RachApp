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
import { AssignReceiptModal } from './components/AssignReceiptModal';
import { App as CapApp } from '@capacitor/app';
import { dbService } from './services/database';
import { closeTopModal } from './utils/modalBackHandler';
import { listenForSharedReceipt } from './utils/receiptShare';

const TABS = ['home', 'viagens', 'amigos', 'perfil'] as const;

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [isRideModalOpen, setIsRideModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [incomingSharedReceipt, setIncomingSharedReceipt] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const lastSyncedRef = useRef<string | null>(null);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

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

    let lastSyncTrigger = 0;
    const unsub = dbService.sync.subscribe((st) => {
      const now = Date.now();
      if (
        st.state === 'synced' &&
        st.lastSyncedAt &&
        st.lastSyncedAt !== lastSyncedRef.current &&
        now - lastSyncTrigger > 800
      ) {
        lastSyncedRef.current = st.lastSyncedAt;
        lastSyncTrigger = now;
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

  // Escuta comprovantes compartilhados de outros apps (via Android Intent ou PWA)
  useEffect(() => {
    const unsubShared = listenForSharedReceipt((receiptDataUrl) => {
      if (receiptDataUrl) {
        setIncomingSharedReceipt(receiptDataUrl);
      }
    });
    return unsubShared;
  }, []);

  // Listener do botão voltar (Android / Capacitor)
  useEffect(() => {
    let listenerHandle: any = null;

    const setupListener = async () => {
      try {
        listenerHandle = await CapApp.addListener('backButton', () => {
          if (closeTopModal()) {
            return;
          }

          const hasOpenModal = document.querySelector('.fixed.z-50, .fixed.z-\\[60\\], .fixed.z-\\[70\\], .fixed.z-\\[75\\], .fixed.z-\\[80\\], .fixed.z-\\[90\\]');

          if (hasOpenModal) {
            setIncomingSharedReceipt(null);
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
    else setIsRideModalOpen(true);
  };

  // Suporte a swipe horizontal entre as abas principais
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const diffX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const diffY = e.changedTouches[0].clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Detecta arrasto predominantemente horizontal com deslocamento mínimo
    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.3 && elapsed < 600) {
      const currentIndex = TABS.indexOf(activeTab as any);
      if (diffX < 0 && currentIndex < TABS.length - 1) {
        // Swipe para a esquerda -> avança para a próxima aba
        setActiveTab(TABS[currentIndex + 1]);
      } else if (diffX > 0 && currentIndex > 0) {
        // Swipe para a direita -> volta para a aba anterior
        setActiveTab(TABS[currentIndex - 1]);
      }
    }
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

  const tabIndex = Math.max(0, TABS.indexOf(activeTab as any));

  return (
    <div className="h-[100dvh] bg-[#05080f] text-white font-sans relative overflow-hidden flex flex-col">
      {/* Contêiner de abas principais com animação deslizante para os lados */}
      <main
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 w-full overflow-hidden relative"
      >
        <div
          className="flex h-full w-full transition-transform duration-300 md:transition-none ease-out"
          style={{
            transform: `translateX(-${tabIndex * 100}%)`,
          }}
        >
          {/* TAB 0: HOME */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide">
              <Home dataVersion={dataVersion} onDataChange={refreshData} />
            </div>
          </div>

          {/* TAB 1: VIAGENS / RACHAS */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide">
              <Viagens dataVersion={dataVersion} onDataChange={refreshData} />
            </div>
          </div>

          {/* TAB 2: AMIGOS (com Amigos e Grupos internos) */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide">
              <Amigos dataVersion={dataVersion} onDataChange={refreshData} />
            </div>
          </div>

          {/* TAB 3: PERFIL */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide">
              <Perfil onDataChange={() => setIsAuthenticated(false)} />
            </div>
          </div>
        </div>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {(activeTab === 'home' || activeTab === 'viagens' || activeTab === 'amigos') && (
        <button
          onClick={handleFabClick}
          className="fixed bottom-20 right-6 md:right-[max(1.5rem,calc(50%-22rem))] w-14 h-14 bg-[#2DD4BF] hover:bg-[#25b5a3] rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 transition-transform active:scale-95 z-40"
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
      <AssignReceiptModal
        isOpen={!!incomingSharedReceipt}
        receiptDataUrl={incomingSharedReceipt}
        onClose={() => setIncomingSharedReceipt(null)}
        onSuccess={() => {
          setIncomingSharedReceipt(null);
          refreshData();
        }}
      />
    </div>
  );
}

export default App;
