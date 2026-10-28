import { prisma } from '../config/db';
import { emitToUser, notifySync } from './socket.service';
import { PushService } from './Push.service';

export interface CreateNotificationDTO {
  userId: string;
  type: 'EXPENSE_ADDED' | 'PAYMENT_RECEIVED' | 'GROUP_INVITE' | string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export class NotificationService {
  /**
   * Cria uma notificação no banco de dados e dispara em tempo real via Socket.io
   */
  static async createNotification(dto: CreateNotificationDTO) {
    try {
      const notification = await prisma.notification.create({
        data: {
          user_id: dto.userId,
          type: dto.type,
          title: dto.title,
          message: dto.message,
          data: dto.data ? (dto.data as any) : undefined,
          read: false,
        },
      });

      // Emite o evento de nova notificação para o usuário em tempo real (app aberto)
      emitToUser(dto.userId, 'notification:new', notification);

      // Dispara a sinalização para o frontend puxar os dados atualizados (auto-sync)
      notifySync(dto.userId, dto.type);

      // Dispara Push Notification via Firebase FCM (app em segundo plano ou fechado)
      PushService.sendPushToUser(dto.userId, {
        title: dto.title,
        body: dto.message,
        data: {
          type: dto.type,
          notificationId: notification.id,
          ...(dto.data
            ? Object.fromEntries(
                Object.entries(dto.data).map(([k, v]) => [
                  k,
                  typeof v === 'object' ? JSON.stringify(v) : String(v),
                ])
              )
            : {}),
        },
      }).catch((err) => {
        console.warn('Aviso ao disparar push notification:', err);
      });

      return notification;
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      // Fallback: mesmo se o registro falhar, tenta avisar o socket para sincronizar
      notifySync(dto.userId, dto.type);
      return null;
    }
  }

  /**
   * Lista as notificações do usuário, ordenadas pelas mais recentes
   */
  static async listNotifications(userId: string, limit = 50) {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { user_id: userId, read: false },
      }),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  /**
   * Marca uma notificação individual como lida
   */
  static async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        user_id: userId,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Marca como lidas todas as notificações relacionadas a uma despesa específica
   */
  static async markAsReadByExpense(userId: string, expenseId: string) {
    const unread = await prisma.notification.findMany({
      where: {
        user_id: userId,
        read: false,
      },
    });

    const idsToMark = unread
      .filter((n: any) => {
        if (!n.data) return false;
        try {
          const d = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
          return d?.expenseId === expenseId || d?.expense_id === expenseId;
        } catch {
          return false;
        }
      })
      .map((n) => n.id);

    if (idsToMark.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: idsToMark },
          user_id: userId,
        },
        data: {
          read: true,
        },
      });
    }

    return idsToMark;
  }

  /**
   * Marca todas as notificações do usuário como lidas
   */
  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        user_id: userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Deleta uma notificação
   */
  static async deleteNotification(userId: string, notificationId: string) {
    return prisma.notification.deleteMany({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });
  }

  /**
   * Atualiza o FCM Token do aparelho do usuário (para push notifications)
   */
  static async updateFcmToken(userId: string, fcmToken: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { fcm_token: fcmToken },
    });
  }
}
