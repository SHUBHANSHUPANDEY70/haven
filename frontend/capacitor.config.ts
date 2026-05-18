import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.havencafe.pos',
  appName: 'Haven Cafe POS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
