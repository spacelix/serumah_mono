import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import {
  useConfirmGalon,
  useDashboard,
  useNudgeGalon,
  useSetWeekendStatus,
  type DashboardData,
  type ScheduleRow,
  type WeekendChoice,
} from '@/features/dashboard/api/dashboard';
import {
  firstName,
  formatCurrency,
  formatDayNumber,
  formatMonthYear,
  formatWeekRange,
  formatWeekdayDate,
} from '@/lib/format';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

export default function BerandaScreen() {
  const { data, isLoading, refetch, isFetching } = useDashboard();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Beranda" />
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
            <WeekendCard data={data} />
            <GalonWidget data={data} />
            <BillingSummary data={data} />
            <ScheduleList data={data} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WeekendCard({ data }: { data: DashboardData }) {
  const setStatus = useSetWeekendStatus();
  const [frozenVisible, setFrozenVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const status = data.weekend.status;
  const didKos = status === 'di_kos';
  const inCooldown = isCooldownActive(data.weekend.nextChangeAt);

  const set = (next: WeekendChoice) => {
    if (data.weekend.frozen) {
      setFrozenVisible(true);
      return;
    }
    if (setStatus.isPending || inCooldown || next === status) return; // cegah spam/duplikat
    setStatus.mutate(next, {
      onError: (e) => {
        setErrorMsg(e instanceof Error ? e.message : 'Terjadi kesalahan.');
        setErrorVisible(true);
      },
    });
  };

  const sabtuDate = weekendDate(5);
  const mingguDate = weekendDate(6);

  return (
    <View style={styles.weekendCard}>
      <View style={styles.weekendHead}>
        <Text style={styles.weekendTitle}>Weekend ini lo di kos?</Text>
        <View style={styles.weekendDeadline}>
          <Text style={styles.weekendDeadlineText}>Deadline Jum 20:00</Text>
        </View>
      </View>
      <Text style={styles.weekendSub}>
        {didKos
          ? `Lo ambil piket ${formatWeekdayDate(sabtuDate)} dan ${formatWeekdayDate(mingguDate)} — jadi bebas piket Senin–Jumat minggu ini.`
          : 'Kalau lo di kos dan piket di Sabtu/Minggu, lo bebas piket Senin–Jumat minggu itu.'}
      </Text>
      <View style={styles.weekendDayRow}>
        <Text style={styles.weekendDayLabel} numberOfLines={1}>
          {formatWeekdayDate(sabtuDate)} & {formatWeekdayDate(mingguDate)}
        </Text>
        <View style={styles.weekendDayBtns}>
          <Pressable
            onPress={() => set('di_kos')}
            disabled={setStatus.isPending || inCooldown || status === 'di_kos'}
            style={({ pressed }) => [
              styles.weekendDayBtn,
              status === 'di_kos' && styles.weekendDayBtnActive,
              pressed && styles.weekendDayBtnPressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.weekendDayBtnText,
                status === 'di_kos' && styles.weekendDayBtnTextActive,
              ]}
            >
              Di kos
            </Text>
          </Pressable>
          <Pressable
            onPress={() => set('pulang')}
            disabled={setStatus.isPending || inCooldown || status === 'pulang'}
            style={({ pressed }) => [
              styles.weekendDayBtn,
              status === 'pulang' && styles.weekendDayBtnActive,
              pressed && styles.weekendDayBtnPressed,
            ]}
          >
            <Text
              style={[
                styles.weekendDayBtnText,
                status === 'pulang' && styles.weekendDayBtnTextActive,
              ]}
            >
              Pulang
            </Text>
          </Pressable>
        </View>
      </View>
      {inCooldown && data.weekend.nextChangeAt && (
        <Text style={styles.weekendCooldown}>
          Ganti status lagi {cooldownHint(data.weekend.nextChangeAt)}.
        </Text>
      )}
      {didKos && (
        <View style={styles.weekendNotice}>
          <Text style={styles.weekendNoticeText}>
            Tapi kalau ternyata lo keluar dan piketnya nggak dikerjain, dendanya
            tetap jalan seperti biasa.
          </Text>
        </View>
      )}
      {data.weekend.anggotaLain.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekendOthers}
        >
          <Text style={styles.weekendOthersLabel}>ANGGOTA LAIN</Text>
          {data.weekend.anggotaLain.map((m) => (
            <Text
              key={m.id}
              style={[
                styles.weekendOtherItem,
                m.status === 'Pulang' && styles.weekendOtherItemMuted,
              ]}
            >
              {firstName(m.nama)} · {m.status}
            </Text>
          ))}
        </ScrollView>
      )}

      <ConfirmDialog
        visible={frozenVisible}
        title="Status dibekukan"
        message="Status akhir pekan sudah dibekukan (Jumat 20:00)."
        confirmText="Tutup"
        single
        onConfirm={() => setFrozenVisible(false)}
        onCancel={() => setFrozenVisible(false)}
      />
      <ConfirmDialog
        visible={errorVisible}
        title="Gagal ubah status"
        message={errorMsg}
        confirmText="Tutup"
        single
        onConfirm={() => setErrorVisible(false)}
        onCancel={() => setErrorVisible(false)}
      />
    </View>
  );
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** True jika `nextChangeAt` (ISO) masih di masa depan. */
function isCooldownActive(nextChangeAt: string | null): boolean {
  if (!nextChangeAt) return false;
  return new Date(nextChangeAt).getTime() > Date.now();
}

/** "pukul 17:30" — waktu WIB kapan cooldown berakhir. */
function cooldownHint(nextChangeAt: string): string {
  const wib = new Date(new Date(nextChangeAt).getTime() + WIB_OFFSET_MS);
  const hh = String(wib.getUTCHours()).padStart(2, '0');
  const mm = String(wib.getUTCMinutes()).padStart(2, '0');
  return `pukul ${hh}:${mm} WIB`;
}

function weekendDate(dowOffset: number): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  const target = new Date(monday);
  target.setDate(monday.getDate() + dowOffset);
  return target.toISOString();
}

function GalonWidget({ data }: { data: DashboardData }) {
  const confirm = useConfirmGalon();
  const nudge = useNudgeGalon();
  const giliran = data.galon;
  const [error, setError] = useState<string | null>(null);
  const [justBought, setJustBought] = useState(false);
  const nudgedToday = giliran.nudgedToday;

  const onBuy = () => {
    if (giliran.giliran == null) return;
    setJustBought(true);
    confirm.mutate(giliran.giliran.id, {
      onError: (e) => {
        setJustBought(false);
        setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
      },
    });
  };

  const onNudge = () => {
    if (nudgedToday || nudge.isPending) return;
    nudge.mutate(undefined, {
      onError: (e) =>
        setError(e instanceof Error ? e.message : 'Terjadi kesalahan.'),
    });
  };

  const hasTurn = giliran.namaAnggota != null;

  return (
    <View style={styles.galonCard}>
      <View style={styles.galonBody}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 2.5h6M10 2.5v3l-3 3.5V20a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 20V9l-3-3.5v-3M7.4 13h9.2"
            stroke={colors.mustard}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <View style={styles.galonText}>
          <Text style={styles.galonKicker}>Beli galon</Text>
          <Text style={styles.galonName}>
            {hasTurn
              ? `Giliran: ${giliran.namaAnggota}${giliran.isMine ? ' (lo)' : ''}`
              : 'Belum ada giliran'}
          </Text>
        </View>
        {giliran.isMine ? (
          <Pressable
            onPress={onBuy}
            disabled={giliran.giliran == null || confirm.isPending}
            style={({ pressed }) => [
              styles.galonBtn,
              pressed && styles.galonBtnPressed,
            ]}
          >
            <Text style={styles.galonBtnText}>
              {confirm.isPending ? 'Memproses…' : 'Sudah Beli'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onNudge}
            disabled={nudgedToday || nudge.isPending}
            accessibilityLabel={`Kirim notif ke ${giliran.namaAnggota ?? ''}`}
            style={({ pressed }) => [
              styles.galonNudgeBtn,
              nudgedToday && styles.galonNudgeBtnNudged,
              pressed && styles.galonNudgeBtnPressed,
            ]}
          >
            <Svg
              width={17}
              height={17}
              viewBox="0 0 24 24"
              fill="none"
              stroke={nudgedToday ? colors.mustard : colors.inkSoft}
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15L18 15.5zM10 21h4" />
            </Svg>
          </Pressable>
        )}
      </View>
      {hasTurn && !giliran.isMine && (
        <Text style={[styles.galonNote, nudgedToday && styles.galonNoteNudged]}>
          {nudgedToday
            ? 'Kamu udah colek hari ini. Coba lagi besok.'
            : 'Galon habis? colek dia biar segera beli'}
        </Text>
      )}
      {justBought && hasTurn && (
        <View style={styles.galonDoneChip}>
          <Text style={styles.galonDoneChipText}>
            Tercatat. Giliran maju ke {giliran.namaAnggota} · notif terkirim.
          </Text>
        </View>
      )}

      <ConfirmDialog
        visible={error != null}
        title="Gagal"
        message={error ?? ''}
        confirmText="Tutup"
        single
        onConfirm={() => setError(null)}
        onCancel={() => setError(null)}
      />
    </View>
  );
}

function BillingSummary({ data }: { data: DashboardData }) {
  const router = useRouter();
  const { total, lunas, totalUnpaid } = data.billing;
  const bulan = formatMonthYear(data.billing.bulan ?? new Date().toISOString());
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/tagihan')}
      style={({ pressed }) => [
        styles.billingCard,
        pressed && styles.billingPressed,
      ]}
    >
      <View style={styles.billingText}>
        <Text style={styles.billingKicker}>Tagihan bulan ini · {bulan}</Text>
        <Text
          style={[
            styles.billingAmount,
            totalUnpaid === 0 && styles.billingPaid,
          ]}
        >
          {totalUnpaid === 0 ? 'Lunas' : formatCurrency(totalUnpaid)}
        </Text>
        <Text style={styles.billingSub}>
          {formatCurrency(lunas)} dari {formatCurrency(total)} lunas
        </Text>
      </View>
      <Text style={styles.billingLink}>Lihat detail →</Text>
    </Pressable>
  );
}

function ScheduleList({ data }: { data: DashboardData }) {
  const router = useRouter();
  const first = data.scheduleWeek[0]?.tanggal;
  const last = data.scheduleWeek[data.scheduleWeek.length - 1]?.tanggal;
  return (
    <View style={styles.scheduleBlock}>
      <View style={styles.scheduleHead}>
        <Text style={styles.scheduleTitle}>Jadwal minggu ini</Text>
        {first && last && (
          <Text style={styles.scheduleRange}>
            {formatWeekRange(first, last)}
          </Text>
        )}
      </View>
      {data.scheduleWeek.length === 0 ? (
        <EmptyState
          icon={
            <CalendarDays color={colors.inkSoft} size={22} strokeWidth={2} />
          }
          title="Belum ada jadwal pekan ini"
          sub={
            data.isAdmin
              ? 'Generate jadwal bulan ini — jadwal weekday dibuat sekali untuk 1 bulan.'
              : 'Tunggu PJ Kos membuat jadwal piket.'
          }
          action={
            data.isAdmin
              ? {
                  label: 'Generate Jadwal',
                  onPress: () => router.push('/rumah/manage?scrollTo=generate'),
                }
              : undefined
          }
        />
      ) : (
        <View style={styles.scheduleList}>
          {data.scheduleWeek.map((row) => (
            <ScheduleRowItem key={row.tanggal} row={row} />
          ))}
        </View>
      )}
    </View>
  );
}

function ScheduleRowItem({ row }: { row: ScheduleRow }) {
  const today = isToday(row.tanggal);
  const isWeekendDay = row.dow === 'Sabtu' || row.dow === 'Minggu';
  const isLibur = row.statusTag === 'LIBUR' || row.statusTag === 'Free';
  const hasMember = row.anggotaList.length > 0 && !isLibur;

  const names = row.anggotaList.map((a) =>
    row.isMine && row.anggotaList.length === 1
      ? `${a.nama} (lo)`
      : a.nama,
  );
  const name = hasMember ? names.join(', ') : 'Libur';
  const sub = hasMember
    ? row.ruangan.join(' · ')
    : liburSubtitle(isWeekendDay, row.dow);

  return (
    <View
      style={[
        styles.scheduleRow,
        today && styles.scheduleRowToday,
        isLibur && styles.scheduleRowFree,
      ]}
    >
      <View
        style={[
          styles.dateChip,
          !today && !isLibur && styles.dateChipPlan,
          !today && isLibur && styles.dateChipFree,
          today && styles.dateChipToday,
        ]}
      >
        <Text
          style={[
            styles.dow,
            today && styles.dateChipTodayDim,
            !today && isLibur && styles.dateChipDim,
          ]}
        >
          {dowShort(row.dow)}
        </Text>
        <Text
          style={[
            styles.dateNum,
            today && styles.dateChipTodayDim,
            !today && isLibur && styles.dateChipDim,
          ]}
        >
          {formatDayNumber(row.tanggal)}
        </Text>
      </View>
      <View style={styles.scheduleBody}>
        <Text
          style={[styles.memberName, isLibur && styles.textMuted]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={[styles.rooms, isLibur && styles.textMuted]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      </View>
      <StatusPill
        tag={row.statusTag}
        isWeekendDay={isWeekendDay}
        today={today}
        isLibur={isLibur}
      />
    </View>
  );
}

function liburSubtitle(isWeekendDay: boolean, dow: string): string {
  if (isWeekendDay) return 'Semua pulang — bebas piket';
  if (dow === 'Selasa' || dow === 'Kamis')
    return 'Jeda antar piket — sengaja dikosongin';
  return 'Slot nggak kepake minggu ini';
}

function dowShort(dow: string): string {
  const map: Record<string, string> = {
    Senin: 'SEN',
    Selasa: 'SEL',
    Rabu: 'RAB',
    Kamis: 'KAM',
    Jumat: 'JUM',
    Sabtu: 'SAB',
    Minggu: 'MIN',
  };
  return map[dow] ?? dow.slice(0, 3).toUpperCase();
}

function StatusPill({
  tag,
  isWeekendDay,
  today,
  isLibur,
}: {
  tag: string;
  isWeekendDay: boolean;
  today: boolean;
  isLibur: boolean;
}) {
  const done = tag === 'Selesai';
  const bolong = tag === 'Bolong';
  const label =
    tag === 'Free' || tag === 'LIBUR'
      ? today
        ? 'Hari ini'
        : 'Libur'
      : isWeekendDay && !done
        ? 'Weekend'
        : tag;

  const isTodayPill = label === 'Hari ini';
  const freeBuild = isLibur || label === 'Libur';

  return (
    <View
      style={[
        styles.tagPill,
        done && styles.tagDone,
        bolong && styles.tagBolong,
        freeBuild && styles.tagFree,
        isTodayPill && styles.tagToday,
      ]}
    >
      <Text
        style={[
          styles.tagText,
          (freeBuild || isTodayPill) && styles.textMuted,
          isTodayPill && styles.tagTextToday,
          done && styles.tagTextDone,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
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
  weekendCard: {
    backgroundColor: colors.pine,
    borderRadius: radius['3xl'],
    padding: 16,
    paddingBottom: 14,
    gap: 6,
  },
  weekendHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekendTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14.5,
    letterSpacing: -0.01,
    color: colors.paper,
    flexShrink: 1,
  },
  weekendDeadline: {
    borderWidth: 1,
    borderColor: 'rgba(239, 234, 224, 0.4)',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  weekendDeadlineText: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    color: colors.paper,
  },
  weekendSub: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11.5,
    lineHeight: 16,
    color: 'rgba(239, 234, 224, 0.72)',
    marginBottom: 6,
  },
  weekendDays: { flexDirection: 'column', gap: 8 },
  weekendDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'rgba(239, 234, 224, 0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
  },
  weekendDayLabel: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
    flex: 1,
    minWidth: 0,
  },
  weekendDayBtns: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  weekendDayBtn: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 9,
    backgroundColor: 'rgba(239, 234, 224, 0.14)',
    flexShrink: 0,
  },
  weekendDayBtnPressed: { opacity: 0.75 },
  weekendDayBtnActive: { backgroundColor: colors.paper },
  weekendDayBtnText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 11.5,
    color: 'rgba(239, 234, 224, 0.8)',
  },
  weekendDayBtnTextActive: { color: colors.ink },
  weekendCooldown: {
    fontFamily: fontFamilies.body[500],
    fontSize: 10.5,
    lineHeight: 15,
    color: 'rgba(239, 234, 224, 0.8)',
    marginTop: 2,
  },
  weekendOthers: {
    marginTop: 11,
    flexGrow: 0,
    paddingTop: 2,
  },
  weekendOthersLabel: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    color: 'rgba(239, 234, 224, 0.5)',
    marginRight: 9,
    lineHeight: 16,
  },
  weekendNotice: {
    backgroundColor: 'rgba(179, 63, 63, 0.22)',
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  weekendNoticeText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 11,
    lineHeight: 15.4,
    color: colors.brickSoft,
  },
  weekendOtherItem: {
    fontFamily: fontFamilies.body[500],
    fontSize: 10.5,
    color: colors.paper,
    marginRight: 9,
    lineHeight: 16,
  },
  weekendOtherItemMuted: { color: 'rgba(239, 234, 224, 0.55)' },
  galonCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 13,
    paddingLeft: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.mustard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  galonBody: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  galonText: { flex: 1, gap: 1 },
  galonKicker: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: 1.14,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  galonName: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14.5,
    color: colors.ink,
    letterSpacing: -0.01,
  },
  galonBtn: {
    backgroundColor: colors.ink,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  galonBtnPressed: { backgroundColor: colors.pine },
  galonBtnText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 11.5,
    color: colors.paper,
  },
  galonNudgeBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galonNudgeBtnNudged: { backgroundColor: colors.mustardSoft },
  galonNudgeBtnPressed: { opacity: 0.7 },
  galonNote: {
    marginTop: 11,
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.inkSoft,
  },
  galonNoteNudged: {
    fontFamily: fontFamilies.body[500],
    color: colors.pine,
  },
  galonDoneChip: {
    marginTop: 11,
    width: '100%',
    backgroundColor: colors.pineSoft,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  galonDoneChipText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.pine,
  },
  billingCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  billingPressed: { backgroundColor: colors.paperDeep },
  billingText: { flex: 1, flexDirection: 'column', gap: 2 },
  billingKicker: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: 1.14,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  billingAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 21,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  billingPaid: { color: colors.inkSoft },
  billingSub: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  billingLink: {
    fontFamily: fontFamilies.body[600],
    fontSize: 11.5,
    color: colors.pine,
    flexShrink: 0,
  },
  scheduleBlock: { gap: 8 },
  scheduleHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  scheduleTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 0.47,
  },
  scheduleRange: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10,
    color: colors.inkSoft,
  },
  scheduleList: { gap: 8 },
  scheduleRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleRowFree: { backgroundColor: colors.paperDeep },
  scheduleRowToday: { borderColor: colors.mustardBorder },
  dateChip: {
    width: 40,
    height: 44,
    borderRadius: 11,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  dateChipToday: { backgroundColor: colors.mustard, borderRadius: 11 },
  dateChipTodayDim: { color: colors.mustardInkStrong },
  dateChipPlan: { backgroundColor: colors.paperDeep, borderRadius: 11 },
  dateChipFree: { backgroundColor: 'transparent', borderRadius: 11 },
  dateChipDim: { color: colors.inkMuted },
  dow: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 8.5,
    letterSpacing: 0.6,
    color: colors.ink,
    opacity: 0.7,
  },
  dateNum: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 16,
    lineHeight: 16,
    color: colors.ink,
  },
  textMuted: { color: colors.inkMuted },
  scheduleBody: { flex: 1, gap: 2 },
  memberName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13.5,
    color: colors.ink,
  },
  rooms: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    color: colors.inkSoft,
  },
  tagPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tagFree: { borderStyle: 'dashed', borderColor: colors.lineDash },
  tagDone: { backgroundColor: colors.pineSoft, borderColor: 'transparent' },
  tagBolong: { backgroundColor: colors.brickSoft },
  tagToday: { backgroundColor: colors.mustardSoft, borderColor: 'transparent' },
  tagText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  tagTextToday: { color: colors.mustardInk },
  tagTextDone: { color: colors.pineDeep },
});
