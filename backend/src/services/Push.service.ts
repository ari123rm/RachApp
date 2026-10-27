// src/services/Push.service.ts
import { prisma } from '../config/db';
import { getFirebaseApp } from '../config/firebase';
import { getMessaging } from 'firebase-admin/messaging';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class PushService {
  /**
   * Envia uma notificação push para um usuário específico pelo seu ID
   */
  static async sendPushToUser(userId: string, payload: PushPayload): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fcm_token: true },
      });

      if (!user || !user.fcm_token) {
        return false;
      }

      return this.sendPushToToken(userId, user.fcm_token, payload);
    } catch (err) {
      console.warn(`Erro ao consultar token para push do usuário ${userId}:`, err);
      return false;
    }
  }

  /**
   * Envia uma notificação push para um token FCM específico
   */
  static async sendPushToToken(userId: string | null, fcmToken: string, payload: PushPayload): Promise<boolean> {
    const app = getFirebaseApp();
    if (!app) {
      return false;
    }

    try {
      const messaging = getMessaging(app);
      const message = {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            channelId: 'rachapp_notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      };

      const response = await messaging.send(message);
      console.log(`[Push Notification] Enviado com sucesso para usuário ${userId || 'avulso'} (${response})`);
      return true;
    } catch (error: any) {
      const errorCode = error?.code || error?.errorInfo?.code;
      console.warn(`[Push Notification] Falha ao enviar para o token: ${errorCode || error.message}`);

      // Se o token foi invalidado ou o app foi desinstalado, limpa o token do banco
      if (
        userId &&
        (errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token')
      ) {
        try {
          await prisma.user.update({
            where: { id: userId },
            data: { fcm_token: null },
          });
          console.log(`[Push Notification] Token FCM inválido removido do usuário ${userId}`);
        } catch {
          // Ignora erro ao limpar
        }
      }

      return false;
    }
  }
}
