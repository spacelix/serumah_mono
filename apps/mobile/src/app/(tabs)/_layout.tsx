import { Redirect, Tabs } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { TabIcon, type TabIconName } from '@/components/ui/tab-icon';

const TABS: Array<{ name: string; label: string; icon: TabIconName }> = [
  { name: 'index', label: 'Beranda', icon: 'beranda' },
  { name: 'piket', label: 'Piket', icon: 'piket' },
  { name: 'tagihan', label: 'Tagihan', icon: 'tagihan' },
  { name: 'swap', label: 'Swap', icon: 'swap' },
] as const;

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[colors.paper, `${colors.paper}00`]}
      locations={[0.62, 1]}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={[styles.gradient, { paddingBottom: insets.bottom + 22 }]}
      pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = TABS[index] ?? TABS[0];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={`Tab ${tab.label}`}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              style={[styles.tab, focused && styles.tabActive]}>
              <View style={styles.iconWrap}>
                <TabIcon
                  name={tab.icon}
                  size={21}
                  color={focused ? colors.paper : colors.inkSoft}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  focused ? styles.labelActive : styles.labelInactive,
                ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </LinearGradient>
  );
}

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
      screenOptions={{ headerShown: false, tabBarShowLabel: false }}
      tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="piket" options={{ title: 'Piket' }} />
      <Tabs.Screen name="tagihan" options={{ title: 'Tagihan' }} />
      <Tabs.Screen name="swap" options={{ title: 'Swap' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 4,
  },
  bar: {
    gap: 4,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    cursor: 'pointer',
    borderWidth: 0,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 5,
  },
  tabActive: {
    backgroundColor: colors.ink,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamilies.body[600],
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: 0.19,
  },
  labelActive: {
    color: colors.paper,
  },
  labelInactive: {
    color: colors.inkSoft,
  },
});