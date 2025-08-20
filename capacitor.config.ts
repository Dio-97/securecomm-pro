import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.securecomm.app',
  appName: 'SecureComm Pro',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  }
};

export default config;