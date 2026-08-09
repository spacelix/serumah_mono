import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { ArrowUp, Camera, ChevronRight, QrCode, ReceiptText, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import {
  formatCurrency,
  formatLongDate,
  formatWeekdayDate,
} from '@/lib/format';
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
  const myDenda = data.denda.filter((d) => d.anggota.id === myId);
  const pending = data.denda.filter(
    (d) =>
      d.status === 'menunggu_konfirmasi' &&
      d.reviewerId != null &&
      d.reviewerId === myId,
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
          {pending.length > 0 && (
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
        isPj={my.data?.anggota?.role === 'admin'}
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
        <Text style={styles.waitNote}>
          {denda.paymentReviewerNama
            ? `nunggu konfirmasi ${denda.paymentReviewerNama}`
            : 'nunggu konfirmasi reviewer'}
        </Text>
      )}
      {onPress != null && denda.status === 'belum_bayar' && (
        <View style={styles.billHintRow}>
          <QrCode color={colors.inkSoft} size={13} strokeWidth={2.2} />
          <Text style={styles.billHintText}>
            Ketuk buat lihat penyebab & bayar QRIS
          </Text>
        </View>
      )}
      {onPress != null &&
        (denda.status === 'menunggu_konfirmasi' || denda.status === 'lunas') && (
          <Pressable
            onPress={onPress}
            style={styles.billDetailBtn}
          >
            <Text style={styles.billDetailText}>Lihat Detail</Text>
          </Pressable>
        )}
    </Pressable>
  );
}

