import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { SplashScreen as SerumahSplash } from '@/components/splash/splash-screen';
import { UpdateDialog } from '@/components/update/update-dialog';
import { useUpdateCheck } from '@/hooks/use-update-check';
import { useAuthStore } from '@/stores/auth-store';
import { useSerumahFonts } from '@/theme/typography';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const fontsLoaded = useSerumahFonts();
  const { decision, checking, dismissed, dismiss } = useUpdateCheck();
  const stage = useAuthStore((s) => s.stage);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate().finally(() => {
      void SplashScreen.hideAsync();
    });
  }, [hydrate]);

  if (!fontsLoaded) {
    return <SerumahSplash />;
  }

  const updateVisible = decision.type !== 'uptodate';
  const manifest = decision.type !== 'uptodate' ? decision.manifest : null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {stage === 'checking' ? (
          <SerumahSplash />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
          </Stack>
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
    </QueryClientProvider>
  );
}