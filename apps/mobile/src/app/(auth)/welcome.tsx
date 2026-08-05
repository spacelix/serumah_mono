import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SerumahLogo } from '@/components/logo/serumah-logo';
import { SerumahButton } from '@/components/ui/serumah-button';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/radius';
import { type } from '@/theme/typography';

/**
 * Welcome / landing page shown after the splash, when not logged in.
 * Serumah visual language: centered logo, wordmark, then primary
 * "Masuk" CTA + outline "Daftar akun baru".
 */
export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <SerumahLogo size={104} />
          <Text style={styles.wordmark}>Serumah</Text>
          <Text style={styles.kicker}>Piket · Iuran · Galon</Text>
        </View>

        <View style={styles.blurb}>
          <Text style={styles.blurbText}>
            Jadwal piket rumah jadi rapi, adil, dan otomatis kepantau dari satu tempat.
          </Text>
        </View>

        <View style={styles.actions}>
          <Link href="/login" asChild>
            <SerumahButton title="Masuk" />
          </Link>
          <Link href="/register" asChild>
            <SerumahButton variant="outline" title="Daftar akun baru" />
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  wordmark: {
    fontFamily: type.display.fontFamily,
    fontWeight: '700',
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: colors.ink,
  },
  kicker: {
    ...type.kicker,
    fontSize: 9.5,
    letterSpacing: 1.9,
    color: colors.inkSoft,
  },
  blurb: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  blurbText: {
    ...type.body,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.inkSoft,
    maxWidth: 300,
  },
  actions: {
    gap: spacing.md,
  },
});