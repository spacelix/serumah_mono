import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { UpdateDialog } from '@/components/update/update-dialog';
import { useUpdateCheck } from '@/hooks/use-update-check';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { decision, checking, dismissed, dismiss } = useUpdateCheck();

  const updateVisible = decision.type !== 'uptodate';
  const manifest = decision.type !== 'uptodate' ? decision.manifest : null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
      {manifest && (
        <UpdateDialog
          visible={!checking && !dismissed && updateVisible}
          force={decision.type === 'force'}
          manifest={manifest}
          onDismiss={dismiss}
        />
      )}
    </ThemeProvider>
  );
}
