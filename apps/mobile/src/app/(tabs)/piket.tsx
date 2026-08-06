import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, X } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SerumahLogo } from '@/components/logo/serumah-logo';
import {
  useCreateSubmission,
  usePiketToday,
  type RuanganProofInput,
} from '@/features/piket/api/piket';
import { formatShortDate } from '@/lib/format';
import { usePiketDraft, type RoomDraft } from '@/stores/piket-draft-store';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

export default function PiketScreen() {
  const { data, isLoading } = usePiketToday();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Header tanggal={data?.jadwal?.tanggal} />
        {isLoading || data == null ? (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Memuat…</Text>
          </View>
        ) : data.jadwal == null ? (
          <EmptyState />
        ) : (
          <View style={styles.body}>
            <ScheduleHeader nama={data.jadwal.anggota.nama} tanggal={data.jadwal.tanggal} />
            {data.ruangan.map((room, index) => (
              <RuanganPiketCard
                key={room.id}
                index={index}
                roomId={room.id}
                nama={room.nama}
                jenis={data.jenisByRuangan[room.id] ?? []}
              />
            ))}
            <BottomBar total={data.ruangan.length} hasExisting={data.existingSubmission != null} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ tanggal }: { tanggal?: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <SerumahLogo size={22} variant="mark" roofColor={colors.ink} />
        <Text style={styles.brandText}>Piket</Text>
      </View>
      {tanggal != null && (
        <Text style={styles.dayChipText}>{formatShortDate(tanggal)}</Text>
      )}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <X color={colors.inkSoft} size={22} strokeWidth={2} />
      </View>
      <Text style={styles.emptyTitle}>Hari ini bukan giliran piket</Text>
      <Text style={styles.emptySub}>
        Piket hanya dijadwalkan pada hari piket sesuai Papan Piket.
      </Text>
    </View>
  );
}

function ScheduleHeader({ nama, tanggal }: { nama: string; tanggal: string }) {
  return (
    <View style={styles.scheduleHeader}>
      <Text style={styles.scheduleKicker}>GILIRAN PIKET</Text>
      <Text style={styles.scheduleName} numberOfLines={1}>
        {nama}
      </Text>
      <Text style={styles.scheduleDate}>{formatShortDate(tanggal)}</Text>
    </View>
  );
}

function RuanganPiketCard({
  index,
  roomId,
  nama,
  jenis,
}: {
  index: number;
  roomId: string;
  nama: string;
  jenis: { id: string; nama: string }[];
}) {
  const { drafts, setPhoto, toggleJenis } = usePiketDraft();
  const draft = drafts[roomId];
  const complete = isComplete(jenis, draft);

  return (
    <View style={[styles.roomCard, complete && styles.roomCardDone]}>
      <View style={styles.roomTitleRow}>
        <View style={styles.roomBadge}>
          <Text style={styles.roomBadgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.roomName}>{nama}</Text>
      </View>

      <View style={styles.photoRow}>
        <PhotoSlot
          label="Foto sebelum"
          uri={draft?.fotoBefore ?? null}
          onPick={() => pickPhoto(roomId, 'before', setPhoto)}
        />
        <PhotoSlot
          label="Foto sesudah"
          uri={draft?.fotoAfter ?? null}
          onPick={() => pickPhoto(roomId, 'after', setPhoto)}
        />
      </View>

      <View style={styles.checklistTitleRow}>
        <Text style={styles.checklistTitle}>Jenis piket</Text>
        <Text style={styles.checklistHint}>pilih yang dikerjakan</Text>
      </View>
      <View style={styles.checklist}>
        {jenis.map((j) => {
          const checked = draft?.jenisSelesai.includes(j.id) ?? false;
          return (
            <Pressable
              key={j.id}
              onPress={() => toggleJenis(roomId, j.id)}
              style={styles.checkRow}>
              <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                {checked && <Check color={colors.paper} size={13} strokeWidth={3} />}
              </View>
              <Text style={[styles.checkLabel, checked && styles.checkLabelActive]}>
                {j.nama}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

async function pickPhoto(
  roomId: string,
  slot: 'before' | 'after',
  setPhoto: (roomId: string, slot: 'before' | 'after', uri: string) => void,
) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Izin kamera', 'Izinkan akses kamera untuk memotret bukti piket.');
    return;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });
  if (!result.canceled && result.assets[0]) {
    setPhoto(roomId, slot, result.assets[0].uri);
  }
}

function PhotoSlot({
  label,
  uri,
  onPick,
}: {
  label: string;
  uri: string | null;
  onPick: () => void;
}) {
  return (
    <Pressable onPress={onPick} style={[styles.photoSlot, uri && styles.photoSlotFilled]}>
      {uri ? (
        <View style={styles.photoIconRow}>
          <Check color={colors.pine} size={16} strokeWidth={3} />
        </View>
      ) : (
        <View style={styles.photoIconRow}>
          <Camera color={colors.inkSoft} size={16} strokeWidth={2} />
        </View>
      )}
      <Text style={[styles.photoLabel, uri && styles.photoLabelFilled]}>{label}</Text>
    </Pressable>
  );
}

function BottomBar({
  total,
  hasExisting,
}: {
  total: number;
  hasExisting: boolean;
}) {
  const { drafts, reset } = usePiketDraft();
  const create = useCreateSubmission();
  const { data } = usePiketToday();

  const allComplete = total > 0 && Object.values(drafts).filter(isDraftComplete).length === total;
  const loading = Object.values(drafts).some((d) => d.uploading);

  const onSubmit = async () => {
    const jadwal = data?.jadwal;
    if (!jadwal) return;
    const proofs: RuanganProofInput[] = [];
    for (const room of data?.ruangan ?? []) {
      const d = drafts[room.id];
      if (!d) continue;
      proofs.push({
        ruanganId: room.id,
        fotoBeforeUrl: d.fotoBefore ?? '',
        fotoAfterUrl: d.fotoAfter ?? '',
        jenisSelesai: d.jenisSelesai,
      });
    }
    create.mutate(
      { jadwalId: jadwal.id, proofs },
      {
        onSuccess: () => {
          reset();
          Alert.alert('Terkirim', 'Piket berhasil dikirim untuk diverifikasi.');
        },
        onError: (error) =>
          Alert.alert('Gagal', error instanceof Error ? error.message : 'Terjadi kesalahan.'),
      },
    );
  };

  const canSubmit = !hasExisting && !loading && allComplete;

  return (
    <View style={styles.bottom}>
      <RiskBanner all={allComplete} />
      <Pressable
        onPress={() => void onSubmit()}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitBtn,
          !canSubmit && styles.submitBtnDisabled,
          pressed && styles.submitBtnPressed,
        ]}>
        <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
          {hasExisting
            ? 'Sudah dikirim'
            : loading
              ? 'Mengunggah…'
              : create.isPending
                ? 'Mengirim…'
                : 'Submit semua ruangan'}
        </Text>
      </Pressable>
    </View>
  );
}

function RiskBanner({ all }: { all: boolean }) {
  return (
    <View style={[styles.riskBanner, all && styles.riskBannerOk]}>
      <Text style={[styles.riskText, all && styles.riskTextOk]}>
        {all
          ? 'Semua ruangan lengkap · Rp 0'
          : 'Kalau disubmit belum lengkap / ditolak → denda dibebankan'}
      </Text>
    </View>
  );
}

function isComplete(jenis: { id: string }[], draft?: RoomDraft): boolean {
  return (
    draft != null &&
    draft.fotoBefore != null &&
    draft.fotoAfter != null &&
    jenis.length > 0 &&
    draft.jenisSelesai.length > 0
  );
}

function isDraftComplete(draft?: RoomDraft): boolean {
  return (
    draft != null &&
    draft.fotoBefore != null &&
    draft.fotoAfter != null &&
    draft.jenisSelesai.length > 0
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { ...type.section, color: colors.ink },
  dayChipText: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 11,
    color: colors.ink,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  loading: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 8,
    gap: 10,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fontFamilies.display[600], fontSize: 16, color: colors.ink, textAlign: 'center' },
  emptySub: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  body: { gap: 12 },
  scheduleHeader: {
    backgroundColor: colors.pine,
    borderRadius: radius['2xl'],
    padding: 16,
    gap: 2,
  },
  scheduleKicker: { ...type.kicker, color: colors.paper },
  scheduleName: { fontFamily: fontFamilies.display[600], fontSize: 18, color: colors.paper },
  scheduleDate: { fontFamily: fontFamilies.mono[500], fontSize: 12, color: colors.paper60 },
  roomCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 12,
  },
  roomCardDone: { borderColor: colors.pineDeep },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roomBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomBadgeText: { fontFamily: fontFamilies.mono[700], fontSize: 12, color: colors.paper },
  roomName: { fontFamily: fontFamilies.body[600], fontSize: 15, color: colors.ink },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoSlot: {
    flex: 1,
    height: 84,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineDash,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoSlotFilled: { borderStyle: 'solid', borderColor: colors.pineSoft, backgroundColor: colors.pineSoft },
  photoIconRow: { alignItems: 'center', justifyContent: 'center' },
  photoLabel: { fontFamily: fontFamilies.body[500], fontSize: 10.5, color: colors.inkSoft },
  photoLabelFilled: { color: colors.pineDeep },
  checklistTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checklistTitle: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.ink },
  checklistHint: { fontFamily: fontFamilies.body[400], fontSize: 10, color: colors.inkMuted },
  checklist: { gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.pine, borderColor: colors.pine },
  checkLabel: { fontFamily: fontFamilies.body[400], fontSize: 13, color: colors.ink },
  checkLabelActive: { fontFamily: fontFamilies.body[600], color: colors.pineDeep },
  bottom: { gap: 10, marginTop: 2 },
  riskBanner: {
    backgroundColor: colors.brickSoft,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  riskBannerOk: { backgroundColor: colors.pineSoft },
  riskText: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.brick, textAlign: 'center' },
  riskTextOk: { color: colors.pineDeep },
  submitBtn: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnPressed: { backgroundColor: colors.pineDeep },
  submitBtnDisabled: { backgroundColor: colors.paperDeep },
  submitText: { fontFamily: fontFamilies.body[700], fontSize: 14, color: colors.paper },
  submitTextDisabled: { color: colors.inkMuted },
});