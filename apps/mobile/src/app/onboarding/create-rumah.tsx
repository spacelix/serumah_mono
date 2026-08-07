import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SerumahButton } from '@/components/ui/serumah-button';
import { SerumahInput } from '@/components/ui/serumah-input';
import { apiCreateRumah } from '@/features/onboarding/api/onboarding';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { fontFamilies, type } from '@/theme/typography';

export default function OnboardingCreateRumahScreen() {
  const router = useRouter();
  const setOnboarding = useAuthStore((s) => s.setOnboarding);
  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [rumahNama, setRumahNama] = useState('');

  const handleCreate = async () => {
    if (nama.trim() === '' || alamat.trim() === '') return;
    setSubmitting(true);
    try {
      const result = await apiCreateRumah({ nama: nama.trim(), alamat: alamat.trim() });
      setInviteCode(result.inviteCode);
      setRumahNama(result.rumah.nama);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.';
      Alert.alert('Gagal membuat kos', message);
    } finally {
      setSubmitting(false);
    }
  };

  const shareInvite = async () => {
    if (inviteCode == null) return;
    try {
      await Share.share({
        message: `Ayo gabung ke kos "${rumahNama}" di Serumah. Kode undangan: ${inviteCode}`,
      });
    } catch {
      // Sharing dismissed — no action needed.
    }
  };

  const finish = () => {
    setOnboarding(true, true);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          {inviteCode == null ? (
            <>
              <View style={styles.header}>
                <Text style={styles.kicker}>Langkah 2 dari 2</Text>
                <Text style={styles.title}>Buat Kos Baru</Text>
                <Text style={styles.subtitle}>
                  Jadi admin (PJ Kos) — kamu yang atur piket, iuran, dan verifikasi.
                </Text>
              </View>

              <View style={styles.center}>
                <View style={styles.form}>
                  <SerumahInput
                    label="Nama kos"
                    value={nama}
                    onChangeText={setNama}
                    placeholder="Contoh: Kos Ampel 12"
                    autoCorrect={false}
                  />
                  <SerumahInput
                    label="Alamat"
                    value={alamat}
                    onChangeText={setAlamat}
                    placeholder="Alamat kos lengkap"
                  />
                </View>

                <View style={styles.actions}>
                  <SerumahButton
                    title={submitting ? 'Membuat…' : 'Buat & Dapatkan Kode Undangan'}
                    disabled={submitting || nama.trim() === '' || alamat.trim() === ''}
                    onPress={handleCreate}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>Punya kode undangan? </Text>
                  <Text style={styles.switchLink} onPress={() => router.replace('/onboarding/join-rumah')}>
                    Gabung kos
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.success}>
              <View style={styles.successHeader}>
                <Text style={styles.kicker}>Kos berhasil dibuat</Text>
                <Text style={styles.title}>{rumahNama}</Text>
              </View>

              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>KODE UNDANGAN</Text>
                <Text style={styles.codeValue}>{inviteCode}</Text>
                <Text style={styles.codeHint}>
                  Bagikan kode ini ke temen biar bisa gabung.
                </Text>
              </View>

              <View style={styles.successActions}>
                <SerumahButton title="Bagikan ke temen" variant="outline" onPress={shareInvite} />
                <SerumahButton title="Lanjut ke Beranda" onPress={finish} />
              </View>
            </View>
          )}
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
    paddingTop: 44,
    paddingBottom: 26,
    gap: 16,
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
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.48,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamilies.body[400],
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkSoft,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  form: {
    gap: 15,
  },
  actions: {
    marginTop: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    gap: 4,
  },
  switchText: {
    ...type.body,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  switchLink: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12,
    lineHeight: 16,
    color: colors.pine,
  },
  success: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
  },
  successHeader: {
    gap: 4,
  },
  codeCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  codeLabel: {
    ...type.kicker,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: colors.inkSoft,
  },
  codeValue: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 6,
    color: colors.pine,
  },
  codeHint: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.inkSoft,
  },
  successActions: {
    gap: 10,
  },
});