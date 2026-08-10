import { useEffect, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useAnimatedValue,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme/colors';

/**
 * Bottom sheet dengan animasi smooth: backdrop fade-in + sheet naik dari bawah
 * (rise). Memakai `animationType="none"` lalu menganimasikan sendiri — lebih
 * halus daripada `animationType="slide"` yang backdrop-nya langsung muncul.
 */
export function AnimatedSheet({
  visible,
  onClose,
  sheetStyle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const fade = useAnimatedValue(0);
  const rise = useAnimatedValue(0);

  useEffect(() => {
    fade.setValue(0);
    rise.setValue(0);
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rise, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fade, rise]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={styles.backdropPress} onPress={onClose}>
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              {
                transform: [
                  {
                    translateY: rise.interpolate({
                      inputRange: [0, 1],
                      outputRange: [640, 0],
                    }),
                  },
                ],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {children}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 26, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropPress: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
  },
});
