import { StyleSheet, Text, View } from 'react-native';

import { SerumahLogo } from '@/components/logo/serumah-logo';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

/**
 * Splash per `Serumah.html`:
 * green bg (#3F6F61), logo 118 with riseIn, wordmark "Serumah"
 * (Space Grotesk 700 31px, -0.02em), kicker "Piket · Iuran · Galon"
 * (JetBrains Mono 500 9.5, .2em, uppercase, paper @ 55%).
 */
export function SplashScreen() {
  return (
    <View style={styles.container}>
      <SerumahLogo size={118} />
      <View style={styles.wordmarkBlock}>
        <Text style={styles.wordmark}>Serumah</Text>
        <Text style={styles.kicker}>Piket · Iuran · Galon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.splashGreen,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  wordmarkBlock: {
    alignItems: 'center',
    gap: 7,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontWeight: '700',
    fontSize: 31,
    lineHeight: 34,
    color: colors.paper,
    letterSpacing: -0.62,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontWeight: '500',
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: colors.paperFaint,
  },
});