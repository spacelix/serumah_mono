import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

const STATUS_STYLE = {
  lunas: {
    bg: colors.pineSoft,
    color: colors.pineDeep,
    border: colors.pineDeep,
  },
  approved: {
    bg: colors.pineSoft,
    color: colors.pineDeep,
    border: colors.pineDeep,
  },
  belum_bayar: {
    bg: colors.brickSoft,
    color: colors.brickDeep,
    border: colors.brickDeep,
  },
  ditolak: {
    bg: colors.brickSoft,
    color: colors.brickDeep,
    border: colors.brickDeep,
  },
  menunggu_konfirmasi: {
    bg: colors.mustardSoft,
    color: colors.mustardInk,
    border: colors.mustardInk,
  },
  pending: {
    bg: colors.mustardSoft,
    color: colors.mustardInk,
    border: colors.mustardInk,
  },
  menunggu: {
    bg: colors.mustardSoft,
    color: colors.mustardInk,
    border: colors.mustardInk,
  },
} as const;

type StatusKey = keyof typeof STATUS_STYLE;

function statusKey(status: string): StatusKey {
  if (status in STATUS_STYLE) return status as StatusKey;
  return 'pending';
}

function labelOf(status: string): string {
  switch (status) {
    case 'lunas':
    case 'approved':
      return 'LUNAS';
    case 'belum_bayar':
      return 'BELUM BAYAR';
    case 'menunggu_konfirmasi':
      return 'MENUNGGU KONFIRMASI';
    case 'ditolak':
      return 'DITOLAK';
    default:
      return 'MENUNGGU';
  }
}

export function Stamp({ status, animate }: { status: string; animate?: boolean }) {
  const key = statusKey(status);
  const s = STATUS_STYLE[key];
  const dashed = status === 'menunggu_konfirmasi' || status === 'menunggu';
  const stamp = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    // stampIn keyframes: 0% (opacity 0, rotate -14°, scale 1.6) → 60%
    // (opacity 1, rotate -4°, scale .96) → 100% (rotate -4°, scale 1).
    Animated.sequence([
      Animated.timing(stamp, {
        toValue: 0.6,
        duration: 252,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(stamp, {
        toValue: 1,
        duration: 168,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [animate, stamp]);

  return (
    <Animated.View
      style={[
        styles.stamp,
        { backgroundColor: s.bg, borderColor: s.border },
        dashed && styles.dashed,
        {
          opacity: stamp.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [0, 1, 1],
          }),
          transform: [
            {
              rotate: stamp.interpolate({
                inputRange: [0, 0.6, 1],
                outputRange: ['-14deg', '-4deg', '-4deg'],
              }),
            },
            {
              scale: stamp.interpolate({
                inputRange: [0, 0.6, 1],
                outputRange: [1.6, 0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={[styles.text, { color: s.color }]}>{labelOf(status)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  dashed: { borderStyle: 'dashed' },
  text: {
    fontFamily: fontFamilies.display[700],
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
