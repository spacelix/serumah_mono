import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SerumahButton } from '@/components/ui/serumah-button';
import { SerumahInput } from '@/components/ui/serumah-input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { fontFamilies, type } from '@/theme/typography';

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null,
  );

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      setError({
        title: 'Kata sandi tidak cocok',
        message: 'Pastikan kedua kata sandi sama.',
      });
      return;
    }
    setError(null);
    try {
      await register(email.trim(), password);
    } catch (error) {
      setError({
        title: 'Gagal mendaftar',
        message:
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan. Coba lagi.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Langkah 1 dari 1</Text>
            <Text style={styles.title}>Buat akun</Text>
          </View>

          <View style={styles.center}>
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
                disabled={
                  loading ||
                  email.trim() === '' ||
                  password === '' ||
                  confirmPassword === ''
                }
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
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={error != null}
        title={error?.title ?? ''}
        message={error?.message ?? ''}
        confirmText="Tutup"
        single
        onConfirm={() => setError(null)}
        onCancel={() => setError(null)}
      />
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
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 26,
    gap: 18,
  },
  header: {
    gap: 4,
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
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  form: {
    gap: 15,
  },
  actions: {
    marginTop: 15,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 4,
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
