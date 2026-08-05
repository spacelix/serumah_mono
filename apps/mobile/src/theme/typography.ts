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

export const type = {
  /** Screen H1 header — Space Grotesk 600 · 25px/1.1 · -0.02em */
  display: { fontFamily: fonts.display, fontWeight: '600', fontSize: 25, lineHeight: 28, letterSpacing: -0.5 },
  /** Section heading — Space Grotesk 600 · 13–15.5px */
  section: { fontFamily: fonts.display, fontWeight: '600', fontSize: 14, lineHeight: 19, letterSpacing: -0.14 },
  /** Large amount — mono 700 · 22–26px · -0.02em */
  amountLg: { fontFamily: fonts.mono, fontWeight: '700', fontSize: 26, lineHeight: 32, letterSpacing: -0.52 },
  /** Medium amount — mono 700 · 18px */
  amountMd: { fontFamily: fonts.mono, fontWeight: '700', fontSize: 18, lineHeight: 24, letterSpacing: -0.36 },
  /** Strong label — Inter 600 · 13px */
  labelStrong: { fontFamily: fonts.body, fontWeight: '600', fontSize: 13, lineHeight: 18 },
  /** Body — Inter 400/500 · 11px */
  body: { fontFamily: fonts.body, fontWeight: '400', fontSize: 11, lineHeight: 16 },
  /** Button label — Inter 600 · 12.5–14px */
  button: { fontFamily: fonts.body, fontWeight: '600', fontSize: 14, lineHeight: 20, letterSpacing: 0.14 },
  /** Kicker / eyebrow — mono 500 · 10px · +0.14em uppercase */
  kicker: { fontFamily: fonts.mono, fontWeight: '500', fontSize: 10, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase' },
  /** Stamp cap — Space Grotesk 700 · 10px · +0.11em */
  stamp: { fontFamily: fonts.display, fontWeight: '700', fontSize: 10, lineHeight: 13, letterSpacing: 1.1, textTransform: 'uppercase' },
} as const;