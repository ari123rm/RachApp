import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });

  // Middleware de autenticação do Socket
  io.use((socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!authHeader) {
        return next(new Error('Token não fornecido para conexão WebSocket.'));
      }

      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader;

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; name?: string };
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Falha na autenticação do WebSocket.'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    if (userId) {
      // Cada usuário se conecta em sua sala exclusiva
      socket.join(`user:${userId}`);
    }

    socket.on('disconnect', (reason) => {
      // Só loga desconexões anormais (evita flood com navegação rápida ou fechamento de aba)
      if (reason !== 'client namespace disconnect' && reason !== 'transport close') {
        if (userId) {
          console.log(`[Socket.io] Usuário ${userId} desconectado (${reason})`);
        }
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Emite um evento diretamente para um usuário específico
 */
export function emitToUser(userId: string, event: string, payload: any): boolean {
  if (!io) return false;
  io.to(`user:${userId}`).emit(event, payload);
  return true;
}

/**
 * Notifica o app do usuário para invalidar o cache e puxar dados novos do backend
 */
export function notifySync(userId: string, reason?: string): boolean {
  if (!io) return false;
  io.to(`user:${userId}`).emit('sync:invalidate', {
    reason: reason || 'DATA_CHANGED',
    timestamp: new Date().toISOString(),
  });
  return true;
}
