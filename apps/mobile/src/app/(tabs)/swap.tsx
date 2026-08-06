import { ArrowLeftRight, CalendarDays, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SerumahLogo } from '@/components/logo/serumah-logo';
import { Stamp } from '@/components/ui/stamp';
import { formatShortDate } from '@/lib/format';
import {
  useSwapAvailableDays,
  useSwapMutations,
  useSwaps,
  type SwapRequest,
} from '@/features/swap/api/swap';
import { useIuranMembers } from '@/features/swap/api/members';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

export default function SwapScreen() {
  const { data, isLoading } = useSwaps();
  const [showForm, setShowForm] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />
        {isLoading || data == null ? (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Memuat…</Text>
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowForm(true)} style={styles.ctaCard}>
              <View style={styles.ctaIcon}>
                <Plus color={colors.ink} size={16} strokeWidth={2.4} />
              </View>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>Ajukan swap baru</Text>
                <Text style={styles.ctaSub}>Tukar jadwal piket dengan anggota lain</Text>
              </View>
            </Pressable>

            <Section title="DIAJUKAN KE LO">
              {data.incoming.length === 0 ? (
                <Empty text="Tidak ada permintaan swap masuk" />
              ) : (
                data.incoming.map((s) => <IncomingCard key={s.id} swap={s} />)
              )}
            </Section>

            <Section title="SWAP MILIK LO">
              {data.mine.length === 0 ? (
                <Empty text="Lo belum punya riwayat swap" />
              ) : (
                data.mine.map((s) => <MineCard key={s.id} swap={s} />)
              )}
            </Section>
          </>
        )}

        {showForm && <SwapForm onClose={() => setShowForm(false)} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <SerumahLogo size={22} variant="mark" roofColor={colors.ink} />
        <Text style={styles.brandText}>Swap</Text>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function IncomingCard({ swap }: { swap: SwapRequest }) {
  const { accept, reject } = useSwapMutations();
  const onAccept = () =>
    accept.mutate(swap.id, {
      onError: (e) => Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.'),
    });
  const onReject = () =>
    reject.mutate(swap.id, {
      onError: (e) => Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.'),
    });

  return (
    <View style={styles.swapCard}>
      <View style={styles.swapPair}>
        <MemberBox nama={swap.dari.nama} kamar={swap.dari.kamar} />
        <View style={styles.swapArrow}>
          <ArrowLeftRight size={14} color={colors.inkSoft} strokeWidth={2.2} />
        </View>
        <MemberBox nama={swap.ke.nama} kamar={swap.ke.kamar} />
      </View>
      <View style={styles.dayRow}>
        <CalendarDays size={13} color={colors.mustardInk} strokeWidth={2} />
        <Text style={styles.dayText}>{formatShortDate(swap.tanggal)}</Text>
      </View>
      <View style={styles.swapActions}>
        <Pressable onPress={onReject} disabled={reject.isPending} style={styles.rejectBtn}>
          <Text style={styles.rejectText}>Tolak</Text>
        </Pressable>
        <Pressable onPress={onAccept} disabled={accept.isPending} style={styles.acceptBtn}>
          <Text style={styles.acceptText}>{accept.isPending ? '…' : 'Terima'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MineCard({ swap }: { swap: SwapRequest }) {
  return (
    <View style={styles.mineCard}>
      <View style={styles.swapPair}>
        <MemberBox nama={swap.dari.nama} kamar={swap.dari.kamar} />
        <View style={styles.swapArrow}>
          <ArrowLeftRight size={12} color={colors.inkSoft} strokeWidth={2.2} />
        </View>
        <MemberBox nama={swap.ke.nama} kamar={swap.ke.kamar} />
      </View>
      <View style={styles.mineMeta}>
        <Text style={styles.dayText}>{formatShortDate(swap.tanggal)}</Text>
        <Stamp status={swap.status} />
      </View>
    </View>
  );
}

function MemberBox({ nama, kamar }: { nama: string; kamar: string | null }) {
  return (
    <View style={styles.memberBox}>
      <Text style={styles.memberName} numberOfLines={1}>
        {nama}
      </Text>
      {kamar != null && (
        <Text style={styles.memberKamar} numberOfLines={1}>
          {kamar}
        </Text>
      )}
    </View>
  );
}

function SwapForm({ onClose }: { onClose: () => void }) {
  const { data: days, isLoading } = useSwapAvailableDays();
  const members = useIuranMembers();
  const { create } = useSwapMutations();
  const [day, setDay] = useState<string | null>(null);
  const [member, setMember] = useState<string | null>(null);

  const canSubmit = day != null && member != null && !create.isPending;

  const onSubmit = () => {
    if (!day || !member) return;
    create.mutate(
      { tanggal: day, keAnggotaId: member },
      {
        onSuccess: () => {
          onClose();
          Alert.alert('Terkirim', 'Permintaan swap terkirim untuk dikonfirmasi.');
        },
        onError: (e) =>
          Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan.'),
      },
    );
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>Ajukan swap</Text>

      <Text style={styles.formLabel}>Pilih hari (jadwal lo)</Text>
      {isLoading ? (
        <Text style={styles.formHint}>Memuat hari…</Text>
      ) : (
        <View style={styles.dayGrid}>
          {(days ?? []).map((d) => (
            <Pressable
              key={d}
              onPress={() => setDay(d)}
              style={[styles.dayChip, day === d && styles.dayChipActive]}>
              <Text style={[styles.dayChipText, day === d && styles.dayChipTextActive]}>
                {formatShortDate(d)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {days != null && days.length === 0 && (
        <Text style={styles.formHint}>Tidak ada hari tersedia untuk swap</Text>
      )}

      <Text style={styles.formLabel}>Pilih anggota</Text>
      <View style={styles.memberList}>
        {members.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMember(m.id)}
            style={[styles.memberRow, member === m.id && styles.memberRowActive]}>
            <Text
              style={[styles.memberRowName, member === m.id && styles.memberRowNameActive]}>
              {m.nama}
            </Text>
            {m.kamar != null && <Text style={styles.memberRowKamar}>{m.kamar}</Text>}
          </Pressable>
        ))}
      </View>

      <View style={styles.formActions}>
        <Pressable onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Batal</Text>
        </Pressable>
        <Pressable onPress={() => void onSubmit()} disabled={!canSubmit} style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}>
          <Text style={styles.submitText}>{create.isPending ? 'Mengirim…' : 'Ajukan'}</Text>
        </Pressable>
      </View>
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
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 108, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { ...type.section, color: colors.ink },
  loading: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },
  section: { gap: 8 },
  sectionTitle: { ...type.kicker, fontSize: 9.5, color: colors.inkMuted },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { ...type.body, color: colors.inkMuted, textAlign: 'center' },

  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineDash,
    borderRadius: radius['2xl'],
    padding: 16,
    backgroundColor: colors.card,
  },
  ctaIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, gap: 2 },
  ctaTitle: { fontFamily: fontFamilies.body[700], fontSize: 13.5, color: colors.ink },
  ctaSub: { fontFamily: fontFamilies.body[400], fontSize: 11, color: colors.inkSoft },

  swapCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 12,
  },
  swapPair: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  swapArrow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
  },
  memberBox: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    gap: 2,
    minHeight: 52,
  },
  memberName: { fontFamily: fontFamilies.body[700], fontSize: 12.5, color: colors.ink },
  memberKamar: { fontFamily: fontFamilies.body[400], fontSize: 10, color: colors.inkSoft },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayText: { fontFamily: fontFamilies.mono[600], fontSize: 12, color: colors.ink },
  swapActions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.brick,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rejectText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.brick },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  acceptText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.paper },

  mineCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 12,
    gap: 10,
  },
  mineMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 12,
  },
  formTitle: { fontFamily: fontFamilies.display[600], fontSize: 16, color: colors.ink },
  formLabel: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.inkSoft },
  formHint: { fontFamily: fontFamilies.body[400], fontSize: 11, color: colors.inkMuted },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.paper,
  },
  dayChipActive: { backgroundColor: colors.pine, borderColor: colors.pine },
  dayChipText: { fontFamily: fontFamilies.mono[600], fontSize: 11.5, color: colors.ink },
  dayChipTextActive: { color: colors.paper },
  memberList: { gap: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: colors.paper,
    gap: 8,
  },
  memberRowActive: { borderColor: colors.pine, backgroundColor: colors.pineSoft },
  memberRowName: { flex: 1, fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.ink },
  memberRowNameActive: { color: colors.pineDeep },
  memberRowKamar: { fontFamily: fontFamilies.body[400], fontSize: 11, color: colors.inkSoft },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.ink },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.disabledBg },
  submitText: { fontFamily: fontFamilies.body[700], fontSize: 12.5, color: colors.paper },
});