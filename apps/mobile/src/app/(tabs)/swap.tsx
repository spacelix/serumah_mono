import { CalendarDays, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { AnimatedSheet } from '@/components/ui/animated-sheet';
import { formatDateTimeShort, firstName, formatWeekdayDate } from '@/lib/format';
import {
  useSwapAvailableDays,
  useSwapMutations,
  useSwapTargets,
  useSwaps,
  type SwapRequest,
} from '@/features/swap/api/swap';
import {
  currentMonth,
  formatMonthLabel,
} from '@/features/tagihan/api/tagihan';
import { dialog } from '@/stores/dialog-store';
import { colors } from '@/theme/colors';
import { fontFamilies, type } from '@/theme/typography';

export default function SwapScreen() {
  const { data, isLoading, refetch, isFetching } = useSwaps();
  const [showForm, setShowForm] = useState(false);
  const [filterBulan, setFilterBulan] = useState<string | null>(null);

  const incoming = data?.incoming ?? [];
  const minePending = (data?.mine ?? []).filter(
    (s) => s.status === 'diajukan',
  );
  const history = (data?.mine ?? []).filter(
    (s) => s.status === 'diterima' || s.status === 'ditolak',
  );
  const months = useMemo(() => {
    const set = new Set<string>([currentMonth()]);
    for (const s of history) {
      const t = s.resolvedAt ?? s.createdAt;
      set.add(t.slice(0, 7));
    }
    return [...set].sort().reverse();
  }, [history]);
  const aktifBulan = filterBulan ?? months[0] ?? currentMonth();
  const filteredHistory = history.filter((s) => {
    const t = (s.resolvedAt ?? s.createdAt).slice(0, 7);
    return t === aktifBulan;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Swap"
        kicker="All-or-nothing · 1 hari penuh"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => void refetch()}
            colors={[colors.pine]}
            tintColor={colors.pine}
          />
        }
      >
        {isLoading || data == null ? (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Memuat…</Text>
          </View>
        ) : (
          <>
            {incoming.map((s) => (
              <IncomingCard key={s.id} swap={s} />
            ))}
            {minePending.map((s) => (
              <PendingCard key={s.id} swap={s} />
            ))}

            {incoming.length === 0 && minePending.length === 0 && (
              <EmptyState
                icon={
                  <CalendarDays
                    color={colors.inkSoft}
                    size={22}
                    strokeWidth={2}
                  />
                }
                title="Tidak ada permintaan swap"
                sub="Kalau ada yang mau tukar jadwal sama lo, bakal muncul di sini."
              />
            )}

            <Section title="Histori swap" sub="buat audit">
              <MonthFilter
                months={months}
                value={aktifBulan}
                onChange={setFilterBulan}
              />
              {filteredHistory.length === 0 ? (
                <EmptyState
                  icon={
                    <CalendarDays
                      color={colors.inkSoft}
                      size={22}
                      strokeWidth={2}
                    />
                  }
                  title="Belum ada histori di bulan ini"
                  sub="Ajukan swap buat nuker jadwal piket sama anggota lain."
                />
              ) : (
                filteredHistory.map((s) => (
                  <HistoryItem key={s.id} swap={s} />
                ))
              )}
            </Section>

            {!showForm && (
              <Pressable
                onPress={() => setShowForm(true)}
                style={({ pressed }) => [
                  styles.ctaCard,
                  pressed && styles.ctaPressed,
                ]}
              >
                <Plus color={colors.pine} size={16} strokeWidth={2.6} />
                <Text style={styles.ctaTitle}>Ajukan swap baru</Text>
                <Text style={styles.ctaSub}>
                  Satu hari penuh — nggak bisa pilih per jenis piket
                </Text>
              </Pressable>
            )}

            {showForm && <SwapForm onClose={() => setShowForm(false)} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sub != null && <Text style={styles.sectionSub}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
}

/** Filter bulan Histori swap — bar chevron + sheet pilih bulan (pola tagihan). */
function MonthFilter({
  months,
  value,
  onChange,
}: {
  months: string[];
  value: string;
  onChange: (bulan: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const onSelect = (bulan: string) => {
    onChange(bulan);
    setOpen(false);
  };

  return (
    <>
      <View style={styles.mfBar}>
        <Pressable
          onPress={() => {
            const i = months.indexOf(value);
            if (i < months.length - 1) onChange(months[i + 1] ?? null);
          }}
          hitSlop={6}
          disabled={months.indexOf(value) >= months.length - 1}
          style={styles.mfNav}
        >
          <Text
            style={[
              styles.mfNavText,
              months.indexOf(value) >= months.length - 1 &&
                styles.mfNavTextDisabled,
            ]}
          >
            ‹
          </Text>
        </Pressable>
        <Pressable onPress={() => setOpen(true)} style={styles.mfCenter}>
          <Text style={styles.mfLabel}>{formatMonthLabel(value)}</Text>
          <Text style={styles.mfDrop}>▼</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const i = months.indexOf(value);
            if (i > 0) onChange(months[i - 1] ?? null);
          }}
          hitSlop={6}
          disabled={months.indexOf(value) <= 0}
          style={styles.mfNav}
        >
          <Text
            style={[
              styles.mfNavText,
              months.indexOf(value) <= 0 && styles.mfNavTextDisabled,
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>

      {open && (
        <AnimatedSheet
          visible
          onClose={() => setOpen(false)}
          sheetStyle={[styles.mfSheet, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.mfSheetHead}>
            <Text style={styles.mfSheetTitle}>Pilih bulan</Text>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={6}
              style={styles.mfSheetClose}
            >
              <Text style={styles.mfSheetCloseText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.mfList}>
            {months.map((bulan) => {
              const active = bulan === value;
              return (
                <Pressable
                  key={bulan}
                  onPress={() => onSelect(bulan)}
                  style={[styles.mfRow, active && styles.mfRowActive]}
                >
                  <Text
                    style={[
                      styles.mfRowLabel,
                      active && styles.mfRowLabelActive,
                    ]}
                  >
                    {formatMonthLabel(bulan)}
                  </Text>
                  {bulan === currentMonth() && (
                    <Text
                      style={[
                        styles.mfRowStatus,
                        active && styles.mfRowStatusActive,
                      ]}
                    >
                      Bulan ini
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </AnimatedSheet>
      )}
    </>
  );
}

/** Kartu "Request masuk" — swap diajukan ke user, ada tombol Terima/Tolak. */
function IncomingCard({ swap }: { swap: SwapRequest }) {
  const { accept, reject } = useSwapMutations();
  const onAccept = () =>
    accept.mutate(swap.id, {
      onError: (e) =>
        dialog.alert(
          'Gagal',
          e instanceof Error ? e.message : 'Terjadi kesalahan.',
        ),
    });
  const onReject = () =>
    reject.mutate(swap.id, {
      onError: (e) =>
        dialog.alert(
          'Gagal',
          e instanceof Error ? e.message : 'Terjadi kesalahan.',
        ),
    });

  return (
    <View style={styles.swapCard}>
      <View style={styles.cardHead}>
        <Text style={styles.cardKind}>Request masuk</Text>
        <Text style={styles.cardTime}>{relativeTime(swap.createdAt)}</Text>
      </View>

      <View style={styles.swapPair}>
        <DayBox date={swap.tanggal} nama={swap.dari.nama} />
        <Text style={styles.swapArrow}>⇄</Text>
        <DayBox date={swap.tanggalKe} nama={swap.ke.nama} isLo />
      </View>

      <Text style={styles.swapNote}>
        {swap.dari.nama} mau tukar jadwal {formatWeekdayDate(swap.tanggal)} sama
        jadwal lo {formatWeekdayDate(swap.tanggalKe)}.
      </Text>

      <View style={styles.swapActions}>
        <Pressable
          onPress={onAccept}
          disabled={accept.isPending}
          style={styles.acceptBtn}
        >
          <Text style={styles.acceptText}>
            {accept.isPending ? '…' : 'Terima'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onReject}
          disabled={reject.isPending}
          style={styles.rejectBtn}
        >
          <Text style={styles.rejectText}>Tolak</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Kartu "Request lo" (masih diajukan) — tanpa tombol, menunggu penerima. */
function PendingCard({ swap }: { swap: SwapRequest }) {
  return (
    <View style={styles.swapCard}>
      <View style={styles.cardHead}>
        <Text style={styles.cardKind}>Request lo</Text>
        <Text style={styles.cardTime}>{relativeTime(swap.createdAt)}</Text>
      </View>

      <View style={styles.swapPair}>
        <DayBox date={swap.tanggal} nama={swap.dari.nama} isLo />
        <Text style={styles.swapArrow}>⇄</Text>
        <DayBox date={swap.tanggalKe} nama={swap.ke.nama} />
      </View>

      <Text style={styles.swapNote}>
        Nunggu {swap.ke.nama} nerima. Kalau ditolak, jadwal balik ke lo.
      </Text>
    </View>
  );
}

/** Item histori kompak — hanya swap yang sudah diproses (diterima/ditolak). */
function HistoryItem({ swap }: { swap: SwapRequest }) {
  const diterima = swap.status === 'diterima';
  const timestamp = swap.resolvedAt ?? swap.createdAt;
  const firstLine = useMemo(() => {
    if (diterima) {
      return `${formatWeekdayDate(swap.tanggal)} · piket asli ${swap.dari.nama} → dikerjain ${swap.ke.nama}`;
    }
    return `${formatWeekdayDate(swap.tanggal)} · piket asli ${swap.dari.nama} → batal`;
  }, [diterima, swap]);

  return (
    <View style={styles.historyItem}>
      <Text style={styles.historyText}>
        {firstLine}
        {'\n'}
        <Text style={styles.historyStamp}>
          {diterima ? 'Diterima' : 'Ditolak'} {swap.ke.nama} ·{' '}
          {formatDateTimeShort(timestamp)}
        </Text>
      </Text>
    </View>
  );
}

function DayBox({
  date,
  nama,
  isLo = false,
}: {
  date: string;
  nama: string;
  isLo?: boolean;
}) {
  return (
    <View style={styles.dayBox}>
      <Text style={styles.dayBoxDate}>{formatWeekdayDate(date)}</Text>
      <Text style={styles.dayBoxName}>
        {isLo ? `Lo (${firstName(nama)})` : firstName(nama)}
      </Text>
    </View>
  );
}

/** Form 3-langkah: pilih hari lo → pilih hari anggota lain → ringkasan (mutual). */
function SwapForm({ onClose }: { onClose: () => void }) {
  const { data: myDays, isLoading: daysLoading } = useSwapAvailableDays();
  const { data: targets, isLoading: targetsLoading } = useSwapTargets();
  const { create } = useSwapMutations();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [myDay, setMyDay] = useState<{
    tanggal: string;
    ruangan: string[];
  } | null>(null);
  const [target, setTarget] = useState<{
    memberId: string;
    nama: string;
    tanggal: string;
    ruangan: string[];
  } | null>(null);

  const canSubmit = myDay != null && target != null && !create.isPending;

  const onSubmit = () => {
    if (!myDay || !target) return;
    create.mutate(
      {
        tanggal: myDay.tanggal,
        tanggalKe: target.tanggal,
        keAnggotaId: target.memberId,
      },
      {
        onSuccess: () => {
          onClose();
          dialog.alert(
            'Terkirim',
            'Permintaan swap terkirim untuk dikonfirmasi.',
          );
        },
        onError: (e) =>
          dialog.alert(
            'Gagal',
            e instanceof Error ? e.message : 'Terjadi kesalahan.',
          ),
      },
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.formBackdrop} onPress={onClose}>
        <View
          style={[styles.formSheet, { paddingBottom: insets.bottom + 26 }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.formHead}>
            <View style={styles.formHeadText}>
              <Text style={styles.formKicker}>
                Langkah {step} dari 3
              </Text>
              <Text style={styles.formTitle}>
                {step === 1
                  ? 'Pilih hari piket lo'
                  : step === 2
                    ? 'Mau tukar sama hari siapa?'
                    : 'Cek sekali lagi'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.formClose}>
              <X color={colors.paper} size={15} strokeWidth={2.4} />
            </Pressable>
          </View>

          <Text style={styles.formHint}>
            {step === 1
              ? 'Satu hari penuh — semua jenis piket di hari itu ikut pindah.'
              : step === 2
                ? 'Cuma hari yang sudah ada penanggung jawabnya bisa ditukar.'
                : 'Request dikirim ke penerima. Kalau ditolak, jadwal balik ke lo.'}
          </Text>

          {step === 1 ? (
            <View style={styles.dayList}>
              {daysLoading ? (
                <Text style={styles.formHint}>Memuat hari…</Text>
              ) : (myDays ?? []).length === 0 ? (
                <Text style={styles.formHint}>
                  Tidak ada hari tersedia untuk swap
                </Text>
              ) : (
                (myDays ?? []).map((d) => (
                  <Pressable
                    key={d.tanggal}
                    onPress={() => {
                      setMyDay(d);
                      setStep(2);
                    }}
                    style={({ pressed }) => [
                      styles.formOption,
                      pressed && styles.formOptionPressed,
                    ]}
                  >
                    <Text style={styles.formOptionTitle}>
                      {formatWeekdayDate(d.tanggal)}
                    </Text>
                    <Text style={styles.formOptionSub}>
                      {d.ruangan.join(' · ')}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          ) : step === 2 ? (
            <>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.targetScroll}
                contentContainerStyle={styles.targetList}
              >
                {targetsLoading ? (
                  <Text style={styles.formHint}>Memuat anggota…</Text>
                ) : (targets ?? []).length === 0 ? (
                  <Text style={styles.formHint}>
                    Tidak ada anggota dengan hari tersedia
                  </Text>
                ) : (
                  (targets ?? []).flatMap((t) =>
                    t.days.map((d) => (
                      <Pressable
                        key={`${t.id}-${d.tanggal}`}
                        onPress={() => {
                          setTarget({
                            memberId: t.id,
                            nama: t.nama,
                            tanggal: d.tanggal,
                            ruangan: d.ruangan,
                          });
                          setStep(3);
                        }}
                        style={({ pressed }) => [
                          styles.formOption,
                          pressed && styles.formOptionPressed,
                        ]}
                      >
                        <Text style={styles.formOptionTitle}>
                          {formatWeekdayDate(d.tanggal)} · {t.nama}
                        </Text>
                        <Text style={styles.formOptionSub}>
                          {d.ruangan.join(' · ')}
                        </Text>
                      </Pressable>
                    )),
                  )
                )}
              </ScrollView>
              <Pressable onPress={() => setStep(1)} style={styles.backBtn}>
                <Text style={styles.backText}>← Ganti hari lo</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.summaryPair}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>LO KASIH</Text>
                  <Text style={styles.summaryDate}>
                    {myDay && formatWeekdayDate(myDay.tanggal)}
                  </Text>
                  <Text style={styles.summaryRooms}>
                    {myDay?.ruangan.join(' · ')}
                  </Text>
                </View>
                <Text style={styles.summaryArrow}>⇄</Text>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>LO AMBIL</Text>
                  <Text style={styles.summaryDate}>
                    {target && formatWeekdayDate(target.tanggal)}
                  </Text>
                  <Text style={styles.summaryRooms}>
                    {target?.ruangan.join(' · ')}
                  </Text>
                </View>
              </View>
              <View style={styles.formActions}>
                <Pressable
                  onPress={() => void onSubmit()}
                  disabled={!canSubmit}
                  style={[
                    styles.kirimBtn,
                    !canSubmit && styles.kirimBtnDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.kirimText,
                      !canSubmit && styles.kirimTextDisabled,
                    ]}
                  >
                    {create.isPending
                      ? 'Mengirim…'
                      : `Kirim ke ${target?.nama ?? ''}`}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setStep(2)} style={styles.ubahBtn}>
                  <Text style={styles.ubahText}>Ubah</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'kemarin';
  return `${days} hari lalu`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 108,
    gap: 13,
  },
  loading: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },
  section: { gap: 8 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 6,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 13,
    color: colors.ink,
  },
  sectionSub: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10,
    color: colors.inkSoft,
  },

  ctaCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineDash,
    borderRadius: 18,
    backgroundColor: colors.paperDeep,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 3,
  },
  ctaPressed: { opacity: 0.75 },
  ctaTitle: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13,
    color: colors.pine,
  },
  ctaSub: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    color: colors.inkSoft,
  },

  swapCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardKind: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  cardTime: {
    fontFamily: fontFamilies.mono[400],
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  swapPair: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  swapArrow: {
    flexShrink: 0,
    fontFamily: fontFamilies.display[600],
    fontSize: 20,
    color: colors.pine,
  },
  dayBox: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: 13,
    padding: 11,
    flexDirection: 'column',
    gap: 2,
  },
  dayBoxDate: {
    fontFamily: fontFamilies.mono[400],
    fontSize: 10,
    color: colors.inkSoft,
  },
  dayBoxName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13,
    color: colors.ink,
  },
  swapNote: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11.5,
    lineHeight: 16.5,
    color: colors.inkSoft,
  },
  swapActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },

  historyItem: {
    backgroundColor: colors.paperDeep,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  historyText: {
    flex: 1,
    fontFamily: fontFamilies.body[500],
    fontSize: 11.5,
    lineHeight: 16.5,
    color: colors.ink,
  },
  historyStamp: {
    fontFamily: fontFamilies.mono[400],
    fontSize: 10.5,
    color: colors.inkSoft,
  },

  formBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 26, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  formSheet: {
    width: '100%',
    backgroundColor: colors.ink,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  formHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  formHeadText: { flex: 1, flexDirection: 'column', gap: 3 },
  formKicker: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.paperFaint,
  },
  formTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 15,
    letterSpacing: -0.15,
    color: colors.paper,
  },
  formClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 234, 224, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHint: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    lineHeight: 16,
    color: colors.paperFaint,
  },
  dayList: { flexDirection: 'column', gap: 7 },
  formOption: {
    borderWidth: 1,
    borderColor: 'rgba(239, 234, 224, 0.18)',
    backgroundColor: 'rgba(239, 234, 224, 0.08)',
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  formOptionPressed: { backgroundColor: 'rgba(239, 234, 224, 0.2)' },
  formOptionTitle: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  formOptionSub: {
    fontFamily: fontFamilies.mono[400],
    fontSize: 10.5,
    color: colors.paper60,
  },
  targetScroll: { flexGrow: 0 },
  targetList: { flexDirection: 'column', gap: 7 },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 11.5,
    color: colors.paper70,
  },
  summaryPair: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 9,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: 'rgba(239, 234, 224, 0.1)',
    borderRadius: 13,
    padding: 11,
    flexDirection: 'column',
    gap: 3,
  },
  summaryLabel: {
    fontFamily: fontFamilies.mono[400],
    fontSize: 9.5,
    color: colors.paperFaint,
  },
  summaryDate: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12,
    color: colors.paper,
  },
  summaryRooms: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10,
    lineHeight: 13.5,
    color: colors.paper60,
  },
  summaryArrow: {
    flexShrink: 0,
    alignSelf: 'center',
    fontFamily: fontFamilies.display[600],
    fontSize: 20,
    color: colors.paper,
  },
  kirimBtn: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  kirimBtnDisabled: { backgroundColor: colors.paper50 },
  kirimText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },
  kirimTextDisabled: { color: colors.paperFaint },
  ubahBtn: {
    borderWidth: 1,
    borderColor: 'rgba(239, 234, 224, 0.3)',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  ubahText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },

  mfBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 3,
  },
  mfNav: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mfNavText: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 17,
    lineHeight: 18,
    color: colors.inkSoft,
  },
  mfNavTextDisabled: { color: colors.lineDash },
  mfCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  mfLabel: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },
  mfDrop: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 8,
    color: colors.inkSoft,
  },
  mfSheet: {
    width: '100%',
    maxHeight: '50%',
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  mfSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mfSheetTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14.5,
    letterSpacing: -0.14,
    color: colors.ink,
  },
  mfSheetClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mfSheetCloseText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 15,
    lineHeight: 15,
    color: colors.inkSoft,
  },
  mfList: { gap: 7 },
  mfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  mfRowActive: { backgroundColor: colors.ink },
  mfRowLabel: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13,
    color: colors.ink,
  },
  mfRowLabelActive: { color: colors.paper },
  mfRowStatus: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  mfRowStatusActive: { color: 'rgba(239, 234, 224, 0.6)' },
});
