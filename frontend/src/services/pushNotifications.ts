// src/services/pushNotifications.ts
import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Channel } from '@capacitor/push-notifications';
import { api, syncWithBackend } from './api';

let isPushInitialized = false;

export async function initPushNotifications(): Promise<void> {
  // Push Notifications nativas só rodam no Android / iOS via Capacitor
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  if (isPushInitialized) {
    return;
  }

  try {
    // 1. Cria canal de notificação no Android para som e prioridade alta
    if (Capacitor.getPlatform() === 'android') {
      const channel: Channel = {
        id: 'rachapp_notifications',
        name: 'RachApp Notificações',
        description: 'Alertas de novos rachas, pagamentos recebidos e grupos',
        importance: 5, // IMPORTANCE_HIGH
        visibility: 1, // VISIBILITY_PUBLIC
        sound: 'default',
        vibration: true,
      };

      try {
        await PushNotifications.createChannel(channel);
      } catch (channelErr) {
        console.warn('Aviso ao criar canal de notificação:', channelErr);
      }
    }

    // 2. Verifica e solicita permissão
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('ℹ️ Permissão para Push Notifications não foi concedida pelo usuário.');
      return;
    }

    // 3. Remove listeners anteriores se houver
    await PushNotifications.removeAllListeners();

    // 4. Listener de registro (recebe o FCM Token do Google)
    await PushNotifications.addListener('registration', async (token) => {
      console.log('📲 [Capacitor Push] Token FCM registrado com sucesso:', token.value);
      try {
        await api.post('/notifications/fcm-token', { fcmToken: token.value });
      } catch (apiErr) {
        console.warn('Falha ao enviar FCM Token para o servidor:', apiErr);
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('⚠️ [Capacitor Push] Erro ao registrar no FCM:', error);
    });

    // 5. Notificação recebida com o app em primeiro plano
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('🔔 [Capacitor Push] Notificação recebida em foreground:', notification);
      syncWithBackend(true).catch(() => {});
    });

    // 6. Usuário tocou na notificação na barra do sistema operacional
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 [Capacitor Push] Notificação tocada pelo usuário:', action);
      syncWithBackend(true).catch(() => {});
    });

    // 7. Efetua o registro no Firebase Messaging
    await PushNotifications.register();
    isPushInitialized = true;
  } catch (err) {
    console.warn('Aviso ao inicializar Push Notifications:', err);
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await PushNotifications.removeAllListeners();
    isPushInitialized = false;
  } catch {
    // Ignora erro ao desregistrar
  }
}
