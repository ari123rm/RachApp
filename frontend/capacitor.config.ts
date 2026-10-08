import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ariel.rachapp',
  appName: 'Rachapp',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'body', // Isso faz o app inteiro encolher quando o teclado sobe
      resizeOnFullScreen: true,
    },
  },
};

export default config;
