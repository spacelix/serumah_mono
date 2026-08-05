import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SerumahLogo } from '@/components/logo/serumah-logo';
import { SerumahButton } from '@/components/ui/serumah-button';
import { SerumahInput } from '@/components/ui/serumah-input';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { fontFamilies, type } from '@/theme/typography';

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    try {
      await login(email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.';
      Alert.alert('Gagal masuk', message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoChip}>
              <SerumahLogo size={28} variant="mark" roofColor={colors.paper} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>Masuk akun</Text>
              <Text style={styles.title}>Selamat datang kembali</Text>
            </View>
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
                placeholder="• • • • • • • •"
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
              />
            </View>

            <View style={styles.actions}>
              <SerumahButton
                title={loading ? 'Memproses…' : 'Masuk'}
                disabled={loading || email.trim() === '' || password === ''}
                onPress={handleSubmit}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Belum punya akun? </Text>
              <Link href="/register" style={styles.link}>
                Daftar
              </Link>
            </View>
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
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 26,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flexDirection: 'column',
    gap: 2,
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