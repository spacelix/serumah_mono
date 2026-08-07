import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';

export default function AuthLayout() {
  const stage = useAuthStore((s) => s.stage);

  if (stage === 'checking') {
    return null;
  }

  if (stage !== 'anonymous') {
    const href =
      stage === 'ready'
        ? '/(tabs)'
        : stage === 'no-profile'
          ? '/onboarding/profile'
          : '/onboarding/create-rumah';
    return <Redirect href={href} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
