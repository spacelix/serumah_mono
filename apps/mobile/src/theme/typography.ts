import { useFonts as useExpoFonts } from 'expo-font';

/**
 * Google font families bundled locally under `assets/fonts/` (copied from the
 * `@expo-google-fonts/*` packages, which Metro can't resolve through bun's
 * `.bun` store). Each weight is its own family name, so `fontWeight` is NOT
 * used to select — pick the exact weight family here.
 */
const fontAssets = {
  SpaceGrotesk_400Regular: require('@/assets/fonts/SpaceGrotesk_400Regular.ttf'),
  SpaceGrotesk_500Medium: require('@/assets/fonts/SpaceGrotesk_500Medium.ttf'),
  SpaceGrotesk_600SemiBold: require('@/assets/fonts/SpaceGrotesk_600SemiBold.ttf'),
  SpaceGrotesk_700Bold: require('@/assets/fonts/SpaceGrotesk_700Bold.ttf'),
  Inter_400Regular: require('@/assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('@/assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@/assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@/assets/fonts/Inter_700Bold.ttf'),
  JetBrainsMono_400Regular: require('@/assets/fonts/JetBrainsMono_400Regular.ttf'),
  JetBrainsMono_500Medium: require('@/assets/fonts/JetBrainsMono_500Medium.ttf'),
  JetBrainsMono_600SemiBold: require('@/assets/fonts/JetBrainsMono_600SemiBold.ttf'),
  JetBrainsMono_700Bold: require('@/assets/fonts/JetBrainsMono_700Bold.ttf'),
} as const;

/**
 * Google font families loaded at runtime via `@expo-google-fonts/*`.
 * Each weight is its own family name (the SDK's convention), so `fontWeight`
 * is NOT used to select — pick the exact weight family here.
 */
export const fontFamilies = {
  display: {
    400: 'SpaceGrotesk_400Regular',
    500: 'SpaceGrotesk_500Medium',
    600: 'SpaceGrotesk_600SemiBold',
    700: 'SpaceGrotesk_700Bold',
  },
  body: {
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
  },
  mono: {
    400: 'JetBrainsMono_400Regular',
    500: 'JetBrainsMono_500Medium',
    600: 'JetBrainsMono_600SemiBold',
    700: 'JetBrainsMono_700Bold',
  },
} as const;

export const fonts = {
  display: fontFamilies.display[600],
  body: fontFamilies.body[400],
  mono: fontFamilies.mono[400],
} as const;

export type FontFamilies = typeof fontFamilies;

export function useSerumahFonts() {
  const [loaded, error] = useExpoFonts(fontAssets);
  if (error) {
    console.warn('[typography] font load failed:', error);
  }
  return Boolean(loaded);
}

export const type = {
  /** Screen H1 header — Space Grotesk 600 · 25px/1.1 · -0.02em */
  display: {
    fontFamily: fontFamilies.display[600],
    fontSize: 25,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  /** Section heading — Space Grotesk 600 · 13–15.5px */
  section: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.14,
  },
  /** Large amount — mono 700 · 22–26px · -0.02em */
  amountLg: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.52,
  },
  /** Medium amount — mono 700 · 18px */
  amountMd: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.36,
  },
  /** Strong label — Inter 600 · 13px */
  labelStrong: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13,
    lineHeight: 18,
  },
  /** Body — Inter 400/500 · 11px */
  body: { fontFamily: fontFamilies.body[500], fontSize: 11, lineHeight: 16 },
  /** Button label — Inter 600 · 12.5–14px */
  button: {
    fontFamily: fontFamilies.body[600],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
  },
  /** Kicker / eyebrow — mono 500 · 10.5px · +0.14em uppercase */
  kicker: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10.5,
    lineHeight: 14.7,
    letterSpacing: 1.47,
    textTransform: 'uppercase',
  },
  /** Stamp cap — Space Grotesk 700 · 10px · +0.11em */
  stamp: {
    fontFamily: fontFamilies.display[700],
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
} as const;
