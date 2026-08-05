import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SerumahButton } from '@/components/ui/serumah-button';
import { SerumahInput } from '@/components/ui/serumah-input';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Kata sandi tidak cocok', 'Pastikan kedua kata sandi sama.');
      return;
    }
    try {
      await register(email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.';
      Alert.alert('Gagal mendaftar', message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Serumah</Text>
            <Text style={styles.title}>Buat akun</Text>
            <Text style={styles.subtitle}>Mulai hidup rapi di kos-mu.</Text>
          </View>

          <View style={styles.form}>
            <SerumahInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="nama@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <SerumahInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Minimal 8 karakter"
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <SerumahInput
              label="Konfirmasi password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Ulangi password"
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
            />
          </View>

          <View style={styles.actions}>
            <SerumahButton
              title={loading ? 'Memproses…' : 'Daftar'}
              disabled={loading || email.trim() === '' || password === '' || confirmPassword === ''}
              onPress={handleSubmit}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Sudah punya akun? </Text>
            <Link href="/login" style={styles.link}>
              Masuk
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  kicker: {
    ...type.kicker,
    fontSize: 10,
    letterSpacing: 1.3,
    color: colors.inkSoft,
  },
  title: {
    ...type.display,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.46,
    color: colors.ink,
  },
  subtitle: {
    ...type.body,
    color: colors.inkSoft,
    fontSize: 13,
  },
  form: {
    gap: spacing.lg,
  },
  actions: {
    marginTop: spacing['2xl'],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingBottom: spacing.lg,
  },
  footerText: {
    ...type.body,
    color: colors.inkSoft,
    fontSize: 13,
  },
  link: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12,
    lineHeight: 16,
    color: colors.pine,
  },
});