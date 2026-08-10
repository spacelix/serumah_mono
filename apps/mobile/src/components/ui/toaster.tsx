import { Check, Info, TriangleAlert } from 'lucide-react-native';
import { Animated, StyleSheet, Text } from 'react-native';

import { useToastStore, type ToastItem } from '@/stores/toast-store';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { radius } from '@/theme/radius';
import { useEffect, useMemo } from 'react';

const ICON_SIZE = 15;

function ToastRow({ item }: { item: ToastItem }) {
  const progress = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const icon =
    item.type === 'success' ? (
      <Check color={colors.pine} size={ICON_SIZE} strokeWidth={2.6} />
    ) : item.type === 'error' ? (
      <TriangleAlert color={colors.brick} size={ICON_SIZE} strokeWidth={2.6} />
    ) : (
      <Info color={colors.inkSoft} size={ICON_SIZE} strokeWidth={2.6} />
    );

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {icon}
      <Text style={styles.message}>{item.message}</Text>
    </Animated.View>
  );
}

/**
 * Tumpukan toast di bagian atas layar, sesuai palet Serumah.
 * Dipanggil via `toast.success / toast.error / toast.info`.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <Animated.View style={styles.stack} pointerEvents="none">
      {toasts.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    top: 54,
    left: 20,
    right: 20,
    gap: 8,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#141A17',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  message: {
    flex: 1,
    fontFamily: fontFamilies.body[500],
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink,
  },
});
