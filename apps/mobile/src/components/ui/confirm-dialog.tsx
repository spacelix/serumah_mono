import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies } from '@/theme/typography';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
  /** Single-action info dialog: hides Batal, auto-fills cancel on dismiss. */
  single?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Konfirmasi aksi sesuai Serumah.html: scrim gelap + kartu riseIn
 * (bukan Alert bawaan). Tombol aksi bisa berwarna danger (brick outline).
 * Animasi terbuka (rise-in) dan tertutup (drop-out + fade).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  danger = false,
  busy = false,
  single = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const rise = useMemo(() => new Animated.Value(0), []);
  const fade = useMemo(() => new Animated.Value(0), []);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      rise.setValue(0);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(rise, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, rise, fade]);

  useEffect(() => {
    if (!visible && mounted) {
      Animated.parallel([
        Animated.timing(rise, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible, mounted, rise, fade]);

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: rise,
              transform: [
                { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
              ],
            },
          ]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttons}>
            {!single && (
              <Pressable
                onPress={onCancel}
                disabled={busy}
                style={[styles.button, styles.buttonCancel]}>
                <Text style={styles.buttonCancelText}>{cancelText}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              style={[
                styles.button,
                single ? styles.buttonPrimary : danger ? styles.buttonDanger : styles.buttonPrimary,
                busy && styles.buttonBusy,
              ]}>
              <Text style={single ? styles.buttonPrimaryText : danger ? styles.buttonDangerText : styles.buttonPrimaryText}>
                {busy ? 'Memproses…' : confirmText}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 26, 23, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 18,
  },
  title: {
    fontFamily: fontFamilies.display[600],
    fontSize: 19,
    lineHeight: 24,
    color: colors.ink,
  },
  message: {
    marginTop: 6,
    fontFamily: fontFamilies.body[400],
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkSoft,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonCancelText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },
  buttonPrimary: {
    backgroundColor: colors.ink,
  },
  buttonPrimaryText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  buttonDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.brick,
  },
  buttonDangerText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.brick,
  },
  buttonBusy: {
    opacity: 0.6,
  },
});
