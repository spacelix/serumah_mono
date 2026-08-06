import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { LogOut, Pencil, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { ScreenHeader } from '@/components/ui/screen-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  apiChangePassword,
  apiLeaveRumah,
  apiUpdateProfile,
  apiUploadAvatar,
  useProfile,
  useProfileInvalidate,
  useStats,
  type ProfileStats,
} from '@/features/profile/api/profile';
import { formatCurrency, formatLongDate } from '@/lib/format';
import { mediaSource } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from '@/stores/toast-store';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

export default function ProfileScreen() {
  const { data, isLoading } = useProfile();
  const statsQuery = useStats();
  const invalidate = useProfileInvalidate();
  const logout = useAuthStore((s) => s.clear);
  const setOnboarding = useAuthStore((s) => s.setOnboarding);
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwClosing, setPwClosing] = useState(false);
  const [pwLama, setPwLama] = useState('');
  const [pwBaru, setPwBaru] = useState('');
  const [pwKonfirmasi, setPwKonfirmasi] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [nama, setNama] = useState('');
  const [kontak, setKontak] = useState('');
  const [alamat, setAlamat] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'logout' | 'leave' | null>(null);

  const anggota = data?.anggota ?? null;
  const rumah = data?.rumah ?? null;
  const isAdmin = anggota?.role === 'admin';
  const stats: ProfileStats | undefined = statsQuery.data;
  const joinLabel = anggota?.createdAt
    ? `Join ${formatLongDate(anggota.createdAt)}`
    : '';

  const startEdit = () => {
    setClosing(false);
    setPwOpen(false);
    setPwClosing(false);
    setNama(anggota?.nama ?? '');
    setKontak(anggota?.kontakDarurat ?? '');
    setAlamat(anggota?.alamat ?? '');
    setEditing(true);
  };

  const openPassword = () => {
    setPwClosing(false);
    setEditing(false);
    setClosing(false);
    setPwOpen(true);
  };

  const onSavePassword = async () => {
    if (!pwLama || !pwBaru || !pwKonfirmasi) {
      Alert.alert('Lengkapi dulu', 'Isi semua kolom password.');
      return;
    }
    if (pwBaru !== pwKonfirmasi) {
      Alert.alert('Tidak cocok', 'Password baru dan konfirmasi harus sama.');
      return;
    }
    setPwSaving(true);
    try {
      await apiChangePassword(pwLama, pwBaru);
      toast.success('Password lo udah diganti.');
      setPwLama('');
      setPwBaru('');
      setPwKonfirmasi('');
      setPwClosing(true);
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setPwSaving(false);
    }
  };

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

  const onSaveEdit = async () => {
    if (!nama.trim()) {
      Alert.alert('Perhatian', 'Nama wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await apiUpdateProfile({
        nama: nama.trim(),
        kontakDarurat: kontak.trim() || undefined,
        alamat: alamat.trim() || undefined,
      });
      invalidate();
      setEditing(false);
      toast.success('Profil berhasil diperbarui.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    setConfirm('logout');
  };

  const onLeaveRumah = () => {
    setConfirm('leave');
  };

  const leaveRumah = async () => {
    setBusy(true);
    try {
      await apiLeaveRumah();
      invalidate();
      setOnboarding(true, false);
      router.replace('/onboarding/create-rumah');
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || data == null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Memuat…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Profil lo"
        kicker={rumah?.nama ?? undefined}
        onBack={() => router.back()}
        backLabel="Beranda"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {editing ? (
          <EditProfileCard
            nama={nama}
            setNama={setNama}
            kontak={kontak}
            setKontak={setKontak}
            alamat={alamat}
            setAlamat={setAlamat}
            email={anggota?.email}
            fotoProfil={anggota?.fotoProfil}
            saving={saving}
            closing={closing}
            onClose={() => setClosing(true)}
            onClosed={() => {
              setEditing(false);
              setClosing(false);
            }}
            onSave={() => void onSaveEdit()}
            onPickAvatar={() => void onPickAvatar()}
          />
        ) : (
          <View style={styles.profileCard}>
            <Pressable onPress={startEdit} style={styles.avatarThumb} hitSlop={4}>
              <View style={styles.avatarClip}>
                <AvatarThumbContent fotoProfil={anggota?.fotoProfil} />
              </View>
              <View style={styles.pencilBadge}>
                <Pencil color={colors.paper} size={11} strokeWidth={2.2} />
              </View>
            </Pressable>

            <View style={styles.cardTextCol}>
              <Text style={styles.cardName} numberOfLines={1}>
                {anggota?.nama ?? '—'}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {rumah?.nama ?? 'Belum bergabung'}
              </Text>
              {joinLabel !== '' && <Text style={styles.cardJoin}>{joinLabel}</Text>}
            </View>

            <View style={styles.cardRight}>
              <View style={[styles.roleBadge, isAdmin ? styles.roleAdmin : styles.roleMember]}>
                <Text
                  style={[styles.roleText, isAdmin ? styles.roleAdminText : styles.roleMemberText]}>
                  {isAdmin ? 'PJ KOS' : 'ANGGOTA'}
                </Text>
              </View>
              <Pressable onPress={startEdit}>
                <Text style={styles.updateText}>Update →</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.statsRow}>
          <StatCard label="Piket selesai" value={String(stats?.piketSelesai ?? 0)} color={colors.pine} size={22} />
          <StatCard
            label="Belum lunas"
            value={formatCurrency(stats?.totalBelumLunas ?? 0)}
            color={colors.brick}
            size={18}
          />
        </View>

        {isAdmin && (
          <MenuRow
            title="Kelola rumah"
            sub="Anggota, role, nominal wifi & sewa"
            cta="Buka →"
            onPress={() => router.push('/rumah/manage')}
          />
        )}

        {pwOpen ? (
          <ChangePasswordCard
            lama={pwLama}
            setLama={setPwLama}
            baru={pwBaru}
            setBaru={setPwBaru}
            konfirmasi={pwKonfirmasi}
            setKonfirmasi={setPwKonfirmasi}
            saving={pwSaving}
            closing={pwClosing}
            onClose={() => setPwClosing(true)}
            onClosed={() => {
              setPwOpen(false);
              setPwClosing(false);
            }}
            onSave={() => void onSavePassword()}
          />
        ) : (
          <MenuRow
            title="Ganti password"
            sub="Butuh password lama dulu"
            cta="Ubah →"
            onPress={openPassword}
          />
        )}

        <View style={styles.actionRow}>
          <Pressable onPress={onLogout} style={[styles.actionBtn, styles.logoutOutline]}>
            <LogOut color={colors.ink} size={15} strokeWidth={2.2} />
            <Text style={[styles.actionText, styles.logoutText]}>Logout</Text>
          </Pressable>
          <Pressable
            onPress={onLeaveRumah}
            style={[styles.actionBtn, styles.leaveOutline]}
            disabled={busy}>
            <Text style={[styles.actionText, styles.leaveText]}>
              {busy ? 'Keluar…' : 'Keluar dari rumah'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirm != null}
        title={confirm === 'leave' ? 'Keluar dari rumah' : 'Keluar aplikasi'}
        message={
          confirm === 'leave'
            ? 'Lo bakal keluar dari kos ini dan kehilangan akses ke datanya. Yakin?'
            : 'Sesi lo bakal ditutup. Lo bisa masuk lagi kapan aja.'
        }
        confirmText={confirm === 'leave' ? 'Keluar' : 'Logout'}
        danger
        busy={busy}
        onConfirm={() => {
          if (confirm === 'leave') {
            void leaveRumah();
          } else {
            void logout();
          }
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </SafeAreaView>
  );
}

function EditProfileCard({
  nama,
  setNama,
  kontak,
  setKontak,
  alamat,
  setAlamat,
  email,
  fotoProfil,
  saving,
  closing,
  onClose,
  onClosed,
  onSave,
  onPickAvatar,
}: {
  nama: string;
  setNama: (v: string) => void;
  kontak: string;
  setKontak: (v: string) => void;
  alamat: string;
  setAlamat: (v: string) => void;
  email?: string | null;
  fotoProfil?: string | null;
  saving: boolean;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
  onSave: () => void;
  onPickAvatar: () => void;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  const closed = useRef(false);

  useEffect(() => {
    if (closing) {
      Animated.timing(rise, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        if (!closed.current) {
          closed.current = true;
          onClosed();
        }
      });
    }
  }, [closing, rise, onClosed]);

  useEffect(() => {
    if (!closing) {
      Animated.timing(rise, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [closing, rise]);

  return (
    <Animated.View
      style={[
        styles.editCard,
        {
          opacity: rise,
          transform: [
            {
              translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }),
            },
          ],
        },
      ]}>
      <View style={styles.editHeader}>
        <Text style={styles.editTitle}>Update profil</Text>
        <Pressable onPress={onClose} disabled={saving} style={styles.editClose} hitSlop={4}>
          <X color={colors.inkSoft} size={15} strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={styles.photoRow}>
        <Pressable onPress={onPickAvatar} style={styles.avatarThumb} hitSlop={4}>
          <View style={styles.avatarClip}>
            <AvatarThumbContent fotoProfil={fotoProfil} />
          </View>
        </Pressable>
        <Text style={styles.photoHint}>Klik avatar untuk ganti foto{'\n'}dari kamera.</Text>
      </View>

      {email != null && (
        <EditField label="Email">
          <TextInput
            value={email}
            editable={false}
            style={[styles.editInput, styles.editInputReadonly]}
          />
        </EditField>
      )}
      <EditField label="Nama">
        <TextInput
          value={nama}
          onChangeText={setNama}
          placeholder="Nama lo"
          placeholderTextColor={colors.inkMuted}
          style={styles.editInput}
        />
      </EditField>
      <EditField label="Kontak darurat">
        <TextInput
          value={kontak}
          onChangeText={setKontak}
          placeholder="Nama & nomor"
          placeholderTextColor={colors.inkMuted}
          style={styles.editInput}
        />
      </EditField>
      <EditField label="Alamat">
        <TextInput
          value={alamat}
          onChangeText={setAlamat}
          placeholder="Alamat domisili / darurat"
          placeholderTextColor={colors.inkMuted}
          style={styles.editInput}
        />
      </EditField>

      <Text style={styles.editHint}>
        Nama ini yang muncul di jadwal piket, tagihan, dan histori swap.
      </Text>

      <Pressable onPress={onSave} disabled={saving} style={styles.saveProfileBtn}>
        <Text style={styles.saveProfileText}>{saving ? 'Menyimpan…' : 'Simpan profil'}</Text>
      </Pressable>
    </Animated.View>
  );
}

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChangePasswordCard({
  lama,
  setLama,
  baru,
  setBaru,
  konfirmasi,
  setKonfirmasi,
  saving,
  closing,
  onClose,
  onClosed,
  onSave,
}: {
  lama: string;
  setLama: (v: string) => void;
  baru: string;
  setBaru: (v: string) => void;
  konfirmasi: string;
  setKonfirmasi: (v: string) => void;
  saving: boolean;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
  onSave: () => void;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  const closed = useRef(false);

  useEffect(() => {
    if (closing) {
      Animated.timing(rise, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        if (!closed.current) {
          closed.current = true;
          onClosed();
        }
      });
    }
  }, [closing, rise, onClosed]);

  useEffect(() => {
    if (!closing) {
      Animated.timing(rise, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [closing, rise]);

  return (
    <Animated.View
      style={[
        styles.editCard,
        {
          opacity: rise,
          transform: [
            {
              translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }),
            },
          ],
        },
      ]}>
      <View style={styles.editHeader}>
        <Text style={styles.editTitle}>Ganti password</Text>
        <Pressable onPress={onClose} disabled={saving} style={styles.editClose} hitSlop={4}>
          <X color={colors.inkSoft} size={15} strokeWidth={2.4} />
        </Pressable>
      </View>

      <EditField label="Password lama">
        <TextInput
          value={lama}
          onChangeText={setLama}
          placeholder="Password yang sekarang"
          placeholderTextColor={colors.inkMuted}
          secureTextEntry
          autoCapitalize="none"
          style={styles.editInput}
        />
      </EditField>
      <EditField label="Password baru">
        <TextInput
          value={baru}
          onChangeText={setBaru}
          placeholder="Minimal 8 karakter"
          placeholderTextColor={colors.inkMuted}
          secureTextEntry
          autoCapitalize="none"
          style={styles.editInput}
        />
      </EditField>
      <EditField label="Konfirmasi password">
        <TextInput
          value={konfirmasi}
          onChangeText={setKonfirmasi}
          placeholder="Ulangi password baru"
          placeholderTextColor={colors.inkMuted}
          secureTextEntry
          autoCapitalize="none"
          style={styles.editInput}
        />
      </EditField>

      <Text style={styles.editHint}>
        Butuh password lama dulu. Paling aman pakai kombinasi angka, huruf, dan simbol.
      </Text>

      <Pressable onPress={onSave} disabled={saving} style={styles.saveProfileBtn}>
        <Text style={styles.saveProfileText}>{saving ? 'Menyimpan…' : 'Simpan password'}</Text>
      </Pressable>
    </Animated.View>
  );
}

function AvatarStripes() {
  return (
    <Svg width="100%" height="100%" fill="none" preserveAspectRatio="none">
      <Defs>
        <Pattern
          id="profileStripes"
          patternUnits="userSpaceOnUse"
          width={8}
          height={8}
          patternTransform="rotate(45)">
          <Rect width="4" height="8" fill={colors.textureA} />
          <Rect x="4" width="4" height="8" fill={colors.textureB} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#profileStripes)" />
    </Svg>
  );
}

function AvatarThumbContent({ fotoProfil }: { fotoProfil?: string | null }) {
  const token = useAuthStore((s) => s.token);
  const source = mediaSource(fotoProfil, token);
  if (source) {
    return <ExpoImage source={source} style={styles.avatarImage} contentFit="cover" />;
  }
  return (
    <>
      <AvatarStripes />
      <Text style={styles.avatarLabel}>
        foto{'\n'}profil
      </Text>
    </>
  );
}

function StatCard({
  label,
  value,
  color,
  size,
}: {
  label: string;
  value: string;
  color: string;
  size: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color, fontSize: size }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MenuRow({
  title,
  sub,
  cta,
  onPress,
}: {
  title: string;
  sub: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.menuRow}>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub}>{sub}</Text>
      </View>
      <Text style={styles.menuCta}>{cta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40, gap: 13 },

  profileCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  avatarThumb: {
    flexShrink: 0,
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarLabel: {
    textAlign: 'center',
    fontFamily: fontFamilies.mono[500],
    fontSize: 8.5,
    lineHeight: 11,
    color: colors.inkMuted,
    position: 'absolute',
  },
  pencilBadge: {
    position: 'absolute',
    right: -7,
    bottom: -7,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextCol: { flex: 1, minWidth: 0, gap: 3 },
  cardName: {
    fontFamily: fontFamilies.display[600],
    fontSize: 18,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  cardMeta: { fontFamily: fontFamilies.body[400], fontSize: 11.5, color: colors.inkSoft },
  cardJoin: {
    fontFamily: fontFamilies.mono[400],
    fontSize: 10.5,
    color: colors.inkMuted,
  },
  cardRight: { alignSelf: 'flex-start', gap: 6, alignItems: 'flex-end' },
  roleBadge: { borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 9 },
  roleAdmin: { backgroundColor: colors.pine },
  roleMember: { backgroundColor: colors.paperDeep },
  roleText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  roleAdminText: { color: colors.paper },
  roleMemberText: { color: colors.inkSoft },
  updateText: { fontFamily: fontFamilies.body[600], fontSize: 10, color: colors.pine },

  editCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 15,
    gap: 11,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  editTitle: { fontFamily: fontFamilies.display[600], fontSize: 14, color: colors.ink },
  editClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(30, 42, 36, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoHint: {
    flex: 1,
    fontFamily: fontFamilies.body[400],
    fontSize: 10,
    lineHeight: 15,
    color: colors.inkMuted,
  },
  editField: { gap: 5 },
  editLabel: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  editInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 12,
    color: colors.ink,
    fontFamily: fontFamilies.body[500],
    fontSize: 13,
  },
  editInputReadonly: {
    color: colors.inkSoft,
    backgroundColor: colors.paperFaint,
  },
  editHint: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.inkSoft,
  },
  saveProfileBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.pine,
    alignItems: 'center',
  },
  saveProfileText: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.paper },

  statsRow: { flexDirection: 'row', gap: 9 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 13,
    gap: 3,
  },
  statLabel: {
    ...type.kicker,
    fontSize: 9.5,
    letterSpacing: 1,
    color: colors.inkSoft,
  },
  statValue: {
    fontFamily: fontFamilies.mono[700],
    letterSpacing: -0.4,
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 14,
  },
  menuText: { flex: 1, gap: 2 },
  menuTitle: { fontFamily: fontFamilies.display[600], fontSize: 13.5, color: colors.ink },
  menuSub: { fontFamily: fontFamilies.body[400], fontSize: 10.5, color: colors.inkSoft },
  menuCta: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.pine },

  actionRow: { flexDirection: 'row', gap: 8, paddingTop: 2 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: 'transparent',
  },
  logoutOutline: { borderWidth: 1, borderColor: colors.line },
  leaveOutline: { borderWidth: 1, borderColor: colors.brick },
  actionText: { fontFamily: fontFamilies.body[600], fontSize: 12.5 },
  logoutText: { color: colors.ink },
  leaveText: { color: colors.brick },
});