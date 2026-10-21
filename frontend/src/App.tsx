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
import { UpdateModal } from './components/UpdateModal';
import { checkAppUpdate, isUpdateDismissed, type AppReleaseInfo } from './services/updateService';
import { App as CapApp } from '@capacitor/app';
import { dbService } from './services/database';
import { closeTopModal } from './utils/modalBackHandler';
import { listenForSharedReceipt, clearSharedReceipt } from './utils/receiptShare';

const TABS = ['home', 'viagens', 'amigos', 'perfil'] as const;

function isInsideScrollableHorizontal(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  let el: HTMLElement | null = target;
  while (el && el !== document.body) {
    if (el.classList.contains('overflow-x-auto')) {
      if (el.scrollWidth > el.clientWidth + 4) {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [isRideModalOpen, setIsRideModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [incomingSharedReceipt, setIncomingSharedReceipt] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<AppReleaseInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const lastSyncedRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
    direction: 'undecided' | 'horizontal' | 'vertical';
    containerWidth: number;
    startTabIndex: number;
  } | null>(null);

  const refreshData = () => setDataVersion((prev) => prev + 1);

  // Inicializa o banco SQLite local e verifica se há sessão ativa
  useEffect(() => {
    let mounted = true;

    // Checa silenciosamente se há nova versão disponível no GitHub Releases
    checkAppUpdate(false)
      .then((info) => {
        if (mounted && info && info.isNewer) {
          setUpdateInfo(info);
          if (!isUpdateDismissed(info.version)) {
            setIsUpdateModalOpen(true);
          }
        }
      })
      .catch(() => {});

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

          const hasOpenModal = document.querySelector(
            '.fixed.z-50, .fixed.z-\\[60\\], .fixed.z-\\[70\\], .fixed.z-\\[75\\], .fixed.z-\\[80\\], .fixed.z-\\[90\\]'
          );

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

  const tabIndex = Math.max(0, TABS.indexOf(activeTab as any));

  // Sincroniza posição da trilha quando activeTab muda (inclusive ao clicar na BottomNav)
  useEffect(() => {
    if (!trackRef.current) return;
    trackRef.current.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
    trackRef.current.style.transform = `translate3d(-${tabIndex * 100}%, 0, 0)`;
  }, [tabIndex]);

  const handleFabClick = () => {
    if (activeTab === 'amigos') setIsFriendModalOpen(true);
    else setIsRideModalOpen(true);
  };

  // Arraste horizontal em tempo real (acompanhando o dedo a 60/120fps via GPU translate3d)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (isInsideScrollableHorizontal(e.target)) return;

    const touch = e.touches[0];
    const width = containerRef.current?.clientWidth || window.innerWidth;

    dragRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      direction: 'undecided',
      containerWidth: width,
      startTabIndex: tabIndex,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const drag = dragRef.current;
    if (!drag || !drag.active || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const dx = touch.clientX - drag.startX;
    const dy = touch.clientY - drag.startY;

    if (drag.direction === 'undecided') {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;

      if (Math.abs(dy) >= Math.abs(dx)) {
        drag.direction = 'vertical';
        drag.active = false;
        return;
      }

      drag.direction = 'horizontal';
      if (trackRef.current) {
        trackRef.current.style.transition = 'none';
      }
    }

    if (drag.direction === 'horizontal' && trackRef.current) {
      const now = performance.now();
      const dt = now - drag.lastTime;
      if (dt > 0) {
        drag.velocityX = (touch.clientX - drag.lastX) / dt;
        drag.lastX = touch.clientX;
        drag.lastTime = now;
      }

      // Resistência suave (rubber-band) nas extremidades
      const isPastStart = drag.startTabIndex === 0 && dx > 0;
      const isPastEnd = drag.startTabIndex === TABS.length - 1 && dx < 0;
      const effectiveDx = isPastStart || isPastEnd ? dx * 0.22 : dx;

      const baseOffsetPx = -drag.startTabIndex * drag.containerWidth;
      trackRef.current.style.transform = `translate3d(${baseOffsetPx + effectiveDx}px, 0, 0)`;
    }
  };

  const finishTouchDrag = (e: React.TouchEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.direction !== 'horizontal') return;

    const endX = e.changedTouches[0]?.clientX ?? drag.lastX;
    const dx = endX - drag.startX;
    const width = drag.containerWidth || window.innerWidth;
    const ratio = dx / width;
    const vx = drag.velocityX;

    let nextIndex = drag.startTabIndex;

    if ((ratio < -0.2 || (vx < -0.32 && dx < -22)) && drag.startTabIndex < TABS.length - 1) {
      nextIndex = drag.startTabIndex + 1;
    } else if ((ratio > 0.2 || (vx > 0.32 && dx > 22)) && drag.startTabIndex > 0) {
      nextIndex = drag.startTabIndex - 1;
    }

    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
      trackRef.current.style.transform = `translate3d(-${nextIndex * 100}%, 0, 0)`;
    }

    if (nextIndex !== drag.startTabIndex) {
      setActiveTab(TABS[nextIndex]);
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

  return (
    <div className="h-[100dvh] bg-[#05080f] text-white font-sans relative overflow-hidden flex flex-col">
      {/* Contêiner de abas principais com acompanhamento do dedo em tempo real */}
      <main
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishTouchDrag}
        onTouchCancel={finishTouchDrag}
        className="flex-1 w-full overflow-hidden relative touch-pan-y"
      >
        <div
          ref={trackRef}
          className="flex h-full w-full will-change-transform"
          style={{
            transform: `translate3d(-${tabIndex * 100}%, 0, 0)`,
            backfaceVisibility: 'hidden',
          }}
        >
          {/* TAB 0: HOME */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y">
              <Home
                dataVersion={dataVersion}
                onDataChange={refreshData}
                updateInfo={updateInfo}
                onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
              />
            </div>
          </div>

          {/* TAB 1: VIAGENS / RACHAS */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y">
              <Viagens dataVersion={dataVersion} onDataChange={refreshData} />
            </div>
          </div>

          {/* TAB 2: AMIGOS (com Amigos e Grupos internos) */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y">
              <Amigos dataVersion={dataVersion} onDataChange={refreshData} />
            </div>
          </div>

          {/* TAB 3: PERFIL */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y">
              <Perfil
                dataVersion={dataVersion}
                onDataChange={() => setIsAuthenticated(false)}
                onProfileChange={refreshData}
                updateInfo={updateInfo}
                onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
                onUpdateDetected={(info) => {
                  setUpdateInfo(info);
                  setIsUpdateModalOpen(true);
                }}
              />
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
        onClose={() => {
          setIncomingSharedReceipt(null);
          clearSharedReceipt();
        }}
        onSuccess={() => {
          setIncomingSharedReceipt(null);
          clearSharedReceipt();
          refreshData();
        }}
      />

      {updateInfo && updateInfo.isNewer && (
        <UpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          updateInfo={updateInfo}
        />
      )}
    </div>
  );
}

export default App;
