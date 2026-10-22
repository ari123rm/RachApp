// src/services/socket.ts
import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl, syncWithBackend } from './database';
import { queryOne } from './sqlite';
import type { AppNotification } from '../types';

let socket: Socket | null = null;
let notificationListeners: Array<(notif: AppNotification) => void> = [];

function getWebSocketUrl(): string {
  const apiUrl = getApiBaseUrl();
  // Remove /api ou /api/ do final para conectar na raiz do servidor HTTP/WS
  return apiUrl.replace(/\/api\/?$/, '');
}

export async function initSocket(): Promise<Socket | null> {
  if (socket && socket.connected) {
    return socket;
  }

  try {
    const session = await queryOne<{ token: string }>('SELECT token FROM auth_session WHERE id = 1');
    if (!session?.token) {
      return null;
    }

    if (socket) {
      socket.disconnect();
      socket = null;
    }

    const wsUrl = getWebSocketUrl();
    socket = io(wsUrl, {
      auth: { token: session.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🔌 [Socket.io] Conectado ao servidor para sincronização em tempo real');
    });

    // Recebe sinal de que algum dado foi alterado no backend e invalida o cache local
    socket.on('sync:invalidate', (payload) => {
      console.log('🔄 [Socket.io] Invalidação recebida do servidor:', payload);
      syncWithBackend(true).catch((err) => {
        console.warn('Erro na sincronização disparada pelo WebSocket:', err);
      });
    });

    // Recebe notificação nova em tempo real
    socket.on('notification:new', (notif: AppNotification) => {
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

    socket.on('disconnect', (reason) => {
      console.log('❌ [Socket.io] Desconectado:', reason);
    });

    return socket;
  } catch (err) {
    console.warn('Aviso ao inicializar WebSocket:', err);
    return null;
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function onSocketNotification(callback: (notif: AppNotification) => void): () => void {
  notificationListeners.push(callback);
  return () => {
    notificationListeners = notificationListeners.filter((fn) => fn !== callback);
  };
}
