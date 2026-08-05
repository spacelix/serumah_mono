import { Platform } from 'react-native';

export const fonts = {
  display: Platform.select({
    ios: 'sans-serif',
    android: 'sans-serif',
    web: "'Space Grotesk'",
  }),
  body: Platform.select({
    ios: 'sans-serif',
    android: 'sans-serif',
    web: 'Inter',
  }),
  mono: Platform.select({
    ios: 'ui-monospace',
    android: 'monospace',
    web: 'JetBrains Mono',
  }),
} as const;