import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ariel.rachapp',
  appName: 'RachApp',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    CapacitorUpdater: {
      // Desabilita o auto-update nativo do Capgo Cloud (gerenciamento manual Self-Hosted via GitHub Releases)
      autoUpdate: false,
      // Desabilita telemetria externa para garantir funcionamento 100% offline-first e privado
      statsUrl: '',
      // Quando um novo APK for instalado manualmente por cima, reseta os bundles OTA antigos
      resetWhenUpdate: true,
      // Remove automaticamente bundles corrompidos ou que falharam ao iniciar
      autoDeleteFailed: true,
      // Remove bundles antigos após aplicar um novo com sucesso para economizar armazenamento
      autoDeletePrevious: true,
      // Timeout (ms) para o JS chamar CapacitorUpdater.notifyAppReady().
      // Caso o bundle baixado esteja corrompido e não inicialize em 10s, faz rollback automático para o APK nativo (builtin)
      appReadyTimeout: 10000,
    },
  },
};

export default config;
