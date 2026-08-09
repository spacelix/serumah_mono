import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { ArrowUp, Camera, Check, ChevronRight, Plus, QrCode, ReceiptText, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { MonthPicker } from '@/components/tagihan/month-picker';
import { Stamp } from '@/components/ui/stamp';
import { previewImage } from '@/components/ui/photo-preview';
import { formatCurrency, formatShortDate, formatWeekdayDate } from '@/lib/format';
import { mediaSource } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { dialog } from '@/stores/dialog-store';
import { toast } from '@/stores/toast-store';
import {
  apiApproveDenda,
  apiConfirmIuranLunas,
  apiCreateListrik,
  apiRejectDenda,
  apiUploadBuktiTotal,
  apiUploadDendaBukti,
  currentMonth,
  formatMonthLabel,
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
      <ScreenHeader
        title="Tagihan"
        kicker={`VERIFIKASI SOSIAL · ${formatMonthLabel(bulan)}`}
      />
      <View style={styles.segments}>
        {SEGMENTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSegment(s.key)}
            style={[styles.seg, segment === s.key && styles.segActive]}
          >
            <Text
              style={[
                styles.segText,
                segment === s.key && styles.segTextActive,
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <MonthPicker value={bulan} onChange={setBulan} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {segment === 'denda' && <DendaView bulan={bulan} />}
        {segment === 'iuran' && <IuranView bulan={bulan} />}
        {segment === 'listrik' && <ListrikView bulan={bulan} />}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------ Denda ------------------------------ */

function DendaView({ bulan }: { bulan: string }) {
  const queries = useTagihanQueries(bulan);
  const my = useCurrentMember();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Denda | null>(null);

  if (queries.denda.isLoading) return <Loading />;
  const data = queries.denda.data;
  if (!data) return <Loading />;

  const myId = my.data?.user?.id ?? null;
  const isPj = my.data?.anggota?.role === 'admin';
  const myDenda = data.denda.filter((d) => d.anggota.id === myId);
  const pending = data.denda.filter(
    (d) => d.status === 'menunggu_konfirmasi' && d.anggota.id !== myId,
  );
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
      setSelected(null);
      revalidate();
    } catch (e) {
      dialog.alert('Gagal', errMsg(e));
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
      dialog.alert('Gagal', errMsg(e));
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
      dialog.alert('Gagal', errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryKicker}>Belum lunas</Text>
          <Text style={styles.summarySub}>
            {unpaid.length} tagihan aktif
          </Text>
        </View>
        <Text style={styles.summaryAmount}>
          {formatCurrency(totalUnpaid)}
        </Text>
      </View>

      {myDenda.length === 0 && pending.length === 0 ? (
        <EmptyState
          icon={
            <ReceiptText color={colors.inkSoft} size={22} strokeWidth={2} />
          }
          title={`Tidak ada denda untuk ${bulan}`}
          sub="Piket yang nggak dikerjain atau ditolak otomatis jadi tagihan denda di sini."
        />
      ) : (
        <>
          {myDenda.map((d) => (
            <BillView
              key={d.id}
              denda={d}
              onPress={() => setSelected(d)}
            />
          ))}
          {isPj && pending.length > 0 && (
            <View style={styles.claimSection}>
              <View style={styles.claimHeader}>
                <Text style={styles.claimTitle}>Konfirmasi bayar</Text>
                <Text style={styles.claimCount}>{pending.length} nunggu</Text>
              </View>
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
      <DendaDetailSheet
        denda={selected}
        qrisUrl={data.qrisUrl}
        busy={selected != null && busy === selected.id}
        onClose={() => setSelected(null)}
        onUpload={() => {
          if (selected) void onUpload(selected);
        }}
      />
    </View>
  );
}

function BillView({
  denda,
  onPress,
}: {
  denda: Denda;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.billCard}
    >
      <View style={styles.billTop}>
        <View style={styles.billTexts}>
          <Text style={styles.billReason}>Denda piket</Text>
          <Text style={styles.billDate}>{dendaNote(denda)}</Text>
        </View>
        <Stamp
          status={denda.status}
          animate={denda.status === 'lunas' || denda.origin === 'rejected'}
        />
      </View>
      <Text style={[styles.billAmount, denda.status === 'lunas' && styles.amountPaid]}>
        {formatCurrency(denda.nominal)}
      </Text>
      {denda.status === 'menunggu_konfirmasi' && (
        <Text style={styles.waitNote}>nunggu konfirmasi PJ</Text>
      )}
      {onPress != null && denda.status === 'belum_bayar' && (
        <View style={styles.billHintRow}>
          <QrCode color={colors.inkSoft} size={13} strokeWidth={2.2} />
          <Text style={styles.billHintText}>
            Ketuk buat lihat penyebab & bayar QRIS
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Bottom sheet: penyebab denda per ruangan + QRIS di atas + tombol upload bukti. */
function DendaDetailSheet({
  denda,
  qrisUrl,
  busy,
  onClose,
  onUpload,
}: {
  denda: Denda | null;
  qrisUrl: string | null;
  busy: boolean;
  onClose: () => void;
  onUpload: () => void;
}) {
  const token = useAuthStore((s) => s.token);
  const qrisSource = mediaSource(qrisUrl, token);

  return (
    <Modal
      visible={denda != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetHandle} />
          {denda && (
            <>
              <View style={styles.sheetHead}>
                <View style={styles.sheetHeadText}>
                  <Text style={styles.sheetTitle}>Denda piket</Text>
                  <Text style={styles.sheetMeta}>{dendaNote(denda)}</Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={styles.sheetClose}
                >
                  <X color={colors.inkSoft} size={18} strokeWidth={2.4} />
                </Pressable>
              </View>

              <Text style={styles.sheetAmount}>
                {formatCurrency(denda.nominal)}
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
              >
                {denda.origin === 'auto' ? (
                  <View style={styles.causeCard}>
                    <Text style={styles.causeTitle}>Piket nggak dikerjain</Text>
                    <Text style={styles.causeSub}>
                      Nggak ada submission piket, jadi auto-denda saat deadline
                      20:00.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.causeCard}>
                    <Text style={styles.causeTitle}>
                      {denda.origin === 'rejected'
                        ? `Piket ditolak${denda.reviewerNama ? ` ${denda.reviewerNama}` : ''}`
                        : `Piket di-approve · sisa ${denda.reviewerNama ?? 'PJ'}`}
                    </Text>
                    <Text style={styles.causeSub}>
                      Denda dihitung dari jenis piket yang nggak dikerjain
                      (dibagi rata per jenis).
                    </Text>
                  </View>
                )}

                {denda.detail.map((room) => (
                  <View key={room.ruanganNama} style={styles.roomCard}>
                    <View style={styles.roomHead}>
                      <Text style={styles.roomName}>{room.ruanganNama}</Text>
                      <Text style={styles.roomCount}>
                        {room.jenisSelesai.length}/{room.jenisList.length}
                      </Text>
                    </View>
                    <View style={styles.jenisChips}>
                      {room.jenisList.map((j) => {
                        const done = room.jenisSelesai.includes(j);
                        return (
                          <View
                            key={j}
                            style={[
                              styles.jenisChip,
                              !done && styles.jenisChipMissed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.jenisChipText,
                                !done && styles.jenisChipTextMissed,
                              ]}
                            >
                              {done ? '✓' : '×'} {j}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {denda.status === 'belum_bayar' && qrisSource && (
                  <View style={styles.sheetQrisBlock}>
                    <Text style={styles.sheetSectionLabel}>
                      Bayar via QRIS
                    </Text>
                    <ExpoImage
                      source={qrisSource}
                      style={styles.sheetQris}
                      contentFit="contain"
                    />
                    <Text style={styles.sheetQrisHint}>
                      Scan QRIS ini buat transfer, lalu pilih bukti transfer
                      untuk diverifikasi PJ.
                    </Text>
                  </View>
                )}
              </ScrollView>

              {denda.status === 'belum_bayar' && (
                <View style={styles.sheetFooter}>
                  <Pressable
                    onPress={onUpload}
                    disabled={busy}
                    style={[styles.uploadBtn, busy && styles.uploadBtnDisabled]}
                  >
                    <Camera color={colors.paper} size={16} strokeWidth={2.2} />
                    <Text style={styles.uploadBtnText}>
                      {busy ? 'Mengunggah…' : 'Upload Bukti Bayar'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </Pressable>
    </Modal>
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
    <View style={styles.claimCard}>
      <View style={styles.claimCardTop}>
        <Pressable
          onPress={() => bukti && previewImage(bukti)}
          style={styles.claimTexts}
        >
          <Text style={styles.claimName}>{name} udah bayar</Text>
          <Text style={styles.claimNote}>
            {bukti
              ? 'Bayar via QRIS · klik buat lihat bukti transfer'
              : 'Tanpa bukti'}
          </Text>
        </Pressable>
        <Text style={styles.claimAmount}>{formatCurrency(nominal)}</Text>
      </View>
      <View style={styles.claimActions}>
        <Pressable
          onPress={onApprove}
          disabled={busy}
          style={styles.claimApproveBtn}
        >
          <Text style={styles.claimApproveText}>
            {busy ? '…' : 'Approve'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onReject}
          disabled={busy}
          style={styles.claimRejectBtn}
        >
          <Text style={styles.claimRejectText}>Reject</Text>
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
  const [verifyMember, setVerifyMember] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upUri, setUpUri] = useState<string | null>(null);

  if (queries.iuran.isLoading) return <Loading />;
  const data = queries.iuran.data;
  if (!data) return <Loading />;

  const myId = my.data?.user?.id ?? null;
  const isPj = my.data?.anggota?.role === 'admin';
  const myIuran = data.iuranList.filter((i) => i.anggota.id === myId);
  const unpaid = myIuran.filter((i) => i.status === 'belum_bayar');
  const total = myIuran.reduce((s, i) => s + i.nominal, 0);
  const nAnggota = new Set(data.iuranList.map((i) => i.anggota.id)).size;
  const pending = data.iuranList.filter(
    (i) => i.status === 'menunggu_konfirmasi' && i.anggota.id !== myId,
  );
  const pendingGroups = pending.reduce<Map<string, IuranItem[]>>((groups, i) => {
    const list = groups.get(i.anggota.id) ?? [];
    list.push(i);
    groups.set(i.anggota.id, list);
    return groups;
  }, new Map());
  const verifyItems = verifyMember
    ? (pendingGroups.get(verifyMember) ?? [])
    : [];

  const revalidate = () => {
    void queryClient.invalidateQueries({ queryKey: tagihanKeys.iuran(bulan) });
  };

  const unpaidTotal = unpaid.reduce((s, i) => s + i.nominal, 0);
  const iuranStatus =
    unpaid.length > 0
      ? 'belum_bayar'
      : myIuran.every((i) => i.status === 'lunas')
        ? 'lunas'
        : 'menunggu_konfirmasi';
  const payTotal = unpaid.length > 0 ? unpaidTotal : total;

  const onPickUpload = async () => {
    const uri = await capturePhoto();
    if (uri) setUpUri(uri);
  };

  const onSubmitUpload = async () => {
    if (!upUri) return;
    setBusy(true);
    try {
      const url = await uploadProof('iuran-bukti', upUri, bulan);
      await apiUploadBuktiTotal(bulan, url);
      revalidate();
      setUpUri(null);
      setUploadOpen(false);
      dialog.alert('Terkirim', 'Bukti iuran berhasil diunggah.');
    } catch (e) {
      dialog.alert('Gagal', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleChecked = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onVerify = async () => {
    const ids = [...checked];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      for (const id of ids) {
        await apiConfirmIuranLunas(id);
      }
      setChecked(new Set());
      setVerifyMember(null);
      revalidate();
    } catch (e) {
      dialog.alert('Gagal', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      {data.rumah.rekening.bank != null && (
        <RekeningCard reken={data.rumah.rekening} />
      )}

      <View style={styles.iuranCard}>
        <View style={styles.iuranCardHead}>
          <View style={styles.iuranCardTile}>
            <ReceiptText size={18} strokeWidth={1.9} color={colors.pine} />
          </View>
          <View style={styles.iuranCardInfo}>
            <Text style={styles.iuranCardLabel}>
              Iuran Bulanan — {formatMonthLabel(bulan)}
            </Text>
            <Text
              style={[
                styles.iuranCardAmount,
                unpaid.length === 0 && styles.iuranCardAmountPaid,
              ]}
            >
              {formatCurrency(payTotal)}
            </Text>
            <Text style={styles.iuranCardSub}>
              {formatCurrency(Math.round(payTotal * nAnggota))} ÷{' '}
              {Math.max(nAnggota, 1)} anggota aktif
            </Text>
          </View>
          <Stamp status={iuranStatus} />
        </View>
        {unpaid.length > 0 && (
          <Pressable
            onPress={() => setUploadOpen(true)}
            disabled={busy}
            style={({ pressed }) => [
              styles.iuranCardBtn,
              pressed && styles.iuranCardBtnPressed,
            ]}
          >
            <ArrowUp size={14} strokeWidth={2.2} color={colors.paper} />
            <Text style={styles.iuranCardBtnText}>Upload Bukti Bayar</Text>
          </Pressable>
        )}
      </View>

      {uploadOpen && (
        <IuranUploadSheet
          bulan={bulan}
          amount={unpaidTotal}
          items={unpaid}
          anggotaAktif={Math.max(nAnggota, 1)}
          bank={data.rumah.rekening.bank ?? null}
          nomor={data.rumah.rekening.nomor ?? null}
          rekeningName={data.rumah.rekening.nama ?? null}
          uri={upUri}
          busy={busy}
          onPick={() => void onPickUpload()}
          onSubmit={() => void onSubmitUpload()}
          onClose={() => {
            setUpUri(null);
            setUploadOpen(false);
          }}
        />
      )}

      {isPj && pending.length > 0 && (
        <View style={styles.verifySection}>
          <View style={styles.verifyHeader}>
            <Text style={styles.verifyTitle}>Perlu konfirmasi dari lo</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pending.length}</Text>
            </View>
          </View>
          {[...pendingGroups.entries()].map(([memberId, items]) => {
            const member = items[0].anggota;
            return (
              <Pressable
                key={memberId}
                onPress={() => {
                  setChecked(new Set());
                  setVerifyMember(memberId);
                }}
                style={({ pressed }) => [
                  styles.verifyRow,
                  pressed && styles.verifyRowPressed,
                ]}
              >
                <View style={styles.verifyAvatar}>
                  <Text style={styles.verifyAvatarText}>
                    {member.nama.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.verifyRowText}>
                  <Text style={styles.verifyRowName}>{member.nama}</Text>
                  <Text style={styles.verifyRowMeta}>
                    {items.length} kategori nunggu
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.inkSoft} strokeWidth={2.2} />
              </Pressable>
            );
          })}
        </View>
      )}

      {verifyMember != null && (
        <IuranVerifySheet
          items={verifyItems}
          checked={checked}
          busy={busy}
          onToggle={toggleChecked}
          onVerify={() => void onVerify()}
          onClose={() => setVerifyMember(null)}
        />
      )}
    </View>
  );
}

/** Box rekening kos (mustard — pola Serumah.html): tap → copy nomor rekening. */
function RekeningCard({
  reken,
}: {
  reken: { bank: string | null; nomor: string | null; nama: string | null };
}) {
  const copy = () => {
    if (reken.nomor) void Clipboard.setStringAsync(reken.nomor);
    toast.success('Nomor rekening disalin.');
  };
  const hasReken = reken.bank != null || reken.nomor != null;

  return (
    <Pressable
      onPress={copy}
      style={({ pressed }) => [
        styles.rekeningCard,
        pressed && styles.rekeningCardPressed,
      ]}
    >
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3.5 9.5L12 4.5l8.5 5M5 9.5V19h14V9.5M9 13h6"
          stroke={colors.mustardInk}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={styles.rekeningCardText} numberOfLines={2}>
        {hasReken
          ? `Bayar ke: ${[reken.bank, reken.nomor].filter(Boolean).join(' ')}${reken.nama ? ` a.n. ${reken.nama}` : ''}`
          : 'Rekening kos belum diatur.'}
      </Text>
    </Pressable>
  );
}

/** Sheet checklist verifikasi iuran untuk PJ — centang item valid + lihat bukti. */
function IuranVerifySheet({
  items,
  checked,
  busy,
  onToggle,
  onVerify,
  onClose,
}: {
  items: IuranItem[];
  checked: Set<string>;
  busy: boolean;
  onToggle: (id: string) => void;
  onVerify: () => void;
  onClose: () => void;
}) {
const token = useAuthStore((s) => s.token);
    const nChecked = checked.size;
    const insets = useSafeAreaInsets();

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.verifBackdrop} onPress={onClose}>
        <View
          style={[styles.verifSheet, { paddingBottom: insets.bottom + 16 }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.verifHandle} />
          <View style={styles.verifHead}>
            <View style={styles.verifHeadText}>
              <Text style={styles.verifTitle}>
                Verifikasi {items[0]?.anggota.nama ?? 'iuran'}
              </Text>
              <Text style={styles.verifMeta}>
                Centang yang sudah bayar sesuai bukti transfer
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.verifClose}>
              <X color={colors.inkSoft} size={18} strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.verifScroll}
            contentContainerStyle={styles.verifList}
          >
            {items.map((item) => {
              const isChecked = checked.has(item.id);
              const hasProof = item.buktiBayar != null;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onToggle(item.id)}
                  style={({ pressed }) => [
                    styles.verifItem,
                    isChecked && styles.verifItemChecked,
                    pressed && styles.verifItemPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.verifCheck,
                      isChecked && styles.verifCheckActive,
                    ]}
                  >
                    {isChecked && (
                      <Check color={colors.paper} size={11} strokeWidth={3} />
                    )}
                  </View>
                  <View style={styles.verifItemBody}>
                    <Text style={styles.verifItemName}>{item.anggota.nama}</Text>
                    <Text style={styles.verifItemLabel}>
                      {item.label} · {formatMonthLabel(item.bulan)}
                    </Text>
                    <Text style={styles.verifItemAmount}>
                      {formatCurrency(item.nominal)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      if (hasProof) previewImage(item.buktiBayar!);
                    }}
                    hitSlop={6}
                    style={[
                      styles.verifProof,
                      !hasProof && styles.verifProofEmpty,
                    ]}
                  >
                    {hasProof ? (
                      <ExpoImage
                        source={mediaSource(item.buktiBayar!, token)}
                        style={styles.verifProofImg}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={styles.verifProofText}>no bukti</Text>
                    )}
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.verifFooter}>
            <Pressable
              onPress={onVerify}
              disabled={busy || nChecked === 0}
              style={[
                styles.verifBtn,
                (busy || nChecked === 0) && styles.verifBtnDisabled,
              ]}
            >
              <Text style={styles.verifBtnText}>
                {busy
                  ? 'Memverifikasi…'
                  : `Verifikasi ${nChecked > 0 ? `(${nChecked})` : ''}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

/** Sheet "Upload Bukti Transfer" iuran — pola Serumah.html (upStep1 → upStep2). */
function IuranUploadSheet({
  bulan,
  amount,
  items,
  anggotaAktif,
  bank,
  nomor,
  rekeningName,
  uri,
  busy,
  onPick,
  onSubmit,
  onClose,
}: {
  bulan: string;
  amount: number;
  items: IuranItem[];
  anggotaAktif: number;
  bank: string | null;
  nomor: string | null;
  rekeningName: string | null;
  uri: string | null;
  busy: boolean;
  onPick: () => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bankLine = [bank, nomor].filter(Boolean).join(' ');

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.uploadBackdrop} onPress={onClose}>
        <View
          style={[styles.uploadSheet, { paddingBottom: insets.bottom + 26 }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.uploadHandle} />
          <View style={styles.uploadHead}>
            <View style={styles.uploadHeadText}>
              <Text style={styles.uploadTitle}>
                Iuran Bulanan · {formatMonthLabel(bulan)}
              </Text>
              <Text style={styles.uploadAmount}>{formatCurrency(amount)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.uploadClose}>
              <Text style={styles.uploadCloseText}>×</Text>
            </Pressable>
          </View>

          {items.length > 0 && (
            <View style={styles.uploadItems}>
              <Text style={styles.uploadItemsKicker}>
                Item yang harus dibayar
              </Text>
              {items.map((i) => (
                <View key={i.id} style={styles.uploadItemRow}>
                  <Text style={styles.uploadItemLabel}>{i.label}</Text>
                  <Text style={styles.uploadItemAmount}>
                    {formatCurrency(i.nominal)}
                  </Text>
                </View>
              ))}
              <Text style={styles.uploadShare}>
                {formatCurrency(amount)} ÷ {anggotaAktif} anggota aktif
              </Text>
            </View>
          )}

          {bankLine || rekeningName ? (
            <View style={styles.transferTo}>
              <Text style={styles.transferToKicker}>Transfer ke</Text>
              <Text style={styles.transferToBank}>{bankLine || '—'}</Text>
              {rekeningName && (
                <Text style={styles.transferToName}>a.n. {rekeningName}</Text>
              )}
            </View>
          ) : null}

          {!uri ? (
            <Pressable
              onPress={onPick}
              disabled={busy}
              style={({ pressed }) => [
                styles.uploadDrop,
                pressed && styles.uploadDropPressed,
              ]}
            >
              <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 16V5M8 8.5L12 4.5l4 4M5 18.5h14"
                  stroke={colors.inkSoft}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.uploadDropText}>Upload Bukti Transfer</Text>
              <Text style={styles.uploadDropSub}>pilih dari galeri</Text>
            </Pressable>
          ) : (
            <View style={styles.uploadPreviewWrap}>
              <Pressable
                onPress={() => uri && previewImage(uri)}
                hitSlop={6}
              >
                <ExpoImage
                  source={{ uri }}
                  style={styles.uploadPreview}
                  contentFit="cover"
                />
              </Pressable>
              <Text style={styles.uploadPreviewHint}>ketuk untuk perbesar</Text>
              <View style={styles.uploadActions}>
                <Pressable
                  onPress={onSubmit}
                  disabled={busy}
                  style={[styles.uploadSend, busy && styles.uploadSendDisabled]}
                >
                  <Text style={styles.uploadSendText}>
                    {busy ? 'Mengirim…' : 'Kirim ke PJ'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onPick}
                  disabled={busy}
                  style={styles.uploadSwap}
                >
                  <Text style={styles.uploadSwapText}>Ganti</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
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
    void queryClient.invalidateQueries({
      queryKey: tagihanKeys.listrik(bulan),
    });
  };

  const createEnabled =
    nominal.replace(/\D/g, '').length > 0 && bukti != null && !busy;

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
      dialog.alert('Gagal', errMsg(e));
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
                width: `${data.total > 0
                  ? Math.round((data.myBought / data.total) * 100)
                  : 0
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
            Listrik tambahan {formatCurrency(data.total)} dibagi rata: tagihan
            lo {data.myCredit >= 0 ? '+' : ''}
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
          <Pressable
            onPress={() => void pickListrikProof(setBukti)}
            style={styles.buktiBtn}
          >
            {bukti ? (
              <Text style={styles.buktiReady}>✓</Text>
            ) : (
              <Camera color={colors.ink} size={16} strokeWidth={2} />
            )}
            <Text style={styles.buktiText}>
              {bukti ? 'Foto siap' : 'Foto bukti (wajib)'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void onCreate()}
            disabled={!createEnabled}
            style={[
              styles.submitBtn,
              !createEnabled && styles.submitBtnDisabled,
            ]}
          >
            <Text style={styles.submitText}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Text>
          </Pressable>
        </View>
      )}

      {data.records.map((r) => (
        <ListrikRecordCard key={r.id} record={r} />
      ))}
      {data.records.length === 0 && !showForm && (
        <EmptyState
          icon={<Plus color={colors.inkSoft} size={22} strokeWidth={2} />}
          title="Belum ada beli listrik bulan ini"
          sub="Catat pembelian token listrik tambahan biar tagihannya keitung rata."
          action={{
            label: 'Tambah Record',
            onPress: () => setShowForm(true),
          }}
        />
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
          <Text style={styles.recordDate}>
            {formatShortDate(record.createdAt)}
          </Text>
        </View>
        <Text style={styles.recordAmount}>
          {formatCurrency(record.nominal)}
        </Text>
      </View>
      <Pressable
        onPress={() => record.buktiBayar && previewImage(record.buktiBayar!)}
      >
        <Text style={styles.recordProof}>Lihat bukti</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------ Shared ------------------------------ */

/** "Rab, 22 Agu · asal denda" — the meta line below the bill reason. */
function dendaNote(d: Denda): string {
  const date = formatWeekdayDate(d.createdAt);
  if (d.origin === 'partial') {
    return `${date} · direview ${d.reviewerNama ?? 'PJ'}`;
  }
  if (d.origin === 'rejected') return `${date} · direject ${d.reviewerNama ?? 'PJ'}`;
  return `${date} · auto-denda deadline 20:00`;
}

async function capturePhoto(): Promise<string | null> {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    dialog.alert(
      'Izin galeri',
      'Izinkan akses galeri untuk memilih bukti pembayaran.',
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

async function pickListrikProof(setBukti: (uri: string | null) => void) {
  const uri = await capturePhoto();
  setBukti(uri);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Terjadi kesalahan.';
}

function formatInt(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
    value,
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Memuat…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  segments: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: colors.paperDeep,
    borderRadius: 13,
    padding: 3,
    gap: 4,
  },
  seg: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  segActive: { backgroundColor: colors.ink },
  segText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12,
    color: colors.inkSoft,
  },
  segTextActive: { color: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 13, paddingBottom: 108, gap: 12 },
  section: { gap: 12 },
  loading: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  summaryLeft: { gap: 2, flex: 1 },
  summaryKicker: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10.5,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  summarySub: { ...type.body, fontSize: 11, color: colors.inkSoft },
  summaryAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.brick,
  },
  amountPaid: { color: colors.pineDeep },

  billCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 11,
  },
  billTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  billTexts: { gap: 3, flex: 1 },
  billReason: {
    fontFamily: fontFamilies.body[600],
    fontSize: 14,
    color: colors.ink,
  },
  billDate: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    color: colors.inkSoft,
  },
  billAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.brick,
  },
  billHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  billHintText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 11,
    color: colors.inkSoft,
    flex: 1,
  },
  waitNote: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    color: colors.mustardInk,
  },

  /* Bottom sheet: denda detail */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 42, 36, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    maxHeight: '85%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.paperDeep,
    marginBottom: 14,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetHeadText: { gap: 3, flex: 1 },
  sheetTitle: {
    fontFamily: fontFamilies.body[600],
    fontSize: 14,
    color: colors.ink,
  },
  sheetMeta: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    color: colors.inkSoft,
  },
  sheetClose: {
    padding: 4,
  },
  sheetAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 28,
    letterSpacing: -0.5,
    color: colors.brick,
    marginTop: 8,
    marginBottom: 12,
  },
  sheetScroll: { flexGrow: 0 },
  sheetScrollContent: { gap: 10, paddingBottom: 8 },

  causeCard: {
    backgroundColor: colors.paperDeep,
    borderRadius: radius.lg,
    padding: 13,
    gap: 3,
  },
  causeTitle: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },
  causeSub: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    lineHeight: 16,
    color: colors.inkSoft,
  },

  roomCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 13,
    gap: 9,
  },
  roomHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roomName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
    flex: 1,
  },
  roomCount: {
    fontFamily: fontFamilies.mono[600],
    fontSize: 11,
    color: colors.inkSoft,
  },
  jenisChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  jenisChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.pineSoft,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  jenisChipMissed: { backgroundColor: colors.brickSoft },
  jenisChipText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 10.5,
    color: colors.pineDeep,
  },
  jenisChipTextMissed: { color: colors.brick },

  sheetQrisBlock: { gap: 7, marginTop: 2 },
  sheetSectionLabel: { ...type.kicker, fontSize: 9.5, color: colors.inkSoft },
  sheetQris: {
    width: '100%',
    height: 170,
    borderRadius: radius.lg,
    backgroundColor: colors.paperDeep,
  },
  sheetQrisHint: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    lineHeight: 16,
    color: colors.inkSoft,
  },

  sheetFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 4,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    paddingVertical: 14,
  },
  uploadBtnDisabled: { backgroundColor: colors.disabledBg },
  uploadBtnText: {
    fontFamily: fontFamilies.body[700],
    fontSize: 13,
    color: colors.paper,
  },

  claimSection: { gap: 10 },
  claimHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 2,
  },
  claimTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 13,
    color: colors.ink,
  },
  claimCount: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10,
    color: colors.inkSoft,
  },
  claimCard: {
    backgroundColor: colors.mustardSoft,
    borderWidth: 1,
    borderColor: colors.mustardBorder,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 11,
  },
  claimCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  claimTexts: { flex: 1, flexDirection: 'column', gap: 3 },
  claimName: {
    fontFamily: fontFamilies.display[600],
    fontSize: 13.5,
    color: colors.ink,
  },
  claimNote: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    lineHeight: 16,
    color: colors.mustardText,
  },
  claimAmount: {
    flexShrink: 0,
    fontFamily: fontFamilies.mono[700],
    fontSize: 15,
    color: colors.ink,
  },
  claimActions: { flexDirection: 'row', gap: 8 },
  claimApproveBtn: {
    flex: 1,
    backgroundColor: colors.pine,
    borderRadius: 12,
    padding: 11,
    alignItems: 'center',
  },
  claimApproveText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  claimRejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.brick,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 11,
    alignItems: 'center',
  },
  claimRejectText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.brick,
  },
  badge: {
    backgroundColor: colors.mustard,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontFamily: fontFamilies.body[700],
    fontSize: 10,
    color: colors.mustardInkStrong,
  },

  verifySection: {
    backgroundColor: colors.mustardSoft,
    borderWidth: 1,
    borderColor: colors.mustardBorder,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 8,
  },
  verifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifyTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 13.5,
    color: colors.mustardInk,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  verifyRowPressed: { opacity: 0.7 },
  verifyAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyAvatarText: {
    fontFamily: fontFamilies.display[700],
    fontSize: 12,
    color: colors.paper,
  },
  verifyRowText: { flex: 1, gap: 1 },
  verifyRowName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },
  verifyRowMeta: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    color: colors.inkSoft,
  },

  verifBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 26, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  verifSheet: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  verifHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 2,
  },
  verifHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 4,
  },
  verifHeadText: { flex: 1, gap: 3 },
  verifTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14.5,
    letterSpacing: -0.14,
    color: colors.ink,
  },
  verifMeta: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    lineHeight: 16,
    color: colors.inkSoft,
  },
  verifClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifScroll: { flexGrow: 0, flexShrink: 1 },
  verifList: { gap: 8, paddingBottom: 4 },
  verifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    padding: 12,
  },
  verifItemChecked: {
    borderColor: colors.pine,
    backgroundColor: colors.pineSoft,
  },
  verifItemPressed: { opacity: 0.75 },
  verifCheck: {
    flex: 0,
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.inkSoft,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifCheckActive: { backgroundColor: colors.pine, borderColor: colors.pine },
  verifItemBody: { flex: 1, minWidth: 0, gap: 2 },
  verifItemName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },
  verifItemLabel: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  verifItemAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 12,
    color: colors.ink,
    marginTop: 1,
  },
  verifProof: {
    flex: 0,
    width: 40,
    height: 40,
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperDeep,
  },
  verifProofEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifProofImg: { width: '100%', height: '100%' },
  verifProofText: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 7.5,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  verifFooter: { paddingTop: 4 },
  verifBtn: {
    backgroundColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  verifBtnDisabled: { opacity: 0.5 },
  verifBtnText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },

  uploadBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 26, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  uploadSheet: {
    width: '100%',
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: 20,
    gap: 13,
  },
  uploadHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 4,
  },
  uploadHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  uploadHeadText: { flex: 1, flexDirection: 'column', gap: 3 },
  uploadTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 15,
    letterSpacing: -0.15,
    color: colors.ink,
  },
  uploadAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 21,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  uploadClose: {
    flex: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCloseText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 15,
    lineHeight: 15,
    color: colors.inkSoft,
  },
  uploadItems: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 13,
    gap: 9,
  },
  uploadItemsKicker: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  uploadItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  uploadItemLabel: {
    flex: 1,
    fontFamily: fontFamilies.body[500],
    fontSize: 12.5,
    color: colors.ink,
  },
  uploadItemAmount: {
    fontFamily: fontFamilies.mono[600],
    fontSize: 13,
    color: colors.ink,
  },
  uploadShare: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 9,
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  transferTo: {
    backgroundColor: colors.mustardSoft,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 2,
  },
  transferToKicker: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  transferToBank: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 14,
    letterSpacing: 0.3,
    color: colors.ink,
  },
  transferToName: {
    fontFamily: fontFamilies.body[500],
    fontSize: 11,
    color: colors.mustardText,
  },
  uploadDrop: {
    height: 120,
    borderRadius: 11,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineDash,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadDropPressed: { opacity: 0.75 },
  uploadDropText: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  uploadDropSub: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10,
    color: colors.inkMuted,
  },
  uploadPreviewWrap: { gap: 10 },
  uploadPreview: {
    width: '100%',
    height: 150,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
  },
  uploadPreviewHint: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: colors.inkMuted,
  },
  uploadActions: { flexDirection: 'row', gap: 8 },
  uploadSend: {
    flex: 1,
    backgroundColor: colors.pine,
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
  },
  uploadSendDisabled: { backgroundColor: colors.disabledBg },
  uploadSendText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  uploadSwap: {
    flex: 0,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'transparent',
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadSwapText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },

  iuranCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 14,
    gap: 11,
  },
  iuranCardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  iuranCardTile: {
    flex: 0,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iuranCardInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    gap: 3,
  },
  iuranCardLabel: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13.5,
    letterSpacing: -0.15,
    color: colors.ink,
  },
  iuranCardAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  iuranCardAmountPaid: { color: colors.inkSoft },
  iuranCardSub: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10,
    color: colors.inkMuted,
  },
  iuranCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.pine,
    borderRadius: 11,
    paddingVertical: 12,
  },
  iuranCardBtnPressed: { backgroundColor: colors.pineDeep },
  iuranCardBtnText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  rekeningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.mustardSoft,
    borderWidth: 1,
    borderColor: colors.mustardBorder,
    borderRadius: radius.md,
    padding: 13,
  },
  rekeningCardPressed: { opacity: 0.7 },
  rekeningCardText: {
    flex: 1,
    fontFamily: fontFamilies.body[500],
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.mustardText,
  },

  listrikSummary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 8,
  },
  listrikKicker: { ...type.kicker, fontSize: 9, color: colors.inkSoft },
  listrikTotal: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: colors.mustard },
  listrikSub: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    color: colors.inkSoft,
  },
  listrikNote: {
    backgroundColor: colors.pineSoft,
    borderRadius: radius.md,
    padding: 12,
  },
  listrikNoteText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 11.5,
    color: colors.pineDeep,
  },
  addBtn: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: {
    fontFamily: fontFamilies.body[700],
    fontSize: 13,
    color: colors.paper,
  },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 12,
  },
  inputRow: { gap: 6 },
  inputLabel: {
    fontFamily: fontFamilies.body[600],
    fontSize: 11.5,
    color: colors.inkSoft,
  },
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
  buktiReady: {
    fontFamily: fontFamilies.body[700],
    fontSize: 15,
    color: colors.pine,
  },
  buktiText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },
  submitBtn: {
    backgroundColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.disabledBg },
  submitText: {
    fontFamily: fontFamilies.body[700],
    fontSize: 13,
    color: colors.paper,
  },
  listrikRecord: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
    gap: 8,
  },
  recordTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordLeft: { gap: 2 },
  recordName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },
  recordDate: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  recordAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 15,
    color: colors.ink,
  },
  recordProof: {
    fontFamily: fontFamilies.body[600],
    fontSize: 11,
    color: colors.pine,
  },
});
