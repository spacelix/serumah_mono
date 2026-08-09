import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { SplashScreen as SerumahSplash } from '@/components/splash/splash-screen';
import { AppDialog } from '@/components/ui/app-dialog';
import { PhotoPreview } from '@/components/ui/photo-preview';
import { Toaster } from '@/components/ui/toaster';
import { UpdateDialog } from '@/components/update/update-dialog';
import { useUpdateCheck } from '@/hooks/use-update-check';
import { apiCheckHealth } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { useSerumahFonts } from '@/theme/typography';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const fontsLoaded = useSerumahFonts();
  const { decision, checking, dismissed, dismiss } = useUpdateCheck();
  const stage = useAuthStore((s) => s.stage);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);
  const [holdDone, setHoldDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!fontsLoaded) return;
    // Load auth + health behind the NATIVE splash (still covering). The branded
    // SerumahSplash is NOT mounted yet — its riseIn/wordmark must play while
    // visible, not hidden behind the native splash.
    void Promise.all([hydrate(), apiCheckHealth()]).then(() => {
      if (cancelled) return;
      setReady(true);
      requestAnimationFrame(() => void SplashScreen.hideAsync());
    });
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, hydrate]);

  useEffect(() => {
    if (!ready || holdDone) return;
    // Hold the branded splash long enough for the riseIn + wordmark animation
    // to read (design intent), even when everything resolved instantly.
    const t = setTimeout(() => setHoldDone(true), 2400);
    return () => clearTimeout(t);
  }, [ready, holdDone]);

  if (!ready) {
    // While behind the native splash render a plain matching backdrop — the
    // branded `<SerumahSplash />` mounts only at reveal so its riseIn/wordmark
    // animation actually plays on screen.
    return <View style={styles.splashBackdrop} />;
  }

  if (!holdDone) {
    // Native splash just hid — show the branded splash fresh so the riseIn +
    // wordmark animation reads before the app slides in.
    return <SerumahSplash />;
  }

  const updateVisible = decision.type !== 'uptodate';
  const manifest = decision.type !== 'uptodate' ? decision.manifest : null;

  // Theme background must match the app canvas (colors.paper) or the native
  // stack shows a white card flash behind screens during slide transitions.
  const serumahTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.paper,
      card: colors.paper,
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={colorScheme === 'dark' ? DarkTheme : serumahTheme}
      >
        {stage === 'checking' ? (
          <SerumahSplash />
        ) : (
          <View style={styles.root}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.paper },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="rumah/manage" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </View>
        )}
        {manifest && (
          <UpdateDialog
            visible={!checking && !dismissed && updateVisible}
            force={decision.type === 'force'}
            manifest={manifest}
            onDismiss={dismiss}
          />
        )}
      </ThemeProvider>
      <Toaster />
      <PhotoPreview />
      <AppDialog />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  splashBackdrop: { flex: 1, backgroundColor: colors.splashGreen },
});
