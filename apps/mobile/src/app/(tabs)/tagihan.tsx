import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Plus, ReceiptText } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SerumahLogo } from '@/components/logo/serumah-logo';
import { MonthPicker } from '@/components/tagihan/month-picker';
import { Stamp } from '@/components/ui/stamp';
import { formatCurrency, formatShortDate } from '@/lib/format';
import {
  apiApproveDenda,
  apiConfirmIuranLunas,
  apiCreateListrik,
  apiRejectDenda,
  apiUploadBuktiTotal,
  apiUploadDendaBukti,
  currentMonth,
  tagihanKeys,
  useCurrentMember,
  useTagihanQueries,
  type Denda,
  type IuranItem,
  type ListrikRecord,
} from '@/features/tagihan/api/tagihan';
import { uploadProof } from '@/features/tagihan/api/upload';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

type Segment = 'denda' | 'iuran' | 'listrik';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'denda', label: 'Denda' },
  { key: 'iuran', label: 'Iuran' },
  { key: 'listrik', label: 'Listrik' },
];

export default function TagihanScreen() {
  const [bulan, setBulan] = useState(currentMonth());
  const [segment, setSegment] = useState<Segment>('denda');

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <MonthPicker value={bulan} onChange={setBulan} />
      <View style={styles.segments}>
        {SEGMENTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSegment(s.key)}
            style={[styles.seg, segment === s.key && styles.segActive]}>
            <Text style={[styles.segText, segment === s.key && styles.segTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {segment === 'denda' && <DendaView bulan={bulan} />}
        {segment === 'iuran' && <IuranView bulan={bulan} />}
        {segment === 'listrik' && <ListrikView bulan={bulan} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <SerumahLogo size={22} variant="mark" roofColor={colors.ink} />
        <Text style={styles.brandText}>Tagihan</Text>
      </View>
    </View>
  );
}

/* ------------------------------ Denda ------------------------------ */

function DendaView({ bulan }: { bulan: string }) {
  const queries = useTagihanQueries(bulan);
  const my = useCurrentMember();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  if (queries.denda.isLoading) return <Loading />;
  const data = queries.denda.data;
  if (!data) return <Loading />;

  const myId = my.data?.user?.id ?? null;
  const isPj = my.data?.anggota?.role === 'admin';
  const myDenda = data.denda.filter((d) => d.anggota.id === myId);
  const pending = data.denda.filter((d) => d.status === 'menunggu_konfirmasi' && d.anggota.id !== myId);
  const unpaid = myDenda.filter((d) => d.status === 'belum_bayar');
  const totalUnpaid = unpaid.reduce((s, d) => s + d.nominal, 0);

  const revalidate = () => {
    void queryClient.invalidateQueries({ queryKey: tagihanKeys.denda(bulan) });
  };

  const onUpload = async (d: Denda) => {
    const uri = await capturePhoto();
    if (!uri) return;
    setBusy(d.id);
    try {
      const url = await uploadProof('denda-bukti', uri, d.id);
      await apiUploadDendaBukti(d.id, url);
      revalidate();
    } catch (e) {
      Alert.alert('Gagal', errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const onApprove = async (id: string) => {
    setBusy(id);
    try {
      await apiApproveDenda(id);
      revalidate();
    } catch (e) {
      Alert.alert('Gagal', errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const onReject = async (id: string) => {
    setBusy(id);
    try {
      await apiRejectDenda(id);
      revalidate();
    } catch (e) {
      Alert.alert('Gagal', errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryKicker}>TAGIHAN DENDA</Text>
        <Text style={[styles.summaryAmount, unpaid.length === 0 && styles.amountPaid]}>
          {unpaid.length === 0 ? 'Lunas' : formatCurrency(totalUnpaid)}
        </Text>
        <Text style={styles.summarySub}>{unpaid.length} tagihan belum bayar</Text>
      </View>

      {myDenda.length === 0 && pending.length === 0 ? (
        <Empty text={`Tidak ada denda untuk ${bulan}`} />
      ) : (
        <>
          {myDenda.map((d) => (
            <BillView
              key={d.id}
              denda={d}
              qrisUrl={data.qrisUrl}
              busy={busy === d.id}
              onUpload={() => void onUpload(d)}
            />
          ))}
          {isPj && pending.length > 0 && (
            <View style={styles.approvalSection}>
              <Text style={styles.approvalTitle}>Perlu konfirmasi dari lo</Text>
              {pending.map((d) => (
                <ApprovalCard
                  key={d.id}
                  name={d.anggota.nama}
                  nominal={d.nominal}
                  bukti={d.buktiBayar}
                  busy={busy === d.id}
                  onApprove={() => void onApprove(d.id)}
                  onReject={() => void onReject(d.id)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function BillView({
  denda,
  qrisUrl,
  busy,
  onUpload,
}: {
  denda: Denda;
  qrisUrl: string | null;
  busy: boolean;
  onUpload: () => void;
}) {
  const [showQris, setShowQris] = useState(false);
  return (
    <View style={styles.billCard}>
      <View style={styles.billTop}>
        <View style={styles.billTexts}>
          <Text style={styles.billReason}>Denda piket</Text>
          <Text style={styles.billDate}>{formatShortDate(denda.createdAt)}</Text>
        </View>
        <Stamp status={denda.status} />
      </View>
      <Text style={styles.billAmount}>{formatCurrency(denda.nominal)}</Text>

      {denda.status === 'belum_bayar' && (
        <View style={styles.billActions}>
          <Pressable onPress={() => setShowQris((v) => !v)} disabled={!qrisUrl} style={styles.qrisBtn}>
            <Text style={styles.qrisBtnText}>Show QRIS</Text>
          </Pressable>
          <Pressable onPress={onUpload} disabled={busy} style={styles.payBtn}>
            <Text style={styles.payBtnText}>{busy ? 'Mengunggah…' : 'Upload Bukti'}</Text>
          </Pressable>
        </View>
      )}
      {denda.status === 'menunggu_konfirmasi' && (
        <Text style={styles.waitNote}>nunggu konfirmasi PJ</Text>
      )}
      {showQris && qrisUrl != null && (
        <Pressable onPress={() => showImage(qrisUrl)} style={styles.qrisPreview}>
          <Text style={styles.qrisPreviewText}>Lihat QRIS pembayaran</Text>
        </Pressable>
      )}
    </View>
  );
}

function ApprovalCard({
  name,
  nominal,
  bukti,
  busy,
  onApprove,
  onReject,
}: {
  name: string;
  nominal: number;
  bukti: string | null;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.approvalCard}>
      <Pressable onPress={() => bukti && showImage(bukti)}>
        <Text style={styles.approvalClaim}>
          {name} bayar {formatCurrency(nominal)}
        </Text>
      </Pressable>
      <View style={styles.approvalActions}>
        <Pressable onPress={onReject} disabled={busy} style={styles.rejectBtn}>
          <Text style={styles.rejectText}>Reject</Text>
        </Pressable>
        <Pressable onPress={onApprove} disabled={busy} style={styles.approveBtn}>
          <Text style={styles.approveText}>{busy ? '…' : 'Approve'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------ Iuran ------------------------------ */

function IuranView({ bulan }: { bulan: string }) {
  const queries = useTagihanQueries(bulan);
  const my = useCurrentMember();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (queries.iuran.isLoading) return <Loading />;
  const data = queries.iuran.data;
  if (!data) return <Loading />;

  const myId = my.data?.user?.id ?? null;
  const isPj = my.data?.anggota?.role === 'admin';
  const myIuran = data.iuranList.filter((i) => i.anggota.id === myId);
  const unpaid = myIuran.filter((i) => i.status === 'belum_bayar');
  const total = myIuran.reduce((s, i) => s + i.nominal, 0);
  const nAnggota = new Set(data.iuranList.map((i) => i.anggota.id)).size;
  const pending = data.iuranList.filter((i) => i.status === 'menunggu_konfirmasi' && i.anggota.id !== myId);

  const revalidate = () => {
    void queryClient.invalidateQueries({ queryKey: tagihanKeys.iuran(bulan) });
  };

  const onUploadTotal = async () => {
    const uri = await capturePhoto();
    if (!uri) return;
    setBusy(true);
    try {
      const url = await uploadProof('iuran-bukti', uri, bulan);
      await apiUploadBuktiTotal(bulan, url);
      revalidate();
      Alert.alert('Terkirim', 'Bukti iuran berhasil diunggah.');
    } catch (e) {
      Alert.alert('Gagal', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async (id: string) => {
    setBusy(true);
    try {
      await apiConfirmIuranLunas(id);
      revalidate();
    } catch (e) {
      Alert.alert('Gagal', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.iuranTotalCard}>
        <View style={styles.iuranHeader}>
          <ReceiptText color={colors.ink} size={16} strokeWidth={2} />
          <Text style={styles.iuranKicker}>IURAN BULANAN · {bulan}</Text>
        </View>
        <Text style={[styles.iuranTotal, unpaid.length === 0 && styles.amountPaid]}>
          {formatCurrency(total)}
        </Text>
        <Text style={styles.iuranSub}>
          Rp {formatInt(Math.round(data.rumah.totalPerBulan / Math.max(nAnggota, 1)))} ÷ {Math.max(nAnggota, 1)} anggota aktif
        </Text>
      </View>

      {data.rumah.rekening.bank != null && (
        <Text style={styles.rekening}>
          Bayar ke: {data.rumah.rekening.bank} {data.rumah.rekening.nomor} a.n.{' '}
          {data.rumah.rekening.nama}
        </Text>
      )}

      <View style={styles.categoryList}>
        {myIuran.map((i) => (
          <CategoryRow key={i.id} item={i} />
        ))}
      </View>

      {unpaid.length > 0 && (
        <Pressable onPress={() => void onUploadTotal()} disabled={busy} style={styles.uploadBtn}>
          <Text style={styles.uploadBtnText}>{busy ? 'Mengunggah…' : 'Upload Bukti Bayar'}</Text>
        </Pressable>
      )}

      {isPj && pending.length > 0 && (
        <View style={styles.approvalSection}>
          <View style={styles.approvalHeaderRow}>
            <Text style={styles.approvalTitle}>Perlu konfirmasi dari lo</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pending.length} nunggu</Text>
            </View>
          </View>
          {pending.map((i) => (
            <View key={i.id} style={styles.pendingIuranRow}>
              <Text style={styles.pendingIuranText}>
                {i.anggota.nama} · {i.label}
              </Text>
              <Pressable onPress={() => void onConfirm(i.id)} disabled={busy} style={styles.approveBtn}>
                <Text style={styles.approveText}>{busy ? '…' : 'Lunas'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function CategoryRow({ item }: { item: IuranItem }) {
  return (
    <View style={styles.categoryRow}>
      <Text style={styles.categoryLabel}>{item.label}</Text>
      <View style={styles.categoryRight}>
        <Text style={styles.categoryAmount}>{formatCurrency(item.nominal)}</Text>
        <Stamp status={item.status} />
      </View>
    </View>
  );
}

/* ------------------------------ Listrik ------------------------------ */

function ListrikView({ bulan }: { bulan: string }) {
  const queries = useTagihanQueries(bulan);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [nominal, setNominal] = useState('');
  const [note, setNote] = useState('');
  const [bukti, setBukti] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (queries.listrik.isLoading) return <Loading />;
  const data = queries.listrik.data;
  if (!data) return <Loading />;

  const revalidate = () => {
    void queryClient.invalidateQueries({ queryKey: tagihanKeys.listrik(bulan) });
  };

  const createEnabled = nominal.replace(/\D/g, '').length > 0 && bukti != null && !busy;

  const onCreate = async () => {
    if (!bukti || !createEnabled) return;
    setBusy(true);
    try {
      const url = await uploadProof('listrik', bukti, 'record');
      await apiCreateListrik({
        bulan,
        nominal: parseInt(nominal.replace(/\D/g, ''), 10) || 0,
        keterangan: note || undefined,
        buktiUrl: url,
      });
      setShowForm(false);
      setNominal('');
      setNote('');
      setBukti(null);
      revalidate();
    } catch (e) {
      Alert.alert('Gagal', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.listrikSummary}>
        <Text style={styles.listrikKicker}>TOTAL BELANJA LISTRIK TAMBAHAN</Text>
        <Text style={styles.listrikTotal}>{formatCurrency(data.total)}</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  data.total > 0 ? Math.round((data.myBought / data.total) * 100) : 0
                }%`,
              },
            ]}
          />
        </View>
        <Text style={styles.listrikSub}>
          {formatCurrency(data.myBought)} dibeli lo · sisanya anggota lain
        </Text>
        <View style={styles.listrikNote}>
          <Text style={styles.listrikNoteText}>
            Listrik tambahan {formatCurrency(data.total)} dibagi rata: tagihan lo{' '}
            {data.myCredit >= 0 ? '+' : ''}
            {formatCurrency(data.myCredit)} bulan depan
          </Text>
        </View>
      </View>

      <Pressable onPress={() => setShowForm((v) => !v)} style={styles.addBtn}>
        <Plus color={colors.paper} size={16} strokeWidth={2.4} />
        <Text style={styles.addBtnText}>Tambah Record Beli Listrik</Text>
      </Pressable>

      {showForm && (
        <View style={styles.formCard}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Nominal (Rp)</Text>
            <TextInput
              style={styles.input}
              value={nominal}
              onChangeText={setNominal}
              placeholder="0"
              keyboardType="number-pad"
              placeholderTextColor={colors.inkMuted}
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Keterangan</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="opsional"
              placeholderTextColor={colors.inkMuted}
            />
          </View>
          <Pressable onPress={() => void pickListrikProof(setBukti)} style={styles.buktiBtn}>
            {bukti ? (
              <Text style={styles.buktiReady}>✓</Text>
            ) : (
              <Camera color={colors.ink} size={16} strokeWidth={2} />
            )}
            <Text style={styles.buktiText}>{bukti ? 'Foto siap' : 'Foto bukti (wajib)'}</Text>
          </Pressable>
          <Pressable
            onPress={() => void onCreate()}
            disabled={!createEnabled}
            style={[styles.submitBtn, !createEnabled && styles.submitBtnDisabled]}>
            <Text style={styles.submitText}>{busy ? 'Menyimpan…' : 'Simpan'}</Text>
          </Pressable>
        </View>
      )}

      {data.records.map((r) => (
        <ListrikRecordCard key={r.id} record={r} />
      ))}
      {data.records.length === 0 && !showForm && (
        <Empty text="Belum ada beli listrik bulan ini" />
      )}
    </View>
  );
}

function ListrikRecordCard({ record }: { record: ListrikRecord }) {
  return (
    <View style={styles.listrikRecord}>
      <View style={styles.recordTop}>
        <View style={styles.recordLeft}>
          <Text style={styles.recordName}>{record.anggota.nama}</Text>
          <Text style={styles.recordDate}>{formatShortDate(record.createdAt)}</Text>
        </View>
        <Text style={styles.recordAmount}>{formatCurrency(record.nominal)}</Text>
      </View>
      <Pressable onPress={() => record.buktiBayar && showImage(record.buktiBayar!)}>
        <Text style={styles.recordProof}>Lihat bukti</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------ Shared ------------------------------ */

async function capturePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Izin kamera', 'Izinkan kamera untuk memotret bukti pembayaran.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

async function pickListrikProof(setBukti: (uri: string | null) => void) {
  const uri = await capturePhoto();
  setBukti(uri);
}

function showImage(url: string) {
  Alert.alert('Bukti', 'Buka gambar bukti pembayaran', [
    { text: 'Tutup' },
    { text: 'Lihat' },
  ]);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Terjadi kesalahan.';
}

function formatInt(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
}

function Loading() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Memuat…</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
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
  segments: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: colors.paperDeep,
    borderRadius: radius['2xl'],
    padding: 3,
    gap: 4,
  },
  seg: { flex: 1, borderRadius: radius['xl'], paddingVertical: 9, alignItems: 'center' },
  segActive: { backgroundColor: colors.card },
  segText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.inkSoft },
  segTextActive: { color: colors.ink },
  content: { paddingHorizontal: 20, paddingBottom: 108, gap: 12 },
  section: { gap: 12 },
  loading: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { ...type.body, color: colors.inkMuted, textAlign: 'center' },

  summaryCard: {
    backgroundColor: colors.brickSoft,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 2,
  },
  summaryKicker: { ...type.kicker, fontSize: 9, color: colors.brickDeep },
  summaryAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.brick,
  },
  amountPaid: { color: colors.pineDeep },
  summarySub: { ...type.body, fontSize: 11, color: colors.brickDeep },

  billCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 10,
  },
  billTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billTexts: { gap: 2 },
  billReason: { fontFamily: fontFamilies.body[600], fontSize: 13, color: colors.ink },
  billDate: { fontFamily: fontFamilies.body[400], fontSize: 10.5, color: colors.inkSoft },
  billAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.brick,
  },
  billActions: { flexDirection: 'row', gap: 10 },
  qrisBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: colors.paper,
  },
  qrisBtnText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.ink },
  payBtn: {
    flex: 1,
    backgroundColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  payBtnText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.paper },
  waitNote: { fontFamily: fontFamilies.body[400], fontSize: 11, color: colors.mustardInk },
  qrisPreview: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  qrisPreviewText: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.ink },

  approvalSection: {
    backgroundColor: colors.mustardSoft,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 10,
  },
  approvalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  approvalTitle: { fontFamily: fontFamilies.display[600], fontSize: 13.5, color: colors.mustardInk },
  badge: {
    backgroundColor: colors.mustard,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeText: { fontFamily: fontFamilies.body[700], fontSize: 10, color: colors.mustardInkStrong },
  approvalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    gap: 10,
  },
  approvalClaim: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.ink },
  approvalActions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.brick },
  approveBtn: {
    flex: 1,
    backgroundColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.paper },
  pendingIuranRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    gap: 10,
  },
  pendingIuranText: { flex: 1, fontFamily: fontFamilies.body[500], fontSize: 12, color: colors.ink },

  iuranTotalCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 4,
  },
  iuranHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iuranKicker: { ...type.kicker, fontSize: 9.5, color: colors.inkSoft },
  iuranTotal: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.brick,
  },
  iuranSub: { fontFamily: fontFamilies.body[400], fontSize: 11, color: colors.inkSoft },
  rekening: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11.5,
    color: colors.inkSoft,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    padding: 12,
  },
  categoryList: { gap: 8 },
  categoryRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryLabel: { flex: 1, fontFamily: fontFamilies.body[500], fontSize: 12.5, color: colors.ink },
  categoryRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryAmount: { fontFamily: fontFamilies.mono[600], fontSize: 13, color: colors.ink },
  uploadBtn: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadBtnText: { fontFamily: fontFamilies.body[700], fontSize: 13, color: colors.paper },

  listrikSummary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 8,
  },
  listrikKicker: { ...type.kicker, fontSize: 9, color: colors.inkSoft },
  listrikTotal: { fontFamily: fontFamilies.mono[700], fontSize: 26, letterSpacing: -0.5, color: colors.ink },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: colors.mustard },
  listrikSub: { fontFamily: fontFamilies.body[400], fontSize: 11, color: colors.inkSoft },
  listrikNote: {
    backgroundColor: colors.pineSoft,
    borderRadius: radius.md,
    padding: 12,
  },
  listrikNoteText: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.pineDeep },
  addBtn: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: { fontFamily: fontFamilies.body[700], fontSize: 13, color: colors.paper },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 12,
  },
  inputRow: { gap: 6 },
  inputLabel: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.inkSoft },
  input: {
    fontFamily: fontFamilies.mono[600],
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  buktiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 13,
    backgroundColor: colors.paper,
  },
  buktiReady: { fontFamily: fontFamilies.body[700], fontSize: 15, color: colors.pine },
  buktiText: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.ink },
  submitBtn: {
    backgroundColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.disabledBg },
  submitText: { fontFamily: fontFamilies.body[700], fontSize: 13, color: colors.paper },
  listrikRecord: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
    gap: 8,
  },
  recordTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordLeft: { gap: 2 },
  recordName: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.ink },
  recordDate: { fontFamily: fontFamilies.body[400], fontSize: 10.5, color: colors.inkSoft },
  recordAmount: { fontFamily: fontFamilies.mono[700], fontSize: 15, color: colors.ink },
  recordProof: { fontFamily: fontFamilies.body[600], fontSize: 11, color: colors.pine },
});