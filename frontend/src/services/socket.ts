// src/services/socket.ts
import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl, syncWithBackend } from './database';
import { queryOne } from './sqlite';
import type { AppNotification } from '../types';

let socket: Socket | null = null;
let initPromise: Promise<Socket | null> | null = null;
let notificationListeners: Array<(notif: AppNotification) => void> = [];

function getWebSocketUrl(): string {
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace(/\/api\/?$/, '');
}

export function initSocket(): Promise<Socket | null> {
  // Se o socket já existe e está conectado (ou conectando), não reconecta
  if (socket && !socket.disconnected) {
    return Promise.resolve(socket);
  }

  // Se já há uma inicialização em andamento, retorna a mesma Promise
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const session = await queryOne<{ token: string }>('SELECT token FROM auth_session WHERE id = 1');
      if (!session?.token) {
        return null;
      }

      // Se enquanto esperava a query o socket foi criado, reutiliza
      if (socket && !socket.disconnected) {
        return socket;
      }

      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
      }

      const wsUrl = getWebSocketUrl();
      const newSocket = io(wsUrl, {
        auth: { token: session.token },
        transports: ['websocket'], // Conexão direta via WebSocket puro (evita o ciclo de polling -> upgrade)
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2500,
        reconnectionDelayMax: 10000,
      });

      socket = newSocket;

      newSocket.on('connect', () => {
        console.log('🔌 [Socket.io] Conectado ao servidor');
      });

      // Recebe sinal de que algum dado foi alterado no backend e invalida o cache local
      newSocket.on('sync:invalidate', (payload) => {
        console.log('🔄 [Socket.io] Invalidação recebida do servidor:', payload);
        syncWithBackend(true).catch((err) => {
          console.warn('Erro na sincronização disparada pelo WebSocket:', err);
        });
      });

      // Recebe notificação nova em tempo real
      newSocket.on('notification:new', (notif: AppNotification) => {
        console.log('🔔 [Socket.io] Nova notificação recebida:', notif);

        // Puxa snapshot atualizado
        syncWithBackend(true).catch(() => {});

        // Dispara para ouvintes da interface (ex: toast na tela)
        notificationListeners.forEach((fn) => {
          try {
            fn(notif);
          } catch (e) {
            console.warn('Erro no callback de notificação:', e);
          }
        });
      });

      newSocket.on('disconnect', (reason) => {
        if (reason !== 'io client disconnect') {
          console.log('❌ [Socket.io] Desconectado:', reason);
        }
      });

      return newSocket;
    } catch (err) {
      console.warn('Aviso ao inicializar WebSocket:', err);
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  initPromise = null;
}

export function onSocketNotification(callback: (notif: AppNotification) => void): () => void {
  notificationListeners.push(callback);
  return () => {
    notificationListeners = notificationListeners.filter((fn) => fn !== callback);
  };
}
