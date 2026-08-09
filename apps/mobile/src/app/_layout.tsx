import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { SplashScreen as SerumahSplash } from '@/components/splash/splash-screen';
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

  useEffect(() => {
    let cancelled = false;
    // Hold the branded splash long enough for the riseIn + wordmark animation
    // to read (design intent), even when fonts/API resolve instantly.
    const minimum = new Promise<void>((resolve) => setTimeout(resolve, 2400));
    void Promise.all([hydrate(), minimum, apiCheckHealth()]).then(() => {
      if (!cancelled) {
        setReady(true);
        void SplashScreen.hideAsync();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  if (!fontsLoaded || !ready) {
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
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
});
