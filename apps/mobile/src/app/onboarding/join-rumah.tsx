import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SerumahButton } from '@/components/ui/serumah-button';
import { SerumahInput } from '@/components/ui/serumah-input';
import {
  apiJoinRumah,
  apiPreviewJoin,
  type JoinPreview,
} from '@/features/onboarding/api/onboarding';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { fontFamilies, type } from '@/theme/typography';

export default function OnboardingJoinRumahScreen() {
  const router = useRouter();
  const setOnboarding = useAuthStore((s) => s.setOnboarding);
  const [kode, setKode] = useState('');
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);

  const onChangeKode = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 6);
    setKode(digits);
    if (digits.length === 6) {
      void lookup(digits);
    } else {
      setPreview(null);
      setPreviewError(null);
    }
  };

  const lookup = async (digits: string) => {
    setChecking(true);
    setPreviewError(null);
    try {
      const result = await apiPreviewJoin(digits);
      setPreview(result);
    } catch (error) {
      setPreview(null);
      setPreviewError(
        error instanceof Error ? error.message : 'Kode tidak ditemukan.',
      );
    } finally {
      setChecking(false);
    }
  };

  const handleJoin = async () => {
    if (preview == null) return;
    setJoining(true);
    try {
      await apiJoinRumah(kode);
      setOnboarding(true, true);
      router.replace('/(tabs)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.';
      Alert.alert('Gagal gabung kos', message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Langkah 2 dari 2</Text>
            <Text style={styles.title}>Gabung Kos</Text>
            <Text style={styles.subtitle}>
              Masukkan 6 digit kode undangan dari admin kos kamu.
            </Text>
          </View>

          <View style={styles.center}>
            <SerumahInput
              label="Kode undangan"
              value={kode}
              onChangeText={onChangeKode}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
            />

            {checking && <Text style={styles.hintText}>Mengecek kode…</Text>}

            {previewError != null && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{previewError}</Text>
              </View>
            )}

            {preview != null && (
              <View style={styles.previewCard}>
                <Text style={styles.previewKicker}>KOS KETEMU</Text>
                <Text style={styles.previewName}>{preview.nama}</Text>
                <Text style={styles.previewAlamat}>{preview.alamat}</Text>
                <Text style={styles.previewCount}>
                  {preview.anggotaCount} anggota
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <SerumahButton
                title={joining ? 'Menggabung…' : 'Gabung'}
                disabled={joining || preview == null}
                onPress={handleJoin}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Belum ada kode? </Text>
              <Text
                style={styles.switchLink}
                onPress={() => router.replace('/onboarding/create-rumah')}>
                Buat kos baru
              </Text>
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
    gap: 14,
  },
  hintText: {
    ...type.body,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  errorBox: {
    backgroundColor: colors.brickSoft,
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  errorText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.brickDeep,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 4,
  },
  previewKicker: {
    ...type.kicker,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.pine,
  },
  previewName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
  },
  previewAlamat: {
    fontFamily: fontFamilies.body[400],
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkSoft,
  },
  previewCount: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.4,
    color: colors.inkMuted,
    marginTop: 4,
  },
  actions: {
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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
});