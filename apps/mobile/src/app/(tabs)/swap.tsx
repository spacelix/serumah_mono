import { ArrowLeftRight, CalendarDays, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Stamp } from '@/components/ui/stamp';
import { formatWeekdayDate } from '@/lib/format';
import {
  useSwapAvailableDays,
  useSwapMutations,
  useSwapTargets,
  useSwaps,
  type SwapRequest,
} from '@/features/swap/api/swap';
import { dialog } from '@/stores/dialog-store';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

export default function SwapScreen() {
  const { data, isLoading } = useSwaps();
  const [showForm, setShowForm] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Swap"
        kicker="All-or-nothing · 1 hari penuh"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isLoading || data == null ? (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Memuat…</Text>
          </View>
        ) : (
          <>
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

            <Section title="DIAJUKAN KE LO">
              {data.incoming.length === 0 ? (
                <EmptyState
                  icon={
                    <ArrowLeftRight
                      color={colors.inkSoft}
                      size={22}
                      strokeWidth={2}
                    />
                  }
                  title="Tidak ada permintaan swap masuk"
                  sub="Kalau ada yang mau tukar jadwal sama lo, bakal muncul di sini."
                />
              ) : (
                data.incoming.map((s) => <IncomingCard key={s.id} swap={s} />)
              )}
            </Section>

            <Section title="HISTORI SWAP" sub="buat audit">
              {data.mine.length === 0 ? (
                <EmptyState
                  icon={
                    <CalendarDays
                      color={colors.inkSoft}
                      size={22}
                      strokeWidth={2}
                    />
                  }
                  title="Lo belum punya riwayat swap"
                  sub="Ajukan swap buat nuker jadwal piket sama anggota lain."
                />
              ) : (
                data.mine.map((s) => <MineCard key={s.id} swap={s} />)
              )}
            </Section>
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
        <View style={styles.swapArrow}>
          <ArrowLeftRight size={20} color={colors.pine} strokeWidth={2.4} />
        </View>
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

function MineCard({ swap }: { swap: SwapRequest }) {
  const note = useMemo(() => {
    if (swap.status === 'diterima') {
      return `Swap disetujui — ${swap.tanggal} resmi pindah ke ${swap.ke.nama}, ${swap.tanggalKe} jadi jadwal lo.`;
    }
    if (swap.status === 'ditolak') {
      return `Swap ditolak — jadwal balik ke ${swap.dari.nama}.`;
    }
    return `Nunggu ${swap.ke.nama} nerima. Kalau ditolak, jadwal balik ke lo.`;
  }, [swap]);

  return (
    <View style={styles.swapCard}>
      <View style={styles.cardHead}>
        <Text style={styles.cardKind}>Request lo</Text>
        <Text style={styles.cardTime}>{relativeTime(swap.createdAt)}</Text>
      </View>

      <View style={styles.swapPair}>
        <DayBox date={swap.tanggal} nama={swap.dari.nama} isLo />
        <View style={styles.swapArrow}>
          <ArrowLeftRight size={20} color={colors.pine} strokeWidth={2.4} />
        </View>
        <DayBox date={swap.tanggalKe} nama={swap.ke.nama} />
      </View>

      <Text style={styles.swapNote}>{note}</Text>

      <View style={styles.mineStamp}>
        <Stamp status={swap.status} />
      </View>
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
        {isLo ? `Lo (${nama})` : nama}
      </Text>
    </View>
  );
}

/** Form 2-step: pilih hari lo → pilih hari anggota lain (mutual). */
function SwapForm({ onClose }: { onClose: () => void }) {
  const { data: myDays, isLoading: daysLoading } = useSwapAvailableDays();
  const { data: targets, isLoading: targetsLoading } = useSwapTargets();
  const { create } = useSwapMutations();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2>(1);
  const [myDay, setMyDay] = useState<string | null>(null);
  const [target, setTarget] = useState<{
    memberId: string;
    nama: string;
    day: string;
  } | null>(null);

  const canSubmit = myDay != null && target != null && !create.isPending;

  const onSubmit = () => {
    if (!myDay || !target) return;
    create.mutate(
      { tanggal: myDay, tanggalKe: target.day, keAnggotaId: target.memberId },
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
                Langkah {step} dari 2
              </Text>
              <Text style={styles.formTitle}>
                {step === 1
                  ? 'Pilih hari lo yang mau ditukar'
                  : 'Mau tukar sama hari siapa?'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.formClose}>
              <X color={colors.paper} size={15} strokeWidth={2.4} />
            </Pressable>
          </View>

          {step === 1 ? (
            <>
              <Text style={styles.formHint}>
                Cuma hari piket yang sudah terjadwal bisa ditukar.
              </Text>
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
                      key={d}
                      onPress={() => setMyDay(d)}
                      style={[
                        styles.dayOption,
                        myDay === d && styles.dayOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayOptionText,
                          myDay === d && styles.dayOptionTextActive,
                        ]}
                      >
                        {formatWeekdayDate(d)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
              <Pressable
                onPress={() => myDay != null && setStep(2)}
                disabled={myDay == null}
                style={[
                  styles.submitBtn,
                  myDay == null && styles.submitBtnDisabled,
                ]}
              >
                <Text style={styles.submitText}>Lanjut</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.formHint}>
                Cuma hari yang sudah ada penanggung jawabnya bisa ditukar.
              </Text>
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
                    t.days.map((d) => {
                      const active =
                        target != null &&
                        target.memberId === t.id &&
                        target.day === d;
                      return (
                        <Pressable
                          key={`${t.id}-${d}`}
                          onPress={() =>
                            setTarget({ memberId: t.id, nama: t.nama, day: d })
                          }
                          style={[
                            styles.targetOption,
                            active && styles.targetOptionActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.targetOptionText,
                              active && styles.targetOptionTextActive,
                            ]}
                          >
                            {formatWeekdayDate(d)} · {t.nama}
                          </Text>
                        </Pressable>
                      );
                    }),
                  )
                )}
              </ScrollView>
              <View style={styles.formActions}>
                <Pressable
                  onPress={() => setStep(1)}
                  style={styles.backBtn}
                >
                  <Text style={styles.backText}>← Ganti hari lo</Text>
                </Pressable>
                <Pressable
                  onPress={() => void onSubmit()}
                  disabled={!canSubmit}
                  style={[
                    styles.submitBtn,
                    !canSubmit && styles.submitBtnDisabled,
                  ]}
                >
                  <Text style={styles.submitText}>
                    {create.isPending ? 'Mengirim…' : 'Ajukan'}
                  </Text>
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
    gap: 12,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBox: {
    flex: 1,
    backgroundColor: colors.paperDeep,
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
  mineStamp: { alignSelf: 'flex-end' },

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
  dayList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayOption: {
    borderWidth: 1,
    borderColor: 'rgba(239, 234, 224, 0.18)',
    backgroundColor: 'rgba(239, 234, 224, 0.08)',
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  dayOptionActive: {
    borderColor: colors.pine,
    backgroundColor: colors.pine,
  },
  dayOptionText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  dayOptionTextActive: { color: colors.paper },
  targetScroll: { flexGrow: 0 },
  targetList: { flexDirection: 'column', gap: 7 },
  targetOption: {
    borderWidth: 1,
    borderColor: 'rgba(239, 234, 224, 0.18)',
    backgroundColor: 'rgba(239, 234, 224, 0.08)',
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  targetOptionActive: {
    borderColor: colors.pine,
    backgroundColor: colors.pine,
  },
  targetOptionText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  targetOptionTextActive: { color: colors.paper },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { paddingVertical: 4 },
  backText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 11.5,
    color: colors.paperFaint,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: colors.pine,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.disabledBg },
  submitText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
});
