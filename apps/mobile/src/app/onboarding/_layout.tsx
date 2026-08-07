import { Redirect, Stack, usePathname } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';

export default function OnboardingLayout() {
  const stage = useAuthStore((s) => s.stage);
  const pathname = usePathname();

  if (stage === 'checking') {
    return null;
  }

  if (stage === 'anonymous') {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (stage === 'ready') {
    return <Redirect href="/(tabs)" />;
  }

  if (stage === 'no-profile' && pathname !== '/onboarding/profile') {
    return <Redirect href="/onboarding/profile" />;
  }

  if (stage === 'no-rumah' && pathname === '/onboarding/profile') {
    return <Redirect href="/onboarding/create-rumah" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="profile" />
      <Stack.Screen name="create-rumah" />
      <Stack.Screen name="join-rumah" />
    </Stack>
  );
}