import { Redirect, Tabs } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
  const stage = useAuthStore((s) => s.stage);

  if (stage !== 'ready') {
    const href =
      stage === 'anonymous'
        ? '/(auth)/welcome'
        : stage === 'no-profile'
          ? '/onboarding/profile'
          : '/onboarding/create-rumah';
    return <Redirect href={href} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pine,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.card },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="piket" options={{ title: 'Piket' }} />
      <Tabs.Screen name="tagihan" options={{ title: 'Tagihan' }} />
      <Tabs.Screen name="swap" options={{ title: 'Swap' }} />
    </Tabs>
  );
}