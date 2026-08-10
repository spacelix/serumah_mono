import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'lucide-react-native';

import { SerumahButton } from '@/components/ui/serumah-button';
import { SerumahInput } from '@/components/ui/serumah-input';
import {
  apiUpdateProfile,
  uploadAvatar,
} from '@/features/onboarding/api/onboarding';
import { useAuthStore } from '@/stores/auth-store';
import { dialog } from '@/stores/dialog-store';
import { colors } from '@/theme/colors';
import { fontFamilies, type } from '@/theme/typography';

export default function OnboardingProfileScreen() {
  const router = useRouter();
  const setOnboarding = useAuthStore((s) => s.setOnboarding);
  const [nama, setNama] = useState('');
  const [kontakDarurat, setKontakDarurat] = useState('');
  const [alamat, setAlamat] = useState('');
  const [fotoProfil, setFotoProfil] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      dialog.alert(
        'Butuh izin',
        'Izinkan akses galeri untuk memilih foto profil.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    setFotoProfil(result.assets[0].uri);
  };

  const handleNext = async () => {
    if (nama.trim() === '') {
      dialog.alert(
        'Nama wajib diisi',
        'Masukkan nama kamu dulu untuk melanjutkan.',
      );
      return;
    }
    setSubmitting(true);
    try {
      let uploadedUrl: string | undefined;
      if (fotoProfil != null) {
        uploadedUrl = await uploadAvatar(fotoProfil);
      }
      await apiUpdateProfile({
        nama: nama.trim(),
        fotoProfil: uploadedUrl,
        kontakDarurat: kontakDarurat.trim() || undefined,
        alamat: alamat.trim() || undefined,
      });
      setOnboarding(true, false);
      router.replace('/onboarding/create-rumah');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan. Coba lagi.';
      dialog.alert('Gagal menyimpan profil', message);
    } finally {
      setSubmitting(false);
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
            <Text style={styles.kicker}>Langkah 1 dari 2</Text>
            <Text style={styles.title}>Lengkapi profil</Text>
            <Text style={styles.subtitle}>
              Data ini dipakai buat papan piket kos kamu.
            </Text>
          </View>

          <View style={styles.center}>
            <Pressable
              accessibilityRole="button"
              onPress={pickPhoto}
              style={({ pressed }) => [
                styles.avatarWrap,
                pressed && styles.avatarPressed,
              ]}
            >
              {fotoProfil != null ? (
                <Pressable onPress={pickPhoto} style={styles.avatarImageWrap}>
                  <ExpoImage
                    source={{ uri: fotoProfil }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                </Pressable>
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {nama.trim() ? nama.trim().charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )}
              <View style={styles.cameraOverlay}>
                <Camera size={14} color={colors.paper} strokeWidth={2.2} />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>
              {fotoProfil != null
                ? 'Ketuk buat ganti'
                : 'Tambah foto (opsional)'}
            </Text>

            <View style={styles.form}>
              <SerumahInput
                label="Nama"
                value={nama}
                onChangeText={setNama}
                placeholder="Nama kamu"
                autoCorrect={false}
              />
              <SerumahInput
                label="Kontak darurat"
                value={kontakDarurat}
                onChangeText={setKontakDarurat}
                placeholder="No. HP keluarga/teman (opsional)"
                keyboardType="phone-pad"
              />
              <SerumahInput
                label="Alamat"
                value={alamat}
                onChangeText={setAlamat}
                placeholder="Alamat lengkap (opsional)"
              />
            </View>

            <View style={styles.actions}>
              <SerumahButton
                title={submitting ? 'Menyimpan…' : 'Lanjut'}
                disabled={submitting || nama.trim() === ''}
                onPress={handleNext}
              />
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
    marginTop: 8,
    gap: 8,
  },
  avatarWrap: {
    alignSelf: 'center',
    width: 100,
    height: 100,
  },
  avatarPressed: {
    opacity: 0.85,
  },
  avatarImageWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamilies.display[700],
    fontSize: 40,
    letterSpacing: -0.02,
    color: colors.paper,
  },
  cameraOverlay: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.paper,
  },
  avatarHint: {
    ...type.body,
    fontSize: 11,
    textAlign: 'center',
    color: colors.inkSoft,
  },
  form: {
    gap: 15,
    marginTop: 16,
  },
  actions: {
    marginTop: 18,
  },
});
