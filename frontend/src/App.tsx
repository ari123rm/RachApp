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
import { RideDetailsModal } from './components/RideDetailsModal';
import { useOtaUpdater } from './services/updateService';
import { App as CapApp } from '@capacitor/app';
import {
  dbService,
  initSocket,
  disconnectSocket,
  onSocketNotification,
  initPushNotifications,
  unregisterPushNotifications,
  onPushNotificationAction,
} from './services/api';
import { closeTopModal, closeAllModals } from './utils/modalBackHandler';
import { listenForSharedReceipt, clearSharedReceipt } from './utils/receiptShare';
import type { AppNotification, Corrida, Amigo } from './types';

const TABS = ['home', 'viagens', 'amigos', 'perfil'] as const;

function getHorizontalScrollParent(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  let el: HTMLElement | null = target;
  while (el && el !== document.body) {
    if (
      el.classList.contains('overflow-x-auto') ||
      el.getAttribute('data-horizontal-scroll') === 'true'
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
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
  const [selectedRideForModal, setSelectedRideForModal] = useState<Corrida | null>(null);
  const [amigosListForModal, setAmigosListForModal] = useState<Amigo[]>([]);
  const [filtroRachasExterno, setFiltroRachasExterno] = useState<
    'tudo' | 'a_pagar' | 'a_receber' | 'quitados'
  >('tudo');
  const lastSyncedRef = useRef<string | null>(null);

  const handleNavigateToRachas = (filtro: 'tudo' | 'a_pagar' | 'a_receber' | 'quitados') => {
    setFiltroRachasExterno(filtro);
    setActiveTab('viagens');
    tabScrollRefs.current.viagens?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenRideById = async (rideId: string) => {
    try {
      let corridas = await dbService.corridas.getAll();
      let ride = corridas.find((c) => c.id === rideId);

      // Se ainda não estiver no banco local (ex: notificação instantânea), faz sync
      if (!ride) {
        await dbService.sync.now();
        corridas = await dbService.corridas.getAll();
        ride = corridas.find((c) => c.id === rideId);
      }

      if (ride) {
        const amigos = await dbService.amigos.getAll();
        setAmigosListForModal(amigos);
        setSelectedRideForModal(ride);
        setIsNotificationModalOpen(false);
      }
    } catch (err) {
      console.warn('Erro ao abrir racha pela notificação:', err);
    }
  };

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
  const tabScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [isPullDragging, setIsPullDragging] = useState(false);
  const pullDistanceRef = useRef(0);
  pullDistanceRef.current = pullDistance;

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
    direction: 'undecided' | 'horizontal' | 'vertical' | 'pull-down' | 'slider-scroll';
    containerWidth: number;
    startTabIndex: number;
    canPullRefresh: boolean;
    scrollContainer?: HTMLElement | null;
    maxScrollLeft?: number;
  } | null>(null);
  const isTouchSwipingRef = useRef(false);

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
      if (
        st.state === 'synced' &&
        st.lastSyncedAt &&
        st.lastSyncedAt !== lastSyncedRef.current
      ) {
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

    const unsubPushAction = onPushNotificationAction(async ({ expenseId, notificationId }) => {
      if (notificationId) {
        dbService.notifications.markAsRead(notificationId).catch(() => {});
      }
      if (expenseId) {
        await handleOpenRideById(expenseId);
      }
    });

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
        initSocket();
        dbService.sync.now().catch(() => {});
      }
    })
      .then((h) => {
        appStateHandle = h;
      })
      .catch(() => {});

    let lastFocusSync = 0;
    const handleVisibility = () => {
      if (!document.hidden) {
        initSocket();
        const now = Date.now();
        // Evita sincronizações repetitivas ao focar que possam recriar a DOM no meio de um clique
        if (now - lastFocusSync > 15000) {
          lastFocusSync = now;
          dbService.sync.now().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('online', handleVisibility);

    // Sincronização periódica de segurança enquanto o app está aberto e ativo
    const syncInterval = setInterval(() => {
      if (!document.hidden) {
        dbService.sync.now().catch(() => {});
      }
    }, 25000);

    return () => {
      unsubNotif();
      unsubPushAction();
      clearInterval(syncInterval);
      if (appStateHandle && typeof appStateHandle.remove === 'function') {
        appStateHandle.remove();
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('online', handleVisibility);
    };
  }, [isAuthenticated]);

  // Ao trocar de aba, desfoca qualquer elemento ativo (ex: inputs em outras abas)
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [activeTab]);

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
    if (isTouchSwipingRef.current) {
      // Já foi transladado suavemente pelo finishTouchDrag, evita reiniciar o timer de transição
      isTouchSwipingRef.current = false;
      return;
    }
    trackRef.current.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
    trackRef.current.style.transform = `translate3d(-${tabIndex * 100}%, 0, 0)`;
  }, [tabIndex]);

  // Limpa o estilo de transição ao concluir para que a trilha volte a ser estática e não bloqueie cliques subsequentes
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.target === track && e.propertyName === 'transform') {
        track.style.transition = 'none';
      }
    };

    track.addEventListener('transitionend', handleTransitionEnd);
    return () => {
      track.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, []);

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

  // Se o usuário clicar no ícone da aba que já está aberta na navbar, rola suavemente para o topo
  const handleNavTabSelect = (tab: string) => {
    if (tab === activeTab) {
      const scrollEl = tabScrollRefs.current[tab];
      if (scrollEl) {
        scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    const onNavigateTab = (e: Event) => {
      const targetTab = (e as CustomEvent<string>).detail;
      if (targetTab) {
        setActiveTab((prev) => {
          if (prev === targetTab) {
            tabScrollRefs.current[targetTab]?.scrollTo({ top: 0, behavior: 'smooth' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return prev;
          }
          return targetTab;
        });
      }
    };
    window.addEventListener('rachapp:navigate-tab', onNavigateTab);
    return () => window.removeEventListener('rachapp:navigate-tab', onNavigateTab);
  }, []);

  const PULL_THRESHOLD = 52;

  // Arraste horizontal (entre abas) e vertical (pull-to-refresh manual no topo)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (isPullRefreshing) return;

    const scrollContainer = getHorizontalScrollParent(e.target);
    let hasOverflow = false;
    let maxScrollLeft = 0;

    if (scrollContainer) {
      maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
      // Considera com overflow se houver mais de 3px de conteúdo rolável
      hasOverflow = maxScrollLeft > 3;
    }

    const touch = e.touches[0];
    const width = containerRef.current?.clientWidth || window.innerWidth;
    const currentScrollEl = tabScrollRefs.current[activeTab];
    // Permite pull-to-refresh apenas se o conteúdo estiver no topo absoluto
    const canPullRefresh = !currentScrollEl || currentScrollEl.scrollTop <= 1;

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
      canPullRefresh,
      scrollContainer: hasOverflow ? scrollContainer : null,
      maxScrollLeft,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const drag = dragRef.current;
    if (!drag || !drag.active || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const dx = touch.clientX - drag.startX;
    const dy = touch.clientY - drag.startY;

    if (drag.direction === 'undecided') {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Limiar inicial para evitar que micro-movimentos do toque interfiram no clique
      if (absDx < 10 && absDy < 10) return;

      if (absDy > absDx * 1.2) {
        const currentScrollEl = tabScrollRefs.current[activeTab];
        const isCurrentlyAtTop = !currentScrollEl || currentScrollEl.scrollTop <= 1;

        // Só entra em pull-down com intenção clara para baixo no topo da tela
        if (dy > 18 && drag.canPullRefresh && isCurrentlyAtTop) {
          drag.direction = 'pull-down';
          setIsPullDragging(true);
        } else {
          drag.direction = 'vertical';
          drag.active = false;
          return;
        }
      } else if (absDx >= 14 && absDx > absDy * 1.25) {
        // Se o toque começou dentro de um slider/lista com rolagem horizontal ativa
        if (drag.scrollContainer && (drag.maxScrollLeft ?? 0) > 3) {
          const el = drag.scrollContainer;
          const currentScroll = el.scrollLeft;
          const isMovingRight = dx > 0;
          const isMovingLeft = dx < 0;

          // Pode rolar para a direita se o conteúdo não estiver no início
          const canScrollRight = currentScroll > 2;
          // Pode rolar para a esquerda se o conteúdo não estiver no fim
          const canScrollLeft = currentScroll < (drag.maxScrollLeft ?? 0) - 2;

          if ((isMovingRight && !canScrollRight) || (isMovingLeft && !canScrollLeft)) {
            // Slider já está no limite nesta direção! Transfere imediatamente para a troca de aba
            const isTryingOverscroll =
              (drag.startTabIndex === 0 && dx > 0) ||
              (drag.startTabIndex === TABS.length - 1 && dx < 0);

            if (isTryingOverscroll) {
              drag.active = false;
              return;
            }

            drag.direction = 'horizontal';
            if (trackRef.current) {
              trackRef.current.style.transition = 'none';
            }
          } else {
            // O slider tem conteúdo para rolar: permite rolagem nativa do slider
            drag.direction = 'slider-scroll';
          }
        } else {
          // Não é slider com overflow: troca de abas normal
          const isTryingOverscroll =
            (drag.startTabIndex === 0 && dx > 0) ||
            (drag.startTabIndex === TABS.length - 1 && dx < 0);

          if (isTryingOverscroll) {
            drag.active = false;
            return;
          }

          drag.direction = 'horizontal';
          if (trackRef.current) {
            trackRef.current.style.transition = 'none';
          }
        }
      } else {
        // Movimento ambíguo ou sutil: não sequestra o toque nem mexe na DOM
        return;
      }
    }

    // Se estiver em slider-scroll, monitora se o slider atingiu a extremidade durante o mesmo arraste
    if (drag.direction === 'slider-scroll' && drag.scrollContainer) {
      const el = drag.scrollContainer;
      const currentScroll = el.scrollLeft;
      const isMovingRight = dx > 0;
      const isMovingLeft = dx < 0;

      const canScrollRight = currentScroll > 2;
      const canScrollLeft = currentScroll < (drag.maxScrollLeft ?? 0) - 2;

      if ((isMovingRight && !canScrollRight) || (isMovingLeft && !canScrollLeft)) {
        const isTryingOverscroll =
          (drag.startTabIndex === 0 && dx > 0) ||
          (drag.startTabIndex === TABS.length - 1 && dx < 0);

        if (!isTryingOverscroll) {
          // Atingiu o limite do slider: transfere o controle suavemente para a troca de aba
          drag.direction = 'horizontal';
          drag.startX = touch.clientX;
          drag.lastX = touch.clientX;
          drag.lastTime = performance.now();
          if (trackRef.current) {
            trackRef.current.style.transition = 'none';
          }
        }
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
      const currentDx = touch.clientX - drag.startX;
      const isPastStart = drag.startTabIndex === 0 && currentDx > 0;
      const isPastEnd = drag.startTabIndex === TABS.length - 1 && currentDx < 0;
      const effectiveDx = isPastStart || isPastEnd ? currentDx * 0.22 : currentDx;

      const baseOffsetPx = -drag.startTabIndex * drag.containerWidth;
      trackRef.current.style.transform = `translate3d(${baseOffsetPx + effectiveDx}px, 0, 0)`;
    } else if (drag.direction === 'pull-down') {
      // Deadzone de 16px para evitar disparos acidentais ao mexer o dedo lentamente
      const pullRaw = Math.max(0, dy - 16);
      if (pullRaw > 0) {
        // Resistência progressiva com amortecimento elástico
        const dist = Math.min(68, Math.pow(pullRaw, 0.82) * 1.5);
        setPullDistance(dist);
      } else {
        setPullDistance(0);
      }
    }
  };

  const finishTouchDrag = async (e: React.TouchEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsPullDragging(false);
    if (!drag) return;

    if (drag.direction === 'pull-down') {
      const currentDist = pullDistanceRef.current;

      if (currentDist >= PULL_THRESHOLD) {
        setIsPullRefreshing(true);
        setPullDistance(PULL_THRESHOLD);

        try {
          const startTime = performance.now();
          await dbService.sync.now().catch((err) => {
            console.warn('Erro ao atualizar dados manualmente:', err);
          });
          refreshData();
          const elapsed = performance.now() - startTime;
          if (elapsed < 650) {
            await new Promise((res) => setTimeout(res, 650 - elapsed));
          }
        } finally {
          setIsPullRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
      return;
    }

    if (drag.direction === 'horizontal') {
      if (e.cancelable) {
        e.preventDefault();
      }

      const endX = e.changedTouches[0]?.clientX ?? drag.lastX;
      const dx = endX - drag.startX;
      const width = drag.containerWidth || window.innerWidth;
      const ratio = dx / width;
      const vx = drag.velocityX;

      let nextIndex = drag.startTabIndex;

      if ((ratio < -0.18 || (vx < -0.28 && dx < -20)) && drag.startTabIndex < TABS.length - 1) {
        nextIndex = drag.startTabIndex + 1;
      } else if ((ratio > 0.18 || (vx > 0.28 && dx > 20)) && drag.startTabIndex > 0) {
        nextIndex = drag.startTabIndex - 1;
      }

      if (trackRef.current) {
        trackRef.current.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
        trackRef.current.style.transform = `translate3d(-${nextIndex * 100}%, 0, 0)`;
      }

      if (nextIndex !== drag.startTabIndex) {
        isTouchSwipingRef.current = true;
        setActiveTab(TABS[nextIndex]);
      }
    }
  };

  // Toast suave de Atualização OTA Pronta (Blue-Green)
  const otaReadyToast =
    (otaStatus === 'ready' || otaStatus === 'applying') && readyBundle ? (
      <div className="fixed bottom-[calc(4rem+max(env(safe-area-inset-bottom,0px),12px)+0.875rem)] left-4 right-4 max-w-md mx-auto z-[95] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 shadow-lg animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
            {otaStatus === 'applying' ? (
              <RefreshCw size={18} strokeWidth={2} className="animate-spin" />
            ) : (
              <Sparkles size={18} strokeWidth={2} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] font-display">
              Nova atualização pronta! ({readyBundle.tagName})
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
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
                  className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <RefreshCw size={13} strokeWidth={2} />
                  Recarregar agora
                </button>
                <button
                  onClick={applyOnNextBoot}
                  className="bg-[var(--bg-subtle)] hover:opacity-80 text-[var(--text-secondary)] text-xs font-medium px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors border border-[var(--border-color)]"
                >
                  <Clock size={13} strokeWidth={2} />
                  No próximo boot
                </button>
              </div>
            )}
          </div>

          {otaStatus === 'ready' && (
            <button
              onClick={applyOnNextBoot}
              title="Aplicar no próximo boot"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-subtle)]"
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    ) : null;

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center text-[var(--primary)]">
        <LoaderCircle size={40} strokeWidth={2} className="animate-spin mb-3" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">Carregando seus dados...</p>
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
    <div className="h-[100dvh] bg-[var(--bg-app)] text-[var(--text-primary)] font-sans relative overflow-hidden flex flex-col">
      {/* Indicador de Pull-to-Refresh: ícone circular flutuante centralizado com rotação suave */}
      <div
        className="fixed top-0 left-0 right-0 flex justify-center z-[60] pointer-events-none"
        style={{
          paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        }}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-md transition-colors ${
            pullDistance >= PULL_THRESHOLD || isPullRefreshing
              ? 'bg-[var(--bg-surface)] border-[var(--primary)] text-[var(--primary)]'
              : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)]'
          }`}
          style={{
            transform: `translate3d(0, ${
              isPullRefreshing
                ? '16px'
                : pullDistance > 0
                ? `${Math.max(-56, pullDistance - 56)}px`
                : '-64px'
            }, 0)`,
            opacity: isPullRefreshing || pullDistance > 14 ? 1 : 0,
            transition: isPullDragging
              ? 'none'
              : 'transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 200ms ease, border-color 200ms ease, color 200ms ease',
          }}
        >
          <RefreshCw
            size={18}
            strokeWidth={2}
            className={isPullRefreshing ? 'animate-spin' : ''}
            style={{
              transform: isPullRefreshing
                ? 'none'
                : `rotate(${Math.min(360, (pullDistance / PULL_THRESHOLD) * 360)}deg)`,
              transition: isPullDragging ? 'none' : 'transform 200ms ease-out',
            }}
          />
        </div>
      </div>

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
          <div
            className={`w-full min-w-full h-full shrink-0 overflow-hidden ${
              activeTab === 'home' ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            <div
              data-tab-scroll="true"
              ref={(el) => {
                tabScrollRefs.current.home = el;
              }}
              className="w-full h-full overflow-y-auto px-4 sm:px-6 pb-[calc(8.5rem+max(env(safe-area-inset-bottom,0px),12px))] max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y overscroll-y-contain"
            >
              <Home
                dataVersion={dataVersion}
                onDataChange={refreshData}
                updateInfo={updateInfo}
                onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
                onOpenNotifications={() => setIsNotificationModalOpen(true)}
                onNavigateToRachas={handleNavigateToRachas}
                onNavigateToProfile={() => handleNavTabSelect('perfil')}
              />
            </div>
          </div>

          {/* TAB 1: VIAGENS / RACHAS */}
          <div
            className={`w-full min-w-full h-full shrink-0 overflow-hidden ${
              activeTab === 'viagens' ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            <div
              data-tab-scroll="true"
              ref={(el) => {
                tabScrollRefs.current.viagens = el;
              }}
              className="w-full h-full overflow-y-auto px-4 sm:px-6 pb-[calc(8.5rem+max(env(safe-area-inset-bottom,0px),12px))] max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y overscroll-y-contain"
            >
              <Viagens
                dataVersion={dataVersion}
                onDataChange={refreshData}
                filtroExterno={filtroRachasExterno}
                onFiltroExternoChange={setFiltroRachasExterno}
              />
            </div>
          </div>

          {/* TAB 2: CONTATOS (com Amigos e Grupos internos) */}
          <div
            className={`w-full min-w-full h-full shrink-0 overflow-hidden ${
              activeTab === 'amigos' ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            <div
              data-tab-scroll="true"
              ref={(el) => {
                tabScrollRefs.current.amigos = el;
              }}
              className="w-full h-full overflow-y-auto px-4 sm:px-6 pb-[calc(8.5rem+max(env(safe-area-inset-bottom,0px),12px))] max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y overscroll-y-contain"
            >
              <Amigos
                dataVersion={dataVersion}
                onDataChange={refreshData}
                subTab={amigosSubTab}
                onSubTabChange={setAmigosSubTab}
              />
            </div>
          </div>

          {/* TAB 3: PERFIL */}
          <div
            className={`w-full min-w-full h-full shrink-0 overflow-hidden ${
              activeTab === 'perfil' ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            <div
              data-tab-scroll="true"
              ref={(el) => {
                tabScrollRefs.current.perfil = el;
              }}
              className="w-full h-full overflow-y-auto px-4 sm:px-6 pb-[calc(6rem+max(env(safe-area-inset-bottom,0px),12px))] max-w-lg md:max-w-xl lg:max-w-2xl mx-auto scrollbar-hide touch-pan-y overscroll-y-contain"
            >
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
                onOpenNotifications={() => setIsNotificationModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={handleNavTabSelect} />

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
          className="fixed bottom-[calc(4rem+max(env(safe-area-inset-bottom,0px),12px)+0.875rem)] right-4 sm:right-6 md:right-[max(1.5rem,calc(50%-22rem))] w-14 h-14 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 z-40"
        >
          {activeTab === 'amigos' ? (
            amigosSubTab === 'grupos' ? (
              <div className="relative flex items-center justify-center">
                <Users size={22} strokeWidth={2} className="text-white" />
                <Plus size={14} strokeWidth={2.5} className="text-white -ml-1 -mt-3" />
              </div>
            ) : (
              <UserPlus size={24} strokeWidth={2} className="text-white" />
            )
          ) : (
            <Plus size={28} strokeWidth={2} className="text-white" />
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
          closeAllModals();
          setIsRideModalOpen(false);
          setIsFriendModalOpen(false);
          setIsGroupModalOpen(false);
          setIsNotificationModalOpen(false);
          setActiveTab('home');
          tabScrollRefs.current.home?.scrollTo({ top: 0, behavior: 'smooth' });
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
        onOpenRide={handleOpenRideById}
      />

      {/* Toast suave de Atualização OTA Pronta (3 segundos / próximo boot) */}
      {otaReadyToast}

      {/* Toast flutuante de notificação em tempo real */}
      {inAppToast && (
        <div
          onClick={async () => {
            const expenseId = inAppToast.data?.expenseId || inAppToast.data?.expense_id;
            if (inAppToast.id) {
              dbService.notifications.markAsRead(inAppToast.id).catch(() => {});
            }
            setInAppToast(null);
            if (expenseId) {
              await handleOpenRideById(expenseId);
            } else {
              setIsNotificationModalOpen(true);
            }
          }}
          className="fixed top-[max(0.75rem,env(safe-area-inset-top,0px))] left-4 right-4 max-w-md mx-auto z-50 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 shadow-lg flex items-start gap-3 cursor-pointer animate-fade-in"
        >
          <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Bell size={18} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] font-display truncate">
              {inAppToast.title}
            </p>
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-0.5 leading-relaxed">
              {inAppToast.message}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInAppToast(null);
            }}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-subtle)]"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Modal de Detalhes da Corrida aberto via Notificação */}
      <RideDetailsModal
        isOpen={!!selectedRideForModal}
        ride={selectedRideForModal || undefined}
        participantes={amigosListForModal.filter((a) =>
          selectedRideForModal?.participantesIds?.includes(a.id)
        )}
        onClose={() => setSelectedRideForModal(null)}
        onDelete={async (id) => {
          await dbService.corridas.delete(id);
          setSelectedRideForModal(null);
          refreshData();
        }}
        onUpdated={async () => {
          if (selectedRideForModal) {
            const all = await dbService.corridas.getAll();
            const fresh = all.find((c) => c.id === selectedRideForModal.id);
            if (fresh) setSelectedRideForModal(fresh);
          }
          refreshData();
        }}
      />
    </div>
  );
}

export default App;
