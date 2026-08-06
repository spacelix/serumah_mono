import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  apiGetRumahMe,
  apiRemoveAnggota,
  apiResetInvite,
  apiSetQris,
  apiUpdateRumah,
  ruanganKeys,
  useProfileInvalidate,
  useRuangan,
  apiCreateRuangan,
  apiDeleteRuangan,
  apiReorderRuangan,
  apiCreateJenisPiket,
  apiDeleteJenisPiket,
  apiUpdateJenisPiket,
  type RumahDetail,
} from '@/features/profile/api/profile';
import { uploadProof } from '@/features/tagihan/api/upload';
import { formatCurrency } from '@/lib/format';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

export default function ManageRumahScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['profile', 'rumah'],
    queryFn: apiGetRumahMe,
  });
  const invalidate = useProfileInvalidate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (isLoading || data == null || data.rumah == null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Memuat…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rumah = data.rumah;
  const isAdmin = data.currentRole === 'admin';

  const onResetInvite = async () => {
    setBusy(true);
    try {
      await apiResetInvite();
      invalidate();
      Alert.alert('Berhasil', 'Kode undangan baru sudah dibuat.');
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const onRemoveMember = (id: string, nama: string) => {
    Alert.alert('Hapus anggota', `Yakin menghapus ${nama} dari kos?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          void apiRemoveAnggota(id)
            .then(() => invalidate())
            .catch((e) =>
              Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.'),
            );
        },
      },
    ]);
  };

  const onUploadQris = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izin kamera', 'Izinkan kamera untuk memotret QRIS.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      const url = await uploadProof('qris', result.assets[0].uri, rumah.id);
      await apiSetQris(url);
      invalidate();
      Alert.alert('Berhasil', 'QRIS pembayaran diperbarui.');
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.ink} size={18} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>Kelola Kos</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <InfoCard rumah={rumah} />
        {isAdmin && <CostsCard rumah={rumah} onChange={() => invalidate()} />}
        <RekeningCard rumah={rumah} isAdmin={isAdmin} onUploadQris={() => void onUploadQris()} />
        <InviteCard
          code={rumah.inviteCode}
          isAdmin={isAdmin}
          busy={busy}
          onReset={() => void onResetInvite()}
        />
        <MembersSection members={data.anggotaList} isAdmin={isAdmin} onRemove={onRemoveMember} />
        <RoomsSection isAdmin={isAdmin} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ rumah }: { rumah: { nama: string; alamat: string } }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoName}>{rumah.nama}</Text>
      <Text style={styles.infoAlamat}>{rumah.alamat}</Text>
    </View>
  );
}

function CostsCard({ rumah, onChange }: { rumah: RumahDetail; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [kos, setKos] = useState(String(rumah.biayaKos));
  const [wifi, setWifi] = useState(String(rumah.biayaWifi));
  const [listrik, setListrik] = useState(String(rumah.biayaListrikWajib));
  const [denda, setDenda] = useState(String(rumah.nominalDenda));
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      await apiUpdateRumah({
        biayaKos: parseInt(kos.replace(/\D/g, '') || '0', 10),
        biayaWifi: parseInt(wifi.replace(/\D/g, '') || '0', 10),
        biayaListrikWajib: parseInt(listrik.replace(/\D/g, '') || '0', 10),
        nominalDenda: parseInt(denda.replace(/\D/g, '') || '0', 10),
      });
      setEditing(false);
      onChange();
      Alert.alert('Tersimpan', 'Biaya kos diperbarui.');
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Biaya Rumah</Text>
        <CostInput label="Biaya Kos" value={kos} onChange={setKos} />
        <CostInput label="WiFi" value={wifi} onChange={setWifi} />
        <CostInput label="Listrik Wajib" value={listrik} onChange={setListrik} />
        <CostInput label="Denda Piket" value={denda} onChange={setDenda} />
        <View style={styles.rowActions}>
          <Pressable onPress={() => setEditing(false)} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Batal</Text>
          </Pressable>
          <Pressable onPress={() => void onSave()} disabled={saving} style={styles.pineBtn}>
            <Text style={styles.pineBtnText}>{saving ? 'Menyimpan…' : 'Simpan'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle}>Biaya Rumah</Text>
        <Pressable onPress={() => setEditing(true)}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>
      <CostRow label="Biaya Kos" value={formatCurrency(rumah.biayaKos)} />
      <CostRow label="WiFi" value={formatCurrency(rumah.biayaWifi)} />
      <CostRow label="Listrik Wajib" value={formatCurrency(rumah.biayaListrikWajib)} />
      <CostRow label="Denda Piket" value={`${formatCurrency(rumah.nominalDenda)} / submission`} danger />
    </View>
  );
}

function RekeningCard({
  rumah,
  isAdmin,
  onUploadQris,
}: {
  rumah: RumahDetail;
  isAdmin: boolean;
  onUploadQris: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [bank, setBank] = useState(rumah.rekeningBank ?? '');
  const [nomor, setNomor] = useState(rumah.rekeningNomor ?? '');
  const [nama, setNama] = useState(rumah.rekeningNama ?? '');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      await apiUpdateRumah({
        rekeningBank: bank || undefined,
        rekeningNomor: nomor || undefined,
        rekeningNama: nama || undefined,
      });
      setEditing(false);
      Alert.alert('Tersimpan', 'Rekening kos diperbarui.');
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle}>Rekening Kos</Text>
        {isAdmin && (
          <Pressable onPress={() => setEditing((v) => !v)}>
            <Text style={styles.editText}>{editing ? 'Tutup' : 'Edit'}</Text>
          </Pressable>
        )}
      </View>
      {editing ? (
        <>
          <CostInput label="Bank" value={bank} onChange={setBank} />
          <CostInput label="Nomor" value={nomor} onChange={setNomor} />
          <CostInput label="a.n." value={nama} onChange={setNama} />
          <View style={styles.rowActions}>
            <Pressable onPress={() => setEditing(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>
            <Pressable onPress={() => void onSave()} disabled={saving} style={styles.pineBtn}>
              <Text style={styles.pineBtnText}>{saving ? 'Menyimpan…' : 'Simpan'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.rekeningBox}>
          <Text style={styles.rekeningMain}>
            {rumah.rekeningBank ?? '—'} · {rumah.rekeningNomor ?? '—'}
          </Text>
          <Text style={styles.rekeningName}>a.n. {rumah.rekeningNama ?? '—'}</Text>
        </View>
      )}
      {isAdmin && (
        <Pressable onPress={onUploadQris} style={styles.qrisBtn}>
          <Text style={styles.qrisBtnText}>
            {rumah.qrisUrl ? 'Ganti QRIS' : 'Unggah QRIS pembayaran'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function InviteCard({
  code,
  isAdmin,
  busy,
  onReset,
}: {
  code: string;
  isAdmin: boolean;
  busy: boolean;
  onReset: () => void;
}) {
  const copy = () => Alert.alert('Disalin', `Kode ${code} disalin.`);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Kode Undangan</Text>
      <View style={styles.inviteRow}>
        <View style={styles.inviteBox}>
          <Text style={styles.inviteCode}>{code}</Text>
        </View>
        <Pressable onPress={copy} style={styles.copyBtn}>
          <Text style={styles.copyText}>Copy kode</Text>
        </Pressable>
      </View>
      {isAdmin && (
        <Pressable onPress={onReset} disabled={busy} style={styles.resetBtn}>
          <Text style={styles.resetText}>{busy ? 'Membuat…' : 'Reset kode'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function MembersSection({
  members,
  isAdmin,
  onRemove,
}: {
  members: { id: string; nama: string; fotoProfil: string | null; kamar: string | null; role: string }[];
  isAdmin: boolean;
  onRemove: (id: string, nama: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Anggota</Text>
      <View style={styles.memberList}>
        {members.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberInitial}>{m.nama.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{m.nama}</Text>
              <Text style={styles.memberSub}>
                {m.kamar ?? '—'} · {m.role === 'admin' ? 'PJ' : 'Anggota'}
              </Text>
            </View>
            {isAdmin && m.role !== 'admin' && (
              <Pressable onPress={() => onRemove(m.id, m.nama)} style={styles.removeBtn}>
                <Text style={styles.removeText}>Hapus</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function CostInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.costField}>
      <Text style={styles.costLabel}>{label}</Text>
      <TextInput
        style={styles.costInput}
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={colors.inkMuted}
        keyboardType="number-pad"
      />
    </View>
  );
}

function CostRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <View style={styles.costRow}>
      <Text style={styles.costLabel}>{label}</Text>
      <Text style={[styles.costValue, danger && styles.costValueDanger]}>{value}</Text>
    </View>
  );
}

function RoomsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: ruangan, isLoading } = useRuangan();
  const queryClient = useQueryClient();
  const [newRoom, setNewRoom] = useState('');
  const [newJenis, setNewJenis] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const revalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ruanganKeys.list });
  };

  const move = async (index: number, dir: 'up' | 'down') => {
    if (!ruangan) return;
    const target = index + (dir === 'up' ? -1 : 1);
    if (target < 0 || target >= ruangan.length) return;
    const next = [...ruangan];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      await apiReorderRuangan(next.map((r) => r.id));
      revalidate();
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const addRoom = async () => {
    if (!newRoom.trim()) return;
    setBusy(true);
    try {
      await apiCreateRuangan(newRoom.trim());
      setNewRoom('');
      revalidate();
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const removeRoom = (id: string) => {
    Alert.alert('Hapus ruangan', 'Yakin hapus ruangan ini beserta jenis piketnya?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          void apiDeleteRuangan(id)
            .then(revalidate)
            .catch((e) => Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.'));
        },
      },
    ]);
  };

  const addJenis = async (ruanganId: string) => {
    const nama = (newJenis[ruanganId] ?? '').trim();
    if (!nama) return;
    setBusy(true);
    try {
      await apiCreateJenisPiket(ruanganId, nama);
      setNewJenis((p) => ({ ...p, [ruanganId]: '' }));
      revalidate();
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const removeJenis = (id: string) => {
    void apiDeleteJenisPiket(id)
      .then(revalidate)
      .catch((e) => Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.'));
  };

  if (isLoading || ruangan == null) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kelola Ruangan</Text>
        <Text style={styles.loadingText}>Memuat…</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Kelola Ruangan</Text>
      <View style={styles.roomList}>
        {ruangan.map((room, index) => (
          <View key={room.id} style={styles.roomCard}>
            <View style={styles.roomHeader}>
              <Text style={styles.roomName}>{room.nama}</Text>
              <View style={styles.roomActions}>
                <Pressable onPress={() => void move(index, 'up')} disabled={busy || index === 0}>
                  <Text style={styles.roomNav}>↑</Text>
                </Pressable>
                <Pressable
                  onPress={() => void move(index, 'down')}
                  disabled={busy || index === ruangan.length - 1}>
                  <Text style={styles.roomNav}>↓</Text>
                </Pressable>
                {isAdmin && (
                  <Pressable onPress={() => removeRoom(room.id)}>
                    <Text style={styles.roomRemove}>✕</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.jenisWrap}>
              {room.jenisPiket.map((j) => (
                <View key={j.id} style={[styles.jenisChip, !j.isActive && styles.jenisChipOff]}>
                  <Text style={[styles.jenisText, !j.isActive && styles.jenisTextOff]}>
                    {j.nama}
                  </Text>
                  {isAdmin && (
                    <Pressable
                      onPress={() => {
                        void apiUpdateJenisPiket(j.id, { isActive: !j.isActive })
                          .then(revalidate)
                          .catch((e) =>
                            Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.'),
                          );
                      }}>
                      <Text style={styles.jenisToggle}>{j.isActive ? 'on' : 'off'}</Text>
                    </Pressable>
                  )}
                  {isAdmin && (
                    <Pressable onPress={() => removeJenis(j.id)}>
                      <Text style={styles.jenisRemove}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>

            {isAdmin && (
              <View style={styles.jenisInputRow}>
                <TextInput
                  style={styles.jenisInput}
                  value={newJenis[room.id] ?? ''}
                  onChangeText={(text) =>
                    setNewJenis((p) => ({ ...p, [room.id]: text }))
                  }
                  placeholder="Tambah jenis piket"
                  placeholderTextColor={colors.inkMuted}
                />
                <Pressable
                  onPress={() => void addJenis(room.id)}
                  disabled={busy || !(newJenis[room.id] ?? '').trim()}
                  style={styles.addJenisBtn}>
                  <Text style={styles.addJenisText}>+</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </View>

      {isAdmin && (
        <View style={styles.jenisInputRow}>
          <TextInput
            style={styles.jenisInput}
            value={newRoom}
            onChangeText={setNewRoom}
            placeholder="Tambah Ruangan"
            placeholderTextColor={colors.inkMuted}
          />
          <Pressable
            onPress={() => void addRoom()}
            disabled={busy || !newRoom.trim()}
            style={styles.addJenisBtn}>
            <Text style={styles.addJenisText}>+</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fontFamilies.display[600], fontSize: 16, color: colors.ink },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 12 },

  infoCard: {
    backgroundColor: colors.pine,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 2,
  },
  infoName: { fontFamily: fontFamilies.display[600], fontSize: 16, color: colors.paper },
  infoAlamat: { fontFamily: fontFamilies.body[400], fontSize: 11.5, color: colors.paper60 },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fontFamilies.display[600], fontSize: 14, color: colors.ink },
  editText: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.pine },

  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  costLabel: { fontFamily: fontFamilies.body[400], fontSize: 12, color: colors.inkSoft },
  costValue: { fontFamily: fontFamilies.mono[700], fontSize: 13, color: colors.ink },
  costValueDanger: { color: colors.brick },
  costField: { gap: 6 },
  costInput: {
    fontFamily: fontFamilies.mono[600],
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.ink },
  pineBtn: {
    flex: 2,
    backgroundColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  pineBtnText: { fontFamily: fontFamilies.body[700], fontSize: 12, color: colors.paper },

  rekeningBox: {
    backgroundColor: colors.mustardSoft,
    borderRadius: radius.md,
    padding: 12,
    gap: 2,
  },
  rekeningMain: { fontFamily: fontFamilies.mono[700], fontSize: 13, color: colors.mustardInkStrong },
  rekeningName: { fontFamily: fontFamilies.body[400], fontSize: 11.5, color: colors.mustardInk },
  qrisBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  qrisBtnText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.ink },

  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inviteBox: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inviteCode: { fontFamily: fontFamilies.mono[700], fontSize: 20, letterSpacing: 4, color: colors.ink },
  copyBtn: {
    borderWidth: 1,
    borderColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  copyText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.pine },
  resetBtn: {
    borderWidth: 1,
    borderColor: colors.brick,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetText: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.brick },

  memberList: { gap: 10 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: { fontFamily: fontFamilies.display[700], fontSize: 14, color: colors.paper },
  memberInfo: { flex: 1, gap: 1 },
  memberName: { fontFamily: fontFamilies.body[600], fontSize: 13, color: colors.ink },
  memberSub: { fontFamily: fontFamilies.body[400], fontSize: 10.5, color: colors.inkSoft },
  removeBtn: {
    borderWidth: 1,
    borderColor: colors.brick,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  removeText: { fontFamily: fontFamilies.body[600], fontSize: 10.5, color: colors.brick },

  roomList: { gap: 10 },
  roomCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 12,
    gap: 8,
  },
  roomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomName: { fontFamily: fontFamilies.body[600], fontSize: 13.5, color: colors.ink },
  roomActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomNav: { fontFamily: fontFamilies.mono[700], fontSize: 15, color: colors.ink },
  roomRemove: { fontFamily: fontFamilies.body[600], fontSize: 13, color: colors.brick },
  jenisWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  jenisChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.pineSoft,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  jenisChipOff: { backgroundColor: colors.paperDeep, opacity: 0.7 },
  jenisText: { fontFamily: fontFamilies.body[600], fontSize: 11, color: colors.pineDeep },
  jenisTextOff: { color: colors.inkMuted },
  jenisToggle: { fontFamily: fontFamilies.mono[700], fontSize: 9, color: colors.mustardInk },
  jenisRemove: { fontFamily: fontFamilies.body[600], fontSize: 11, color: colors.brick },
  jenisInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jenisInput: {
    flex: 1,
    fontFamily: fontFamilies.body[400],
    fontSize: 12.5,
    color: colors.ink,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  addJenisBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addJenisText: { fontFamily: fontFamilies.body[700], fontSize: 18, color: colors.paper },
});