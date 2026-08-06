import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/ui/screen-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/stores/toast-store';
import { useGenerateRestOfWeek, useDashboard } from '@/features/dashboard/api/dashboard';
import {
  apiCreateJenisPiket,
  apiCreateRuangan,
  apiDeleteJenisPiket,
  apiDeleteRuangan,
  apiGetRumahMe,
  apiRemoveAnggota,
  apiReorderRuangan,
  apiUpdateRumah,
  apiUpdateRuangan,
  ruanganKeys,
  useProfileInvalidate,
  useRuangan,
  type JenisPiket,
  type RumahDetail,
  type RumahManageMember,
} from '@/features/profile/api/profile';
import { formatCurrency, formatLongDate } from '@/lib/format';
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
  const params = useLocalSearchParams();
  const scrollRef = useRef<ScrollView>(null);
  const shouldScrollToGenerate = params.scrollTo === 'generate';
  const scrolledRef = useRef(false);

  const scrollToGenerate = () => {
    if (scrolledRef.current) return;
    scrollRef.current?.scrollToEnd({ animated: true });
    scrolledRef.current = true;
  };

  if (isLoading || data == null || data.rumah == null) {
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
      <ScreenHeader title="Kelola rumah" onBack={() => router.back()} backLabel="Profil" />
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => {
          if (shouldScrollToGenerate && !scrolledRef.current) scrollToGenerate();
        }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <RumahCard rumah={data.rumah} isAdmin={data.currentRole === 'admin'} onChange={() => invalidate()} />
        <MembersSection members={data.anggotaList} isAdmin={data.currentRole === 'admin'} />
        <RoomsSection isAdmin={data.currentRole === 'admin'} denda={data.rumah.nominalDenda} />
        <GenerateJadwalSection isAdmin={data.currentRole === 'admin'} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ================= Kartu Detail Rumah (toggle edit, seperti profil) ================= */

function RumahCard({
  rumah,
  isAdmin,
  onChange,
}: {
  rumah: RumahDetail;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);

  const startEdit = () => {
    setClosing(false);
    setEditing(true);
  };

  if (editing) {
    return (
      <EditRumahCard
        rumah={rumah}
        closing={closing}
        onClose={() => setClosing(true)}
        onClosed={() => {
          setEditing(false);
          setClosing(false);
        }}
        onChange={() => {
          setEditing(false);
          onChange();
        }}
      />
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={styles.rumahNama}>{rumah.nama}</Text>
          <Text style={styles.rumahAlamat}>{rumah.alamat}</Text>
        </View>
        {isAdmin && (
          <Pressable onPress={startEdit} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.inviteRow}>
        <View style={styles.inviteCol}>
          <Text style={styles.inviteLabel}>Kode invite</Text>
          <Text style={styles.inviteCode}>{rumah.inviteCode}</Text>
        </View>
        <Pressable onPress={() => copyInvite(rumah.inviteCode)} style={styles.copyBtn}>
          <Text style={styles.copyBtnText}>Copy kode</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Biaya Rumah</Text>
        <Text style={styles.sectionSub}>Total per bulan, system bagi rata ke anggota</Text>
        <CostRow label="Biaya Kos (total)" value={`${formatCurrency(rumah.biayaKos)} / bulan`} />
        <CostRow label="WiFi (total)" value={`${formatCurrency(rumah.biayaWifi)} / bulan`} />
        <CostRow label="Listrik Wajib (total)" value={`${formatCurrency(rumah.biayaListrikWajib)} / bulan`} />
        <CostRow label="Denda Piket" value={`${formatCurrency(rumah.nominalDenda)} / submission`} danger />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rekening Kos</Text>
        <Text style={styles.sectionSub}>Anggota lihat info ini di halaman Iuran</Text>
        <View style={styles.rekeningBox}>
          <Text style={styles.rekeningMain}>
            {rumah.rekeningBank ?? '—'} · {rumah.rekeningNomor ?? '—'}
          </Text>
          <Text style={styles.rekeningName}>a.n. {rumah.rekeningNama ?? '—'}</Text>
        </View>
      </View>
    </View>
  );
}

function EditRumahCard({
  rumah,
  closing,
  onClose,
  onClosed,
  onChange,
}: {
  rumah: RumahDetail;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
  onChange: () => void;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  const closed = useRef(false);
  const [nama, setNama] = useState(rumah.nama);
  const [alamat, setAlamat] = useState(rumah.alamat);
  const [kos, setKos] = useState(String(rumah.biayaKos));
  const [wifi, setWifi] = useState(String(rumah.biayaWifi));
  const [listrik, setListrik] = useState(String(rumah.biayaListrikWajib));
  const [denda, setDenda] = useState(String(rumah.nominalDenda));
  const [bank, setBank] = useState(rumah.rekeningBank ?? '');
  const [nomor, setNomor] = useState(rumah.rekeningNomor ?? '');
  const [aN, setAN] = useState(rumah.rekeningNama ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [rise]);

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

  const save = async () => {
    if (!nama.trim()) {
      toast.error('Nama kos wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await apiUpdateRumah({
        nama: nama.trim(),
        alamat: alamat.trim() || undefined,
        biayaKos: parseMoney(kos),
        biayaWifi: parseMoney(wifi),
        biayaListrikWajib: parseMoney(listrik),
        nominalDenda: parseMoney(denda),
        rekeningBank: bank.trim() || undefined,
        rekeningNomor: nomor.trim() || undefined,
        rekeningNama: aN.trim() || undefined,
      });
      onChange();
      toast.success('Rumah berhasil diperbarui.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: rise,
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
          ],
        },
      ]}>
      <Text style={styles.editTitle}>Edit data rumah</Text>

      <EditField label="Nama kos">
        <TextInput value={nama} onChangeText={setNama} placeholder="Nama kos" placeholderTextColor={colors.inkMuted} style={styles.input} />
      </EditField>
      <EditField>
        <TextInput value={alamat} onChangeText={setAlamat} placeholder="Alamat kos" placeholderTextColor={colors.inkMuted} style={styles.input} />
      </EditField>

      <Text style={styles.editSectionLabel}>
        Biaya Rumah <Text style={styles.editSectionSub}>— total per bulan, dibagi rata</Text>
      </Text>
      <View style={styles.editRow}>
        <EditMoneyField label="Biaya kos (total)" value={kos} onChange={setKos} />
        <EditMoneyField label="WiFi (total)" value={wifi} onChange={setWifi} />
      </View>
      <View style={styles.editRow}>
        <EditMoneyField label="Listrik wajib (total)" value={listrik} onChange={setListrik} />
        <EditMoneyField label="Denda piket" value={denda} onChange={setDenda} />
      </View>

      <Text style={styles.editSectionLabel}>
        Rekening Kos <Text style={styles.editSectionSub}>— tampil di halaman Iuran</Text>
      </Text>
      <View style={styles.editRow}>
        <EditField label="Bank" flex>
          <TextInput value={bank} onChangeText={setBank} placeholder="BCA" placeholderTextColor={colors.inkMuted} style={[styles.input, styles.inputBank]} />
        </EditField>
        <EditField label="Nomor rekening" flex>
          <TextInput value={nomor} onChangeText={setNomor} placeholder="1234567890" placeholderTextColor={colors.inkMuted} style={[styles.input, styles.inputNumber]} keyboardType="number-pad" />
        </EditField>
      </View>
      <EditField label="Atas nama">
        <TextInput value={aN} onChangeText={setAN} placeholder="Ibu Sari" placeholderTextColor={colors.inkMuted} style={styles.input} />
      </EditField>

      <View style={styles.editActions}>
        <Pressable onPress={() => void save()} disabled={saving} style={[styles.saveBtn, styles.saveBtnFlex]}>
          <Text style={styles.saveBtnText}>{saving ? 'Menyimpan…' : 'Simpan'}</Text>
        </Pressable>
        <Pressable onPress={onClose} disabled={saving} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Batal</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/* ================= Generate Jadwal (PJ) ================= */

function GenerateJadwalSection({ isAdmin }: { isAdmin: boolean }) {
  const generate = useGenerateRestOfWeek();
  const { data: dash } = useDashboard();
  const incomplete = dash?.scheduleIncomplete ?? false;

  if (!isAdmin) return null;

  const run = () => {
    generate.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(
          res.count > 0
            ? `Jadwal pekan ini berhasil dibuat (${res.count} hari).`
            : 'Jadwal pekan ini sudah lengkap.',
        );
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.'),
    });
  };

  return (
    <View style={styles.generateCard}>
      <View style={styles.generateBody}>
        <Text style={styles.generateKicker}>JADWAL PIKET</Text>
        <Text style={styles.generateTitle}>
          {incomplete ? 'Jadwal pekan ini belum dibuat' : 'Jadwal pekan ini sudah ada'}
        </Text>
        <Text style={styles.generateSub}>
          {incomplete
            ? 'Generate sekali aja buat ngisi sisa pekan ini — dari hari ini sampe Minggu. Pekan depannya di-generate otomatis tiap pekan.'
            : 'Sisa pekan ini udah penuh. Pekan depannya bakal di-generate otomatis.'}
        </Text>
      </View>
      <Pressable
        onPress={run}
        disabled={generate.isPending || !incomplete}
        style={({ pressed }) => [
          styles.generateBtn,
          (generate.isPending || !incomplete) && styles.generateBtnDisabled,
          pressed && incomplete && styles.generateBtnPressed,
        ]}>
        <Text style={[styles.generateBtnText, (generate.isPending || !incomplete) && styles.generateBtnTextDisabled]}>
          {generate.isPending
            ? 'Mengenerate…'
            : incomplete
              ? 'Generate Jadwal'
              : 'Jadwal Selesai'}
        </Text>
      </Pressable>
    </View>
  );
}

/* ================= List Anggota ================= */

function MembersSection({
  members,
  isAdmin,
}: {
  members: RumahManageMember[];
  isAdmin: boolean;
}) {
  const invalidate = useProfileInvalidate();
  const [removeTarget, setRemoveTarget] = useState<RumahManageMember | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await apiRemoveAnggota(removeTarget.id);
      invalidate();
      setRemoveTarget(null);
      toast.success('Anggota berhasil dihapus.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionHeadTitle}>Anggota</Text>
        <Text style={styles.sectionHeadMeta}>{members.length} anggota</Text>
      </View>
      <View style={styles.listCard}>
        {members.map((m, index) => (
          <View key={m.id}>
            {index > 0 && <View style={styles.memberDivider} />}
            <View style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>{m.nama.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.nama}</Text>
                <Text style={styles.memberSub}>Join {formatLongDate(m.createdAt)}</Text>
              </View>
              {m.role === 'admin' && (
                <View style={styles.pjBadge}>
                  <Text style={styles.pjBadgeText}>PJ Kos</Text>
                </View>
              )}
              {isAdmin && m.role !== 'admin' && (
                <Pressable onPress={() => setRemoveTarget(m)} style={styles.moreBtn} hitSlop={6}>
                  <Text style={styles.moreText}>⋯</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>

      <ConfirmDialog
        visible={removeTarget != null}
        title="Hapus anggota"
        message={removeTarget ? `Yakin hapus ${removeTarget.nama} dari kos ini?` : ''}
        confirmText="Hapus"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </View>
  );
}

/* ================= Kelola Ruangan & Jenis Piket ================= */

function RoomsSection({ isAdmin, denda }: { isAdmin: boolean; denda: number }) {
  const { data: ruangan, isLoading } = useRuangan();
  const queryClient = useQueryClient();
  const [newRoom, setNewRoom] = useState('');
  const [addingRoom, setAddingRoom] = useState(false);
  const [newJenis, setNewJenis] = useState<Record<string, string>>({});
  const [addingJenis, setAddingJenis] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [removeRoomTarget, setRemoveRoomTarget] = useState<string | null>(null);

  const revalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ruanganKeys.list });
  };

  const totalJenis = ruangan?.reduce((acc, r) => acc + r.jenisPiket.length, 0) ?? 0;

  const move = async (index: number, dir: 'down') => {
    if (!ruangan) return;
    const target = index + 1;
    if (target >= ruangan.length) return;
    const next = [...ruangan];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      await apiReorderRuangan(next.map((r) => r.id));
      revalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const startRename = (id: string, nama: string) => {
    setRenaming(id);
    setRenameVal(nama);
  };

  const confirmRename = async (id: string) => {
    if (!renameVal.trim()) return;
    setBusy(true);
    try {
      await apiUpdateRuangan(id, renameVal.trim());
      setRenaming(null);
      revalidate();
      toast.success('Ruangan berhasil diubah.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
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
      setAddingRoom(false);
      revalidate();
      toast.success('Ruangan baru berhasil dibuat.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const addJenis = async (ruanganId: string) => {
    const nama = (newJenis[ruanganId] ?? '').trim();
    if (!nama) return;
    setBusy(true);
    try {
      await apiCreateJenisPiket(ruanganId, nama);
      setNewJenis((p) => ({ ...p, [ruanganId]: '' }));
      setAddingJenis((p) => ({ ...p, [ruanganId]: false }));
      revalidate();
      toast.success('Jenis piket berhasil ditambahkan.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const removeJenis = async (jenis: JenisPiket) => {
    try {
      await apiDeleteJenisPiket(jenis.id);
      revalidate();
      toast.success('Jenis piket dihapus.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    }
  };

  const removeRoom = async (id: string) => {
    setBusy(true);
    try {
      await apiDeleteRuangan(id);
      setRemoveRoomTarget(null);
      revalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || ruangan == null) {
    return (
      <View>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionHeadTitle}>Kelola ruangan</Text>
        </View>
        <View style={styles.listCard}>
          <Text style={styles.loadingText}>Memuat…</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionHeadTitle}>Kelola ruangan</Text>
        <Text style={styles.sectionHeadMeta}>{ruangan.length} ruangan · {totalJenis} jenis piket</Text>
      </View>
      <Text style={styles.sectionDesc}>
        Tiap ruangan punya jenis piketnya sendiri. Yang piket wajib ngerjain semua ruangan — foto before,
        checklist, foto after. Denda flat {formatCurrency(denda)} per submission, bukan per jenis.
      </Text>

      <View style={styles.roomList}>
        {ruangan.map((room, index) => (
          <View key={room.id} style={styles.roomCard}>
            <View style={styles.roomHead}>
              <View style={styles.grip}>
                <View style={styles.gripLine} />
                <View style={styles.gripLine} />
                <View style={styles.gripLine} />
              </View>
              <Text style={styles.roomIndex}>{String(index + 1).padStart(2, '0')}</Text>
              {renaming === room.id ? (
                <View style={styles.renameRow}>
                  <TextInput
                    style={styles.renameInput}
                    value={renameVal}
                    onChangeText={setRenameVal}
                    autoFocus
                    placeholder="Nama ruangan"
                    placeholderTextColor={colors.inkMuted}
                  />
                  <Pressable onPress={() => void confirmRename(room.id)} disabled={busy} style={styles.renameDone}>
                    <Check color={colors.paper} size={13} strokeWidth={2.6} />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.roomName} numberOfLines={1}>{room.nama}</Text>
              )}
              <Text style={styles.roomMeta}>{room.jenisPiket.length} jenis</Text>
              {isAdmin && (
                <View style={styles.roomActions}>
                  {!renaming && (
                    <Pressable onPress={() => startRename(room.id, room.nama)} style={styles.iconBtn} hitSlop={4}>
                      <Pencil color={colors.inkSoft} size={11} strokeWidth={2.1} />
                    </Pressable>
                  )}
                  {isAdmin && (
                    <Pressable
                      onPress={() => void move(index, 'down')}
                      disabled={busy || index === ruangan.length - 1}
                      style={styles.iconBtn}
                      hitSlop={4}>
                      <Text style={[styles.moveDown, index === ruangan.length - 1 && styles.moveDownDisabled]}>↓</Text>
                    </Pressable>
                  )}
                  {isAdmin && (
                    <Pressable onPress={() => setRemoveRoomTarget(room.id)} style={styles.iconBtn} hitSlop={4}>
                      <Text style={styles.roomRemove}>×</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {room.jenisPiket.length > 0 && (
              <View style={styles.chipWrap}>
                {room.jenisPiket.map((j) => (
                  <View key={j.id} style={[styles.chip, !j.isActive && styles.chipOff]}>
                    <Check color={j.isActive ? colors.pine : colors.inkMuted} size={10} strokeWidth={2.4} />
                    <Text style={[styles.chipText, !j.isActive && styles.chipTextOff]}>{j.nama}</Text>
                    {isAdmin && (
                      <Pressable onPress={() => void removeJenis(j)} hitSlop={4}>
                        <Text style={styles.chipRemove}>×</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}

            {isAdmin && (
              <>
                {addingJenis[room.id] ? (
                  <View style={styles.jenisInputRow}>
                    <TextInput
                      style={styles.jenisInput}
                      value={newJenis[room.id] ?? ''}
                      onChangeText={(text) => setNewJenis((p) => ({ ...p, [room.id]: text }))}
                      placeholder="mis. Rapihin Kursi"
                      placeholderTextColor={colors.inkMuted}
                      autoFocus
                    />
                    <Pressable
                      onPress={() => void addJenis(room.id)}
                      disabled={busy || !(newJenis[room.id] ?? '').trim()}
                      style={[styles.jenisAddBtn, (newJenis[room.id] ?? '').trim() && !busy && styles.jenisAddBtnOn]}>
                      <Text style={[styles.jenisAddBtnText, (newJenis[room.id] ?? '').trim() && !busy && styles.jenisAddBtnTextOn]}>
                        Tambah
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setAddingJenis((p) => ({ ...p, [room.id]: false }));
                        setNewJenis((p) => ({ ...p, [room.id]: '' }));
                      }}
                      disabled={busy}
                      style={styles.jenisCancelBtn}>
                      <X color={colors.inkSoft} size={14} strokeWidth={2.2} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setAddingJenis((p) => ({ ...p, [room.id]: true }))}
                    style={styles.dashedBtn}>
                    <Plus color={colors.pine} size={11} strokeWidth={2.6} />
                    <Text style={styles.dashedBtnText}>Tambah jenis piket</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        ))}
      </View>

      {isAdmin && (
        <View style={styles.addRoomWrap}>
          {addingRoom ? (
            <AddRoomForm
              value={newRoom}
              onChange={setNewRoom}
              onClose={() => {
                setAddingRoom(false);
                setNewRoom('');
              }}
              onSave={() => void addRoom()}
              busy={busy}
            />
          ) : (
            <Pressable onPress={() => setAddingRoom(true)} style={styles.addRoomBtn}>
              <Plus color={colors.paper} size={15} strokeWidth={2.4} />
              <Text style={styles.addRoomBtnText}>Tambah Ruangan</Text>
            </Pressable>
          )}
        </View>
      )}
      </View>

      <ConfirmDialog
      visible={removeRoomTarget != null}
      title="Hapus ruangan"
      message="Yakin hapus ruangan ini beserta semua jenis piketnya?"
      confirmText="Hapus"
      danger
      busy={busy}
      onConfirm={() => {
        if (removeRoomTarget) {
          void removeRoom(removeRoomTarget);
        }
      }}
      onCancel={() => setRemoveRoomTarget(null)}
    />
    </>
  );
}

/* ================= AddRoomForm ================= */

function AddRoomForm({
  value,
  onChange,
  onClose,
  onSave,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [rise]);

  const canSave = !busy && value.trim().length > 0;

  return (
    <Animated.View
      style={[
        styles.addRoomCard,
        {
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        },
      ]}>
      <View style={styles.addRoomCardHead}>
        <Text style={styles.addRoomCardTitle}>Ruangan baru</Text>
        <Pressable onPress={onClose} disabled={busy} style={styles.addRoomCardClose} hitSlop={4}>
          <X color={colors.inkSoft} size={14} strokeWidth={2} />
        </Pressable>
      </View>

      <TextInput
        style={styles.addRoomFormInput}
        value={value}
        onChangeText={onChange}
        placeholder="mis. Teras Depan"
        placeholderTextColor={colors.inkMuted}
        autoFocus
      />

      <Text style={styles.addRoomCardHint}>Habis dibuat, tambahin jenis piketnya di kartu ruangan.</Text>

      <Pressable
        onPress={onSave}
        disabled={!canSave}
        style={[styles.addRoomSaveBtn, canSave && styles.addRoomSaveBtnOn]}>
        <Text style={[styles.addRoomSaveBtnText, canSave && styles.addRoomSaveBtnTextOn]}>
          Simpan ruangan
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/* ================= Helpers ================= */

function copyInvite(code: string) {
  toast.success(`Kode ${code} disalin.`);
}

function parseMoney(raw: string): number {
  return parseInt(raw.replace(/\D/g, '') || '0', 10);
}

function EditField({ label, children, flex }: { label?: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <View style={[styles.field, flex && styles.fieldFlex]}>
      {label && <Text style={styles.fieldLabel}>{label}</Text>}
      {children}
    </View>
  );
}

function EditMoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={[styles.field, styles.fieldFlex]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={colors.inkMuted}
        keyboardType="number-pad"
        style={[styles.input, styles.moneyInput, { width: '100%' }]}
      />
    </View>
  );
}

function CostRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.costRow}>
      <Text style={styles.costLabel}>{label}</Text>
      <Text style={[styles.costValue, danger && styles.costValueDanger]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40, gap: 18 },

  /* Kartu dasar */
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 15,
    gap: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardHeadText: { flex: 1, flexDirection: 'column', gap: 3 },
  rumahNama: { fontFamily: fontFamilies.display[600], fontSize: 15, color: colors.ink, letterSpacing: -0.15 },
  rumahAlamat: { fontFamily: fontFamilies.body[400], fontSize: 11, lineHeight: 15, color: colors.inkSoft },
  editBtn: {
    flex: 0,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  editBtnText: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.ink },

  /* Kode invite */
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: 11,
    paddingHorizontal: 12,
  },
  inviteCol: { flex: 1, flexDirection: 'column', gap: 2 },
  inviteLabel: { fontFamily: fontFamilies.mono[500], fontSize: 9.5, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.inkSoft },
  inviteCode: { fontFamily: fontFamilies.mono[700], fontSize: 17, letterSpacing: 2.4, color: colors.ink },
  copyBtn: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  copyBtnText: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.paper },

  /* Section biaya/rekening */
  section: { flexDirection: 'column', gap: 8, borderTopWidth: 1, borderTopColor: colors.paper, paddingTop: 11 },
  sectionTitle: { fontFamily: fontFamilies.display[600], fontSize: 12, color: colors.ink },
  sectionSub: { fontFamily: fontFamilies.body[400], fontSize: 10, color: colors.inkMuted },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 11,
  },
  costLabel: { fontFamily: fontFamilies.body[500], fontSize: 11, color: colors.inkSoft },
  costValue: { fontFamily: fontFamilies.mono[700], fontSize: 12, color: colors.ink },
  costValueDanger: { color: colors.brick },
  rekeningBox: {
    backgroundColor: colors.mustardSoft,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 2,
  },
  rekeningMain: { fontFamily: fontFamilies.mono[700], fontSize: 13, letterSpacing: 0.26, color: colors.ink },
  rekeningName: { fontFamily: fontFamilies.body[500], fontSize: 11, color: colors.mustardText },

  /* Edit mode */
  editTitle: { fontFamily: fontFamilies.display[600], fontSize: 14, color: colors.ink },
  editSectionLabel: {
    fontFamily: fontFamilies.display[600],
    fontSize: 11.5,
    color: colors.ink,
    borderTopWidth: 1,
    borderTopColor: colors.paper,
    paddingTop: 10,
  },
  editSectionSub: { fontFamily: fontFamilies.body[400], fontSize: 10, color: colors.inkMuted },
  field: { gap: 5 },
  fieldFlex: { flex: 1 },
  fieldLabel: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  input: {
    fontFamily: fontFamilies.body[500],
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  moneyInput: { fontFamily: fontFamilies.mono[700], fontSize: 13 },
  inputBank: { fontFamily: fontFamilies.body[600], fontSize: 12.5 },
  inputNumber: { fontFamily: fontFamilies.mono[700], fontSize: 12.5 },
  editRow: { flexDirection: 'row', gap: 9 },
  editActions: { flexDirection: 'row', gap: 8 },
  saveBtn: {
    backgroundColor: colors.pine,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnFlex: { flex: 1 },
  saveBtnText: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.paper },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  cancelBtnText: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.ink },

  /* Section head */
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2, paddingTop: 4 },
  sectionHeadTitle: { fontFamily: fontFamilies.display[600], fontSize: 13, color: colors.ink },
  sectionHeadMeta: { fontFamily: fontFamilies.mono[500], fontSize: 10, color: colors.inkSoft },
  sectionDesc: { fontFamily: fontFamilies.body[400], fontSize: 10.5, lineHeight: 16, color: colors.inkSoft, paddingHorizontal: 2, marginTop: 6 },

  generateCard: {
    backgroundColor: colors.brickSoft,
    borderRadius: radius.xl,
    padding: 14,
    gap: 12,
  },
  generateBody: { gap: 4 },
  generateKicker: { ...type.kicker, fontSize: 9, color: colors.brickDeep },
  generateTitle: { fontFamily: fontFamilies.display[600], fontSize: 14, color: colors.brickDeep },
  generateSub: { fontFamily: fontFamilies.body[400], fontSize: 11, lineHeight: 16, color: colors.brickDeep },
  generateBtn: { backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  generateBtnDisabled: { backgroundColor: colors.disabledBg },
  generateBtnPressed: { backgroundColor: colors.pineDeep },
  generateBtnText: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.paper },
  generateBtnTextDisabled: { color: colors.disabledFg },

  listCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    paddingVertical: 4,
    paddingHorizontal: 13,
    marginTop: 8,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  memberDivider: { height: 1, backgroundColor: colors.paper },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: { fontFamily: fontFamilies.display[600], fontSize: 13, color: colors.paper },
  memberInfo: { flex: 1, minWidth: 0, gap: 2 },
  memberName: { fontFamily: fontFamilies.body[600], fontSize: 13, color: colors.ink },
  memberSub: { fontFamily: fontFamilies.mono[400], fontSize: 10.5, color: colors.inkSoft },
  pjBadge: {
    backgroundColor: colors.pine,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  pjBadgeText: { fontFamily: fontFamilies.body[600], fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.paper },
  moreBtn: { padding: 4 },
  moreText: { fontFamily: fontFamilies.body[600], fontSize: 15, lineHeight: 15, color: colors.inkSoft },

  /* Ruangan */
  roomList: { gap: 10, marginTop: 8 },
  roomCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 13,
    gap: 10,
  },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  grip: { gap: 3, paddingVertical: 2 },
  gripLine: { width: 13, height: 1.5, backgroundColor: colors.lineDash },
  roomIndex: { fontFamily: fontFamilies.mono[500], fontSize: 10, color: colors.inkMuted },
  roomName: { flex: 1, minWidth: 0, fontFamily: fontFamilies.body[600], fontSize: 14, letterSpacing: -0.14, color: colors.ink },
  roomMeta: { fontFamily: fontFamilies.mono[500], fontSize: 10, color: colors.inkSoft },
  roomActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveDown: { fontFamily: fontFamilies.body[600], fontSize: 11, lineHeight: 11, color: colors.inkSoft },
  moveDownDisabled: { opacity: 0.35 },
  roomRemove: { fontFamily: fontFamilies.body[500], fontSize: 15, lineHeight: 15, color: colors.inkMuted },
  renameRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  renameInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamilies.body[600],
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.pine,
    borderRadius: radius.sm,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  renameDone: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paper,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 9,
  },
  chipOff: { opacity: 0.55 },
  chipText: { fontFamily: fontFamilies.body[500], fontSize: 11.5, color: colors.ink },
  chipTextOff: { color: colors.inkMuted },
  chipRemove: { fontFamily: fontFamilies.body[500], fontSize: 12, lineHeight: 12, color: colors.inkMuted },
  dashedBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineDash,
    backgroundColor: colors.paper,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dashedBtnText: { fontFamily: fontFamilies.body[600], fontSize: 11, color: colors.pine },
  jenisInputRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  jenisInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamilies.body[500],
    fontSize: 12,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 11,
  },
  jenisAddBtn: {
    flexShrink: 0,
    backgroundColor: colors.disabledBg,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  jenisAddBtnOn: { backgroundColor: colors.pine },
  jenisAddBtnText: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.disabledFg },
  jenisAddBtnTextOn: { color: colors.paper },
  jenisCancelBtn: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRoomWrap: { marginTop: 12 },
  addRoomCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 13,
    gap: 10,
  },
  addRoomCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  addRoomCardTitle: { fontFamily: fontFamilies.display[600], fontSize: 13, color: colors.ink },
  addRoomCardClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRoomFormInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontFamily: fontFamilies.body[500],
    fontSize: 12.5,
    color: colors.ink,
  },
  addRoomCardHint: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.inkSoft,
    maxWidth: 260,
  },
  addRoomSaveBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.disabledBg,
    alignItems: 'center',
  },
  addRoomSaveBtnOn: { backgroundColor: colors.pine },
  addRoomSaveBtnText: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.disabledFg },
  addRoomSaveBtnTextOn: { color: colors.paper },
  addRoomBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  addRoomBtnText: { fontFamily: fontFamilies.body[600], fontSize: 13, color: colors.paper },
});
