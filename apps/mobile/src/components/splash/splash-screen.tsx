import Constants from 'expo-constants';
import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, Text, useAnimatedValue, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SerumahLogo } from '@/components/logo/serumah-logo';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

/**
 * Splash per `Serumah.html`:
 * green bg (#3F6F61), logo 118 with riseIn, wordmark "Serumah"
 * (Space Grotesk 700 31px, -0.02em), kicker "Piket · Iuran · Galon"
 * (JetBrains Mono 500 9.5, .2em, uppercase, paper @ 55%).
 */
export function SplashScreen() {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '';
  const rise = useAnimatedValue(0);
  const word = useAnimatedValue(0);
  const riseTranslate = useMemo(
    () => rise.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
    [rise],
  );
  const wordTranslate = useMemo(
    () => word.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
    [word],
  );

  useEffect(() => {
    Animated.sequence([
      Animated.timing(rise, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(word, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [rise, word]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.riseWrap,
          {
            opacity: rise,
            transform: [{ translateY: riseTranslate }],
          },
        ]}
      >
        <SerumahLogo size={112} />
      </Animated.View>
      <Animated.View
        style={[
          styles.wordmarkBlock,
          {
            opacity: word,
            transform: [{ translateY: wordTranslate }],
          },
        ]}
      >
        <Text style={styles.wordmark}>Serumah</Text>
        <Text style={styles.kicker}>Piket · Iuran · Galon</Text>
      </Animated.View>
      {version !== '' && (
        <Text style={[styles.version, { bottom: Math.max(insets.bottom, 12) + 26 }]}>
          v{version}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.splashGreen,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  riseWrap: {
    alignItems: 'center',
  },
  wordmarkBlock: {
    alignItems: 'center',
    gap: 7,
  },
  wordmark: {
    fontFamily: fontFamilies.display[700],
    fontSize: 31,
    lineHeight: 34,
    color: colors.paper,
    letterSpacing: -0.62,
  },
  kicker: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: colors.paperFaint,
  },
  version: {
    position: 'absolute',
    bottom: 26,
    fontFamily: fontFamilies.mono[500],
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.paperFaint,
  },
});
