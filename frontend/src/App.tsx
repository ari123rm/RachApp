// src/App.tsx
import { useState, useEffect, useRef } from 'react';
import { Plus, LoaderCircle, Bell, X, Sparkles, RefreshCw, Clock, UserPlus, Users } from 'lucide-react';
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
import { NotificationModal } from './components/NotificationModal';
import { useOtaUpdater } from './services/updateService';
import { App as CapApp } from '@capacitor/app';
import {
  dbService,
  initSocket,
  disconnectSocket,
  onSocketNotification,
  initPushNotifications,
  unregisterPushNotifications,
} from './services/api';
import { closeTopModal } from './utils/modalBackHandler';
import { listenForSharedReceipt, clearSharedReceipt } from './utils/receiptShare';
import type { AppNotification } from './types';

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
  const [amigosSubTab, setAmigosSubTab] = useState<'amigos' | 'grupos'>('amigos');
  const [isRideModalOpen, setIsRideModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [incomingSharedReceipt, setIncomingSharedReceipt] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [inAppToast, setInAppToast] = useState<AppNotification | null>(null);
  const lastSyncedRef = useRef<string | null>(null);

  // Serviço/Hook de atualização OTA Self-Hosted em background
  const {
    otaStatus,
    readyBundle,
    releaseInfo: updateInfo,
    countdown,
    applyNow,
    applyOnNextBoot,
    setReleaseInfo: setUpdateInfo,
  } = useOtaUpdater({
    onApkFallbackDetected: () => {
      setIsUpdateModalOpen(true);
    },
  });

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

  // Conexão em tempo real via WebSocket (Socket.io), Push Notifications e auto-sync ao focar no app
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      unregisterPushNotifications();
      return;
    }

    initSocket();
    initPushNotifications();

    const unsubNotif = onSocketNotification((notif: AppNotification) => {
      setInAppToast(notif);
      refreshData();
      setTimeout(() => {
        setInAppToast((curr) => (curr?.id === notif.id ? null : curr));
      }, 5000);
    });

    let appStateHandle: any = null;
    CapApp.addListener('appStateChange', (state) => {
      if (state.isActive) {
        dbService.sync.now().catch(() => {});
      }
    })
      .then((h) => {
        appStateHandle = h;
      })
      .catch(() => {});

    const handleVisibility = () => {
      if (!document.hidden) {
        dbService.sync.now().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      unsubNotif();
      if (appStateHandle && typeof appStateHandle.remove === 'function') {
        appStateHandle.remove();
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [isAuthenticated]);

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
            setIsNotificationModalOpen(false);
            setInAppToast(null);
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
    if (activeTab === 'amigos') {
      if (amigosSubTab === 'grupos') {
        setIsGroupModalOpen(true);
      } else {
        setIsFriendModalOpen(true);
      }
    } else {
      setIsRideModalOpen(true);
    }
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

  // Toast suave de Atualização OTA Pronta (Blue-Green)
  const otaReadyToast =
    (otaStatus === 'ready' || otaStatus === 'applying') && readyBundle ? (
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-[95] bg-[#141a23]/95 border border-[#2DD4BF]/50 rounded-2xl p-4 shadow-2xl animate-fade-in backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center shrink-0 border border-[#2DD4BF]/30">
            {otaStatus === 'applying' ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">
              Nova atualização pronta! ({readyBundle.tagName})
            </p>
            <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
              {otaStatus === 'applying'
                ? 'Aplicando atualização e recarregando o app...'
                : `Nova atualização pronta! O app será recarregado em ${countdown ?? 3} segundo${
                    (countdown ?? 3) === 1 ? '' : 's'
                  }.`}
            </p>

            {otaStatus === 'ready' && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={applyNow}
                  className="bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <RefreshCw size={12} />
                  Recarregar agora
                </button>
                <button
                  onClick={applyOnNextBoot}
                  className="bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Clock size={12} />
                  No próximo boot
                </button>
              </div>
            )}
          </div>

          {otaStatus === 'ready' && (
            <button
              onClick={applyOnNextBoot}
              title="Aplicar no próximo boot"
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800/40"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    ) : null;

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
      <>
        <AuthScreen
          onLogin={() => {
            setIsAuthenticated(true);
            refreshData();
          }}
        />
        {otaReadyToast}
      </>
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
                onOpenNotifications={() => setIsNotificationModalOpen(true)}
              />
            </div>
          </div>

          {/* TAB 1: VIAGENS / RACHAS */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y">
              <Viagens dataVersion={dataVersion} onDataChange={refreshData} />
            </div>
          </div>

          {/* TAB 2: CONTATOS (com Amigos e Grupos internos) */}
          <div className="w-full min-w-full h-full shrink-0 overflow-hidden">
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 pb-24 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y">
              <Amigos
                dataVersion={dataVersion}
                onDataChange={refreshData}
                subTab={amigosSubTab}
                onSubTabChange={setAmigosSubTab}
              />
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
          title={
            activeTab === 'amigos'
              ? amigosSubTab === 'grupos'
                ? 'Novo Grupo'
                : 'Adicionar Amigo'
              : 'Novo Racha'
          }
          className="fixed bottom-20 right-6 md:right-[max(1.5rem,calc(50%-22rem))] w-14 h-14 bg-[#2DD4BF] hover:bg-[#25b5a3] rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 transition-transform active:scale-95 z-40"
        >
          {activeTab === 'amigos' ? (
            amigosSubTab === 'grupos' ? (
              <div className="relative flex items-center justify-center">
                <Users size={24} className="text-[#05080f] stroke-[2.5px]" />
                <Plus size={14} className="text-[#05080f] stroke-[3px] -ml-1 -mt-3" />
              </div>
            ) : (
              <UserPlus size={26} className="text-[#05080f] stroke-[2.5px]" />
            )
          ) : (
            <Plus size={32} className="text-[#05080f] stroke-[2.5px]" />
          )}
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

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onDataChange={refreshData}
      />

      {/* Toast suave de Atualização OTA Pronta (3 segundos / próximo boot) */}
      {otaReadyToast}

      {/* Toast flutuante de notificação em tempo real */}
      {inAppToast && (
        <div
          onClick={() => {
            setIsNotificationModalOpen(true);
            setInAppToast(null);
          }}
          className="fixed top-4 left-4 right-4 max-w-md mx-auto z-50 bg-[#141a23]/95 border border-[#2DD4BF]/50 rounded-2xl p-3.5 shadow-2xl flex items-start gap-3 cursor-pointer animate-fade-in backdrop-blur-md"
        >
          <div className="w-8 h-8 rounded-xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center shrink-0 mt-0.5 border border-[#2DD4BF]/30">
            <Bell size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{inAppToast.title}</p>
            <p className="text-xs text-gray-300 line-clamp-2 mt-0.5 leading-relaxed">
              {inAppToast.message}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInAppToast(null);
            }}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800/40"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