/** Bottom sheet: penyebab denda per ruangan + QRIS di atas + tombol upload bukti. */
function DendaDetailSheet({
  denda,
  qrisUrl,
  busy,
  isPj,
  onClose,
  onUpload,
}: {
  denda: Denda | null;
  qrisUrl: string | null;
  busy: boolean;
  isPj: boolean;
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
                      {isPj
                        ? ' untuk diverifikasi anggota lain.'
                        : ' untuk diverifikasi PJ.'}
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upUri, setUpUri] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  if (queries.iuran.isLoading) return <Loading />;
  const data = queries.iuran.data;
  if (!data) return <Loading />;

  const myId = my.data?.user?.id ?? null;
  const myIuran = data.iuranList.filter((i) => i.anggota.id === myId);
  const unpaid = myIuran.filter((i) => i.status === 'belum_bayar');
  const total = myIuran.reduce((s, i) => s + i.nominal, 0);
  const nAnggota = new Set(data.iuranList.map((i) => i.anggota.id)).size;
  const pending = data.iuranList.filter(
    (i) =>
      i.status === 'menunggu_konfirmasi' &&
      i.reviewerId != null &&
      i.reviewerId === myId,
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

  const onVerify = async () => {
    const ids = verifyItems.map((i) => i.id);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      for (const id of ids) {
        await apiConfirmIuranLunas(id);
      }
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
        {unpaid.length === 0 && (
          <Pressable
            onPress={() => setDetailOpen(true)}
            style={styles.billDetailBtn}
          >
            <Text style={styles.billDetailText}>Lihat Detail</Text>
          </Pressable>
        )}
      </View>

      <IuranDetailSheet
        visible={detailOpen}
        bulan={bulan}
        items={myIuran}
        status={iuranStatus}
        anggotaAktif={Math.max(nAnggota, 1)}
        onClose={() => setDetailOpen(false)}
      />

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
          isPj={my.data?.anggota?.role === 'admin'}
          onPick={() => void onPickUpload()}
          onSubmit={() => void onSubmitUpload()}
          onClose={() => {
            setUpUri(null);
            setUploadOpen(false);
          }}
        />
      )}

      {pending.length > 0 && (
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
                onPress={() => setVerifyMember(memberId)}
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
          busy={busy}
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

/** Sheet checklist verifikasi iuran — desain selaras dengan detail Iuran Bulanan. */
function IuranVerifySheet({
  items,
  busy,
  onVerify,
  onClose,
}: {
  items: IuranItem[];
  busy: boolean;
  onVerify: () => void;
  onClose: () => void;
}) {
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const total = items.reduce((s, i) => s + i.nominal, 0);
  const paid = items.filter((i) => i.status !== 'belum_bayar');
  const bukti = paid[0]?.buktiBayar ?? null;
  const buktiSource = mediaSource(bukti, token);

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
          <View style={styles.detailHead}>
            <View style={styles.detailHeadText}>
              <Text style={styles.detailTitle}>
                Verifikasi {items[0]?.anggota.nama ?? 'iuran'}
              </Text>
              <Text style={styles.detailAmount}>{formatCurrency(total)}</Text>
            </View>
            <View style={styles.detailHeadRight}>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={styles.uploadClose}
              >
                <Text style={styles.uploadCloseText}>×</Text>
              </Pressable>
              <Stamp status="menunggu_konfirmasi" />
            </View>
          </View>

          <View style={styles.uploadItems}>
            <Text style={styles.uploadItemsKicker}>Item iuran</Text>
            {items.map((item) => (
              <View key={item.id} style={styles.uploadItemRow}>
                <Text style={styles.uploadItemLabel}>{item.label}</Text>
                <Text style={styles.uploadItemAmount}>
                  {formatCurrency(item.nominal)}
                </Text>
              </View>
            ))}
            <Text style={styles.uploadShare}>
              {formatCurrency(total)} ÷ {Math.max(new Set(items.map((i) => i.anggota.id)).size, 1)} anggota aktif
            </Text>
          </View>

          {buktiSource ? (
            <Pressable
              onPress={() => bukti && previewImage(bukti)}
              style={styles.uploadPreviewWrap}
            >
              <ExpoImage
                source={buktiSource}
                style={styles.uploadPreview}
                contentFit="cover"
              />
              <Text style={styles.uploadPreviewHint}>ketuk untuk perbesar</Text>
            </Pressable>
          ) : (
            <View style={styles.detailNoBukti}>
              <Text style={styles.detailNoBuktiText}>
                Bukti transfer belum diunggah.
              </Text>
            </View>
          )}

          <Pressable
            onPress={onVerify}
            disabled={busy}
            style={[
              styles.verifConfirmBtn,
              busy && styles.verifConfirmBtnDisabled,
            ]}
          >
            <Text style={styles.verifConfirmText}>
              {busy ? 'Memverifikasi…' : 'Lunas'}
            </Text>
          </Pressable>
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
  isPj,
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
  isPj: boolean;
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
                    {busy
                      ? 'Mengirim…'
                      : isPj
                        ? 'Kirim ke reviewer'
                        : 'Kirim ke PJ'}
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

/** Bottom sheet: detail iuran bulanan — read-only, desain sama dengan sheet upload bayar. */
function IuranDetailSheet({
  visible,
  bulan,
  items,
  status,
  anggotaAktif,
  onClose,
}: {
  visible: boolean;
  bulan: string;
  items: IuranItem[];
  status: 'belum_bayar' | 'menunggu_konfirmasi' | 'lunas';
  anggotaAktif: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const total = items.reduce((s, i) => s + i.nominal, 0);
  const paid = items.filter((i) => i.status !== 'belum_bayar');
  const bukti = paid[0]?.buktiBayar ?? null;
  const buktiSource = mediaSource(bukti, token);

  return (
    <Modal
      visible={visible}
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
          <View style={styles.detailHead}>
            <View style={styles.detailHeadText}>
              <Text style={styles.detailTitle}>
                Iuran Bulanan · {formatMonthLabel(bulan)}
              </Text>
              <Text style={styles.detailAmount}>{formatCurrency(total)}</Text>
            </View>
            <View style={styles.detailHeadRight}>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={styles.uploadClose}
              >
                <Text style={styles.uploadCloseText}>×</Text>
              </Pressable>
              <Stamp status={status} />
            </View>
          </View>

          <View style={styles.uploadItems}>
            <Text style={styles.uploadItemsKicker}>Item iuran</Text>
            {items.map((i) => (
              <View key={i.id} style={styles.uploadItemRow}>
                <Text style={styles.uploadItemLabel}>{i.label}</Text>
                <Text style={styles.uploadItemAmount}>
                  {formatCurrency(i.nominal)}
                </Text>
              </View>
            ))}
            <Text style={styles.uploadShare}>
              {formatCurrency(total)} ÷ {Math.max(anggotaAktif, 1)} anggota
              aktif
            </Text>
          </View>

          {buktiSource ? (
            <Pressable
              onPress={() => bukti && previewImage(bukti)}
              style={styles.uploadPreviewWrap}
            >
              <ExpoImage
                source={buktiSource}
                style={styles.uploadPreview}
                contentFit="cover"
              />
              <Text style={styles.uploadPreviewHint}>ketuk untuk perbesar</Text>
            </Pressable>
          ) : (
            <View style={styles.detailNoBukti}>
              <Text style={styles.detailNoBuktiText}>
                Bukti transfer belum diunggah.
              </Text>
            </View>
          )}

          <View style={styles.timeline}>
            <Text style={styles.timelineKicker}>Timeline</Text>
            <TimelineRow
              label="Diterbitkan"
              meta={`1 ${formatMonthLabel(bulan)}`}
              done
            />
            <TimelineRow
              label="Dibayar & bukti diupload"
              meta={
                paid.length > 0 && paid[0]?.createdAt
                  ? formatLongDate(paid[0].createdAt)
                  : 'belum'
              }
              done={paid.length > 0}
            />
            <TimelineRow
              label={`Dikonfirmasi ${status === 'menunggu_konfirmasi' ? 'reviewer' : 'PJ'}`}
              meta={status === 'lunas' ? 'selesai' : 'nunggu'}
              done={status === 'lunas'}
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function TimelineRow({
  label,
  meta,
  done,
}: {
  label: string;
  meta: string;
  done: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View
        style={[styles.timelineDot, done && styles.timelineDotDone]}
      />
      <Text style={[styles.timelineLabel, !done && styles.timelineMuted]}>
        {label}
      </Text>
      <Text style={styles.timelineMeta}>{meta}</Text>
    </View>
  );
}

/* ------------------------------ Listrik ------------------------------ */

function ListrikView({ bulan }: { bulan: string }) {
  const queries = useTagihanQueries(bulan);
  const queryClient = useQueryClient();
  const my = useCurrentMember();
  const [showForm, setShowForm] = useState(false);
  const [nominal, setNominal] = useState('');
  const [note, setNote] = useState('');
  const [bukti, setBukti] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detail, setDetail] = useState<ListrikRecord | null>(null);
  const [busy, setBusy] = useState(false);

  if (queries.listrik.isLoading) return <Loading />;
  const data = queries.listrik.data;
  if (!data) return <Loading />;

  const myId = my.data?.user?.id ?? null;

  const revalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: tagihanKeys.listrik(bulan),
    });
  };

  const createEnabled =
    nominal.replace(/\D/g, '').length > 0 && bukti != null && !busy;

  return (
    <View style={styles.section}>
      <View style={styles.listrikSummary}>
        <Text style={styles.listrikKicker}>TOTAL BELANJA LISTRIK TAMBAHAN</Text>
        <Text style={styles.listrikTotal}>{formatCurrency(data.total)}</Text>
        <Text style={styles.listrikSub}>
          {formatCurrency(data.myBought)} dibeli lo · sisanya anggota lain
        </Text>
        <View style={styles.listrikNote}>
          <Text style={styles.listrikNoteText}>
            Listrik tambahan dibagi rata ke semua. Pembeli dapet kredit,
            non-pembeli ditambah di tagihan bulan depan.
          </Text>
        </View>
      </View>

      {data.records.map((r) => (
        <ListrikRecordCard
          key={r.id}
          record={r}
          onPress={() => setDetail(r)}
        />
      ))}

      {showForm && (
        <ListrikFormCard
          nominal={nominal}
          setNominal={setNominal}
          note={note}
          setNote={setNote}
          bukti={bukti}
          setBukti={setBukti}
          busy={busy}
          createEnabled={createEnabled}
          onPreview={() => setPreviewOpen(true)}
          onSave={async () => {
            if (!createEnabled) return false;
            setBusy(true);
            try {
              const url = await uploadProof('listrik', bukti!, 'record');
              await apiCreateListrik({
                bulan,
                nominal: parseInt(nominal.replace(/\D/g, ''), 10) || 0,
                keterangan: note || undefined,
                buktiUrl: url,
              });
              revalidate();
              return true;
            } catch (e) {
              dialog.alert('Gagal', errMsg(e));
              return false;
            } finally {
              setBusy(false);
            }
          }}
          onCreated={() => closeForm()}
        />
      )}

      <Pressable
        onPress={() => setShowForm((v) => !v)}
        style={({ pressed }) => [
          styles.addBtn,
          pressed && styles.addBtnPressed,
        ]}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v14M5 12h14"
            stroke={colors.pine}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={styles.addBtnText}>
          {showForm ? 'Tutup' : 'Tambah Record Beli Listrik'}
        </Text>
      </Pressable>

      <ListrikProofPreview
        visible={previewOpen && bukti != null}
        uri={bukti}
        onClose={() => setPreviewOpen(false)}
        onReplace={() => {
          setPreviewOpen(false);
          void pickListrikProof(setBukti);
        }}
      />

      <ListrikDetailSheet
        record={detail}
        nAnggota={data.nAnggota}
        isMine={detail != null && detail.anggota.id === myId}
        onClose={() => setDetail(null)}
      />
    </View>
  );

  function closeForm() {
    setShowForm(false);
    setNominal('');
    setNote('');
    setBukti(null);
  }
}

/** Card "Record beli listrik" — rise-in/rise-out, muncul di atas tombol. */
function ListrikFormCard({
  nominal,
  setNominal,
  note,
  setNote,
  bukti,
  setBukti,
  busy,
  createEnabled,
  onPreview,
  onSave,
  onCreated,
}: {
  nominal: string;
  setNominal: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  bukti: string | null;
  setBukti: (v: string | null) => void;
  busy: boolean;
  createEnabled: boolean;
  onPreview: () => void;
  onSave: () => Promise<boolean>;
  onCreated: () => void;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  const [closing, setClosing] = useState(false);
  const closedRef = useRef(false);

  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rise]);

  useEffect(() => {
    if (!closing || closedRef.current) return;
    closedRef.current = true;
    Animated.timing(rise, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(onCreated);
  }, [closing, rise, onCreated]);

  const close = () => setClosing(true);

  const save = async () => {
    if (!createEnabled || busy) return;
    const ok = await onSave();
    if (ok) setClosing(true);
  };

  return (
    <Animated.View
      style={[
        styles.formCard,
        {
          opacity: rise,
          transform: [
            {
              translateY: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [-16, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.formHead}>
        <Text style={styles.formTitle}>Record beli listrik</Text>
        <Pressable onPress={close} hitSlop={8} style={styles.formClose}>
          <Text style={styles.formCloseText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Nominal</Text>
        <View style={styles.moneyBox}>
          <Text style={styles.moneyRp}>Rp</Text>
          <TextInput
            style={styles.moneyInput}
            value={nominal}
            onChangeText={setNominal}
            placeholder="0"
            keyboardType="number-pad"
            placeholderTextColor={colors.inkMuted}
          />
        </View>
      </View>

      {bukti ? (
        <Pressable onPress={onPreview} style={styles.buktiFilled}>
          <ExpoImage
            source={{ uri: bukti }}
            style={styles.buktiFilledImg}
            contentFit="cover"
          />
          <View style={styles.buktiOverlay}>
            <Text style={styles.buktiOverlayText}>
              ketuk buat preview / ganti
            </Text>
          </View>
          <Pressable
            onPress={() => setBukti(null)}
            hitSlop={8}
            style={styles.buktiClear}
          >
            <X color={colors.paper} size={13} strokeWidth={2.4} />
          </Pressable>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => void pickListrikProof(setBukti)}
          style={styles.buktiBtn}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4v-10zM12 16a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"
              stroke={colors.inkSoft}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.buktiText}>+ foto bukti (wajib)</Text>
        </Pressable>
      )}

      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder="Keterangan (opsional)"
        placeholderTextColor={colors.inkMuted}
      />

      <Pressable
        onPress={() => void save()}
        disabled={!createEnabled || busy}
        style={[
          styles.submitBtn,
          (!createEnabled || busy) && styles.submitBtnDisabled,
        ]}
      >
        <Text style={styles.submitText}>
          {busy ? 'Menyimpan…' : 'Simpan · notif ke semua anggota'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Preview full-screen bukti beli listrik — pola PhotoPreviewModal piket. */
function ListrikProofPreview({
  visible,
  uri,
  onClose,
  onReplace,
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  onReplace: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewFull}>
        <View style={styles.previewTopBar}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.previewX}>
            <X color={colors.paper} size={22} strokeWidth={2.2} />
          </Pressable>
        </View>
        {uri ? (
          <ExpoImage
            source={{ uri }}
            style={styles.previewFullImage}
            contentFit="contain"
          />
        ) : (
          <View style={styles.previewFullEmpty}>
            <Text style={styles.previewEmptyText}>Foto belum diambil.</Text>
          </View>
        )}
        <View style={styles.previewBottomBar}>
          <Pressable onPress={onReplace} style={styles.previewReplace}>
            <Text style={styles.previewReplaceText}>Ganti foto</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ListrikRecordCard({
  record,
  onPress,
}: {
  record: ListrikRecord;
  onPress: () => void;
}) {
  const token = useAuthStore((s) => s.token);
  const proofSource = mediaSource(record.buktiBayar, token);
  const initial = record.anggota.nama.charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listrikRecord,
        pressed && styles.listrikRecordPressed,
      ]}
    >
      <View style={styles.recordAvatar}>
        <Text style={styles.recordAvatarText}>{initial}</Text>
      </View>
      <View style={styles.recordLeft}>
        <Text style={styles.recordName}>{record.anggota.nama}</Text>
        <Text style={styles.recordDate}>
          {formatLongDate(record.createdAt)}
        </Text>
      </View>
      <Text style={styles.recordAmount}>
        {formatCurrency(record.nominal)}
      </Text>
      <View style={[styles.recordThumb, !proofSource && styles.recordThumbStriped]}>
        {proofSource && (
          <ExpoImage
            source={proofSource}
            style={styles.recordThumbImg}
            contentFit="cover"
          />
        )}
      </View>
    </Pressable>
  );
}

/** Sheet "Detail beli listrik" — pola design Serumah.html. */
function ListrikDetailSheet({
  record,
  nAnggota,
  isMine,
  onClose,
}: {
  record: ListrikRecord | null;
  nAnggota: number;
  isMine: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const proofSource = record ? mediaSource(record.buktiBayar, token) : null;

  return (
    <Modal
      visible={record != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.uploadBackdrop} onPress={onClose}>
        <View
          style={[
            styles.detailSheet,
            { paddingBottom: insets.bottom + 26 },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.detailSheetHead}>
            <Text style={styles.detailSheetTitle}>Detail beli listrik</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.uploadClose}>
              <Text style={styles.uploadCloseText}>×</Text>
            </Pressable>
          </View>

          {record && (
            <>
              <Pressable
                onPress={() =>
                  record.buktiBayar && previewImage(record.buktiBayar!)
                }
                style={styles.detailSheetPhoto}
              >
                {proofSource ? (
                  <ExpoImage
                    source={proofSource}
                    style={styles.detailSheetPhotoImg}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.detailSheetPhotoStriped}>
                    <Svg
                      style={StyleSheet.absoluteFill}
                      width="100%"
                      height="100%"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <Defs>
                        <Pattern
                          id="serumahListrikStripe"
                          patternUnits="userSpaceOnUse"
                          width={20}
                          height={20}
                          patternTransform="rotate(45)"
                        >
                          <Rect width="10" height="20" fill={colors.textureA} />
                          <Rect x="10" width="10" height="20" fill={colors.textureB} />
                        </Pattern>
                      </Defs>
                      <Rect
                        width="100%"
                        height="100%"
                        fill="url(#serumahListrikStripe)"
                      />
                    </Svg>
                  </View>
                )}
                <View style={styles.detailSheetPhotoHint}>
                  <Text style={styles.detailSheetPhotoHintText}>
                    {proofSource ? 'pinch buat zoom' : 'belum ada bukti'}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.detailSheetInfo}>
                <View style={styles.detailSheetRow}>
                  <Text style={styles.detailSheetRowLabel}>Dibeli oleh</Text>
                  <Text style={styles.detailSheetRowValue}>
                    {record.anggota.nama}
                  </Text>
                </View>
                <View style={styles.detailSheetRow}>
                  <Text style={styles.detailSheetRowLabel}>Tanggal</Text>
                  <Text style={styles.detailSheetRowMono}>
                    {formatLongDate(record.createdAt)}
                  </Text>
                </View>
                <View style={styles.detailSheetRow}>
                  <Text style={styles.detailSheetRowLabel}>Nominal</Text>
                  <Text style={styles.detailSheetRowBrick}>
                    {formatCurrency(record.nominal)}
                  </Text>
                </View>
                <Text style={styles.detailSheetKeterangan}>
                  {record.keterangan?.trim() || 'Nggak ada keterangan.'}
                </Text>
              </View>

              <View style={styles.detailSheetShare}>
                <Text style={styles.detailSheetShareText}>
                  {formatCurrency(record.nominal)} dibagi {nAnggota} orang ={' '}
                  {formatCurrency(record.share)}/orang
                </Text>
              </View>

              <View style={styles.detailSheetCredit}>
                <Text style={styles.detailSheetCreditText}>
                  {isMine
                    ? `Kredit lo: ${formatCurrency(record.nominal - record.share)}`
                    : `Tagihan lo: +${formatCurrency(record.share)} bulan depan`}
                </Text>
              </View>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
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
  billDetailBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  billDetailText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
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

  detailHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailHeadText: { flexDirection: 'column', gap: 4 },
  detailTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 15,
    letterSpacing: -0.15,
    color: colors.ink,
  },
  detailAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 25,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  detailHeadRight: {
    flexShrink: 0,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  detailNoBukti: {
    borderRadius: 11,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineDash,
    backgroundColor: colors.paperDeep,
    paddingVertical: 22,
    alignItems: 'center',
  },
  detailNoBuktiText: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    color: colors.inkMuted,
  },

  timeline: {
    flexDirection: 'column',
    gap: 2,
  },
  timelineKicker: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 5,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  timelineDot: {
    flexShrink: 0,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.lineDash,
  },
  timelineDotDone: {
    backgroundColor: colors.pine,
    borderColor: colors.pine,
  },
  timelineLabel: {
    flex: 1,
    fontFamily: fontFamilies.body[500],
    fontSize: 12,
    color: colors.ink,
  },
  timelineMuted: {
    color: colors.inkMuted,
  },
  timelineMeta: {
    flexShrink: 0,
    fontFamily: fontFamilies.mono[400],
    fontSize: 10,
    color: colors.inkMuted,
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
  verifConfirmBtn: {
    backgroundColor: colors.pine,
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
  },
  verifConfirmBtnDisabled: { opacity: 0.5 },
  verifConfirmText: {
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
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    lineHeight: 16.5,
    color: colors.pineDeep,
  },
  addBtn: {
    backgroundColor: colors.paperDeep,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineDash,
    borderRadius: 11,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnPressed: { opacity: 0.75 },
  addBtnText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.pine,
  },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 14,
    gap: 11,
  },
  formHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  formTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 13.5,
    color: colors.ink,
  },
  formClose: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCloseText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 14,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  formField: { flexDirection: 'column', gap: 5 },
  formLabel: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  moneyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paperDeep,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  moneyRp: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 11,
    color: colors.inkSoft,
  },
  moneyInput: {
    flex: 1,
    fontFamily: fontFamilies.mono[700],
    fontSize: 13,
    color: colors.ink,
    padding: 0,
  },
  buktiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineDash,
    borderRadius: 11,
    height: 74,
    backgroundColor: colors.paperDeep,
  },
  buktiText: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 11,
    color: colors.inkSoft,
  },
  buktiFilled: {
    height: 110,
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperDeep,
  },
  buktiFilledImg: { width: '100%', height: '100%' },
  buktiOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 42, 36, 0.5)',
    paddingVertical: 5,
    alignItems: 'center',
  },
  buktiOverlayText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 9,
    color: colors.paper,
  },
  buktiClear: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 42, 36, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFull: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  previewTopBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  previewX: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251, 249, 244, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFullImage: {
    flex: 1,
    width: '100%',
  },
  previewFullEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyText: {
    fontFamily: fontFamilies.body[400],
    fontSize: 12,
    color: colors.paperFaint,
  },
  previewBottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  previewReplace: {
    borderWidth: 1,
    borderColor: colors.paperFaint,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  previewReplaceText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  noteInput: {
    fontFamily: fontFamilies.body[500],
    fontSize: 12.5,
    color: colors.ink,
    backgroundColor: colors.paperDeep,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  submitBtn: {
    backgroundColor: colors.pine,
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.disabledBg },
  submitText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  listrikRecord: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  listrikRecordPressed: { opacity: 0.75 },
  recordAvatar: {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordAvatarText: {
    fontFamily: fontFamilies.display[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  recordLeft: { flex: 1, minWidth: 0, gap: 2 },
  recordName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13,
    color: colors.ink,
  },
  recordDate: {
    fontFamily: fontFamilies.mono[400],
    fontSize: 10,
    color: colors.inkSoft,
  },
  recordAmount: {
    flexShrink: 0,
    fontFamily: fontFamilies.mono[700],
    fontSize: 14,
    color: colors.brick,
  },
  recordThumb: {
    flexShrink: 0,
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
  },
  recordThumbStriped: {
    backgroundColor: colors.paperDeep,
  },
  recordThumbImg: { width: '100%', height: '100%' },

  detailSheet: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 16,
    paddingHorizontal: 18,
    gap: 13,
  },
  detailSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailSheetTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14.5,
    letterSpacing: -0.15,
    color: colors.ink,
  },
  detailSheetPhoto: {
    width: '100%',
    height: 190,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  detailSheetPhotoStriped: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  detailSheetPhotoImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  detailSheetPhotoHint: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  detailSheetPhotoHintText: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10,
    color: colors.inkSoft,
  },
  detailSheetInfo: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 13,
    flexDirection: 'column',
    gap: 9,
  },
  detailSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailSheetRowLabel: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    color: colors.inkSoft,
  },
  detailSheetRowValue: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12,
    color: colors.ink,
  },
  detailSheetRowMono: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 11.5,
    color: colors.ink,
  },
  detailSheetRowBrick: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 15,
    color: colors.brick,
  },
  detailSheetKeterangan: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    lineHeight: 16.5,
    color: colors.inkSoft,
    borderTopWidth: 1,
    borderTopColor: colors.paper,
    paddingTop: 9,
  },
  detailSheetShare: {
    backgroundColor: colors.paperDeep,
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  detailSheetShareText: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 11.5,
    color: colors.ink,
  },
  detailSheetCredit: {
    backgroundColor: colors.pineSoft,
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  detailSheetCreditText: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 13,
    color: colors.pineDeep,
  },
});
