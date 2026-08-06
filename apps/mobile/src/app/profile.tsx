import * as ImagePicker from 'expo-image-picker';
import { Camera, ChevronRight, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { SerumahLogo } from '@/components/logo/serumah-logo';
import {
  apiUpdateProfile,
  apiUploadAvatar,
  useProfile,
  useProfileInvalidate,
} from '@/features/profile/api/profile';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

export default function ProfileScreen() {
  const { data, isLoading } = useProfile();
  const invalidate = useProfileInvalidate();
  const logout = useAuthStore((s) => s.clear);
  const router = useRouter();

  const anggota = data?.anggota ?? null;
  const rumah = data?.rumah ?? null;

  const [nama, setNama] = useState(anggota?.nama ?? '');
  const [alamat, setAlamat] = useState(anggota?.alamat ?? '');
  const [kontak, setKontak] = useState(anggota?.kontakDarurat ?? '');
  const [saving, setSaving] = useState(false);

  const isAdmin = anggota?.role === 'admin';

  const onPickAvatar = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izin kamera', 'Izinkan kamera untuk foto profil.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const url = await apiUploadAvatar(result.assets[0].uri);
      await apiUpdateProfile({ fotoProfil: url });
      invalidate();
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await apiUpdateProfile({ nama, alamat: alamat || undefined, kontakDarurat: kontak || undefined });
      invalidate();
      Alert.alert('Tersimpan', 'Profil berhasil diperbarui.');
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    Alert.alert('Keluar', 'Yakin mau keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  if (isLoading || data == null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Memuat…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <Pressable onPress={() => void onPickAvatar()} style={styles.avatar}>
            {anggota?.fotoProfil ? (
              <Text style={styles.avatarInitial}>{anggota.nama.charAt(0).toUpperCase()}</Text>
            ) : (
              <Text style={styles.avatarInitial}>
                {(anggota?.nama ?? '?').charAt(0).toUpperCase()}
              </Text>
            )}
            <View style={styles.cameraOverlay}>
              <Camera color={colors.paper} size={14} strokeWidth={2.2} />
            </View>
          </Pressable>
          <Text style={styles.name}>{anggota?.nama ?? '—'}</Text>
          <View style={[styles.roleBadge, isAdmin ? styles.roleAdmin : styles.roleMember]}>
            <Text style={[styles.roleText, isAdmin ? styles.roleAdminText : styles.roleMemberText]}>
              {isAdmin ? 'PJ KOS' : 'ANGGOTA'}
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <LabeledInput label="Nama" value={nama} onChangeText={setNama} placeholder="Nama lo" />
          {anggota?.kamar != null && (
            <View style={styles.readRow}>
              <Text style={styles.readLabel}>Kamar</Text>
              <Text style={styles.readValue}>{anggota.kamar}</Text>
            </View>
          )}
          <LabeledInput
            label="Alamat"
            value={alamat}
            onChangeText={setAlamat}
            placeholder="Alamat kos / domisili"
            multiline
          />
          <LabeledInput
            label="Kontak darurat"
            value={kontak}
            onChangeText={setKontak}
            placeholder="Nama & nomor"
            multiline
          />
        </View>

        {rumah != null && (
          <View style={styles.rumahCard}>
            <Text style={styles.rumahKicker}>KOS</Text>
            <Text style={styles.rumahName}>{rumah.nama}</Text>
            <Text style={styles.rumahAlamat}>{rumah.alamat}</Text>
          </View>
        )}

        {isAdmin && (
          <Pressable
            onPress={() => router.push('/rumah/manage')}
            style={styles.manageRow}>
            <View style={styles.manageText}>
              <Text style={styles.manageTitle}>Kelola Kos</Text>
              <Text style={styles.manageSub}>Biaya, anggota, ruangan & kode undangan</Text>
            </View>
            <ChevronRight color={colors.inkSoft} size={18} strokeWidth={2.2} />
          </Pressable>
        )}

        <Pressable onPress={() => void onSave()} disabled={saving} style={styles.saveBtn}>
          <Text style={styles.saveText}>{saving ? 'Menyimpan…' : 'Simpan'}</Text>
        </Pressable>

        <Pressable onPress={onLogout} style={styles.logoutBtn}>
          <LogOut color={colors.brick} size={15} strokeWidth={2.2} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <SerumahLogo size={22} variant="mark" roofColor={colors.ink} />
        <Text style={styles.brandText}>Profil</Text>
      </View>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { ...type.section, color: colors.ink },
  loading: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 14 },
  avatarWrap: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: fontFamilies.display[700], fontSize: 34, color: colors.paper },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fontFamilies.display[600], fontSize: 19, color: colors.ink },
  roleBadge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 12 },
  roleAdmin: { backgroundColor: colors.pineSoft },
  roleMember: { backgroundColor: colors.mustardSoft },
  roleText: { fontFamily: fontFamilies.display[700], fontSize: 10, letterSpacing: 0.8 },
  roleAdminText: { color: colors.pineDeep },
  roleMemberText: { color: colors.mustardInk },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 12,
  },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.inkSoft },
  input: {
    fontFamily: fontFamilies.body[400],
    fontSize: 13.5,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  inputMultiline: { minHeight: 56, textAlignVertical: 'top' },
  readRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readLabel: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.inkSoft },
  readValue: { fontFamily: fontFamilies.mono[600], fontSize: 13, color: colors.ink },
  rumahCard: {
    backgroundColor: colors.pine,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 2,
  },
  rumahKicker: { ...type.kicker, color: colors.paper },
  rumahName: { fontFamily: fontFamilies.display[600], fontSize: 16, color: colors.paper },
  rumahAlamat: { fontFamily: fontFamilies.body[400], fontSize: 11.5, color: colors.paper60 },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mustardSoft,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 12,
  },
  manageText: { flex: 1, gap: 2 },
  manageTitle: { fontFamily: fontFamilies.body[700], fontSize: 13.5, color: colors.mustardInk },
  manageSub: { fontFamily: fontFamilies.body[400], fontSize: 11, color: colors.mustardInk },
  saveBtn: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveText: { fontFamily: fontFamilies.body[700], fontSize: 13.5, color: colors.paper },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  logoutText: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.brick },
});