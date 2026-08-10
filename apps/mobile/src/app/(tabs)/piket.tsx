import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Bell, Camera, Check, ChevronDown, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  useApproveSubmission,
  useCreateSubmission,
  usePiketToday,
  useRejectSubmission,
  useSubmissions,
  type RuanganProofInput,
  type SubmissionItem,
} from '@/features/piket/api/piket';
import { formatCurrency, formatWeekdayDate } from '@/lib/format';
import { mediaSource } from '@/lib/api-client';
import { ensureCameraPermission } from '@/lib/media-permissions';
import { toast } from '@/stores/toast-store';
import { useAuthStore } from '@/stores/auth-store';
import { usePiketDraft, type RoomDraft } from '@/stores/piket-draft-store';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

type PiketView = 'mine' | 'verifikasi';

interface InfoDialogState {
  title: string;
  message: string;
}

/** Single-action info dialog (custom, replaces Alert). */
function useInfoDialog() {
  const [dialog, setDialog] = useState<InfoDialogState | null>(null);
  const show = (title: string, message: string) =>
    setDialog({ title, message });
  const close = () => setDialog(null);

  const element = dialog ? (
    <ConfirmDialog
      visible
      title={dialog.title}
      message={dialog.message}
      confirmText="Tutup"
      single
      onConfirm={close}
      onCancel={close}
    />
  ) : null;

  return { show, element };
}

export default function PiketScreen() {
  const { data, isLoading } = usePiketToday();
  const { drafts } = usePiketDraft();
  const [view, setView] = useState<PiketView>('mine');

  const kicker = data?.jadwal
    ? `${formatWeekdayDate(data.jadwal.tanggal)} · deadline 20:00`
    : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Piket" kicker={kicker} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.segmented}>
          <Pressable
            onPress={() => setView('mine')}
            style={[styles.segment, view === 'mine' && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                view === 'mine' && styles.segmentTextActive,
              ]}
            >
              Piket gw
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setView('verifikasi')}
            style={[
              styles.segment,
              view === 'verifikasi' && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                view === 'verifikasi' && styles.segmentTextActive,
              ]}
            >
              Verifikasi
            </Text>
          </Pressable>
        </View>

        {view === 'verifikasi' ? (
          <VerifikasiView />
        ) : isLoading || data == null ? (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Memuat…</Text>
          </View>
        ) : data.jadwal == null ? (
          <EmptyState
            icon={<X color={colors.inkSoft} size={22} strokeWidth={2} />}
            title="Hari ini bukan giliran piket"
            sub="Piket hanya dijadwalkan pada hari piket sesuai Papan Piket."
          />
        ) : !data.jadwal.isMine ? (
          <EmptyState
            icon={<X color={colors.inkSoft} size={22} strokeWidth={2} />}
            title={`Hari ini giliran ${data.jadwal.anggota.nama}`}
            sub="Giliran lo di hari piket lain. Piket hari ini dipegang anggota lain."
          />
        ) : (
          <View style={styles.body}>
            {data.existingSubmission != null && (
              <SubmissionSuccessCard
                reviewerName={data.existingSubmission.reviewerName}
              />
            )}
            <View style={styles.roomsHeader}>
              <Text style={styles.roomsHeaderTitle}>Semua ruangan</Text>
              <Text style={styles.roomsHeaderProgress}>
                {roomsDone(data.ruangan, drafts, data.jenisByRuangan)}/
                {data.ruangan.length} ruangan beres
              </Text>
            </View>
            {data.ruangan.map((room, index) => (
              <RuanganPiketCard
                key={room.id}
                index={index}
                roomId={room.id}
                nama={room.nama}
                jenis={data.jenisByRuangan[room.id] ?? []}
                submittedProof={data.existingSubmission?.proofs.find(
                  (p) => p.ruanganId === room.id,
                )}
              />
            ))}
            <BottomBar
              totalJenis={data.totalJenis}
              hasExisting={data.existingSubmission != null}
              nominalDenda={data.nominalDenda}
              ruangan={data.ruangan}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function VerifikasiView() {
  const pending = useSubmissions('pending');
  const resolved = useSubmissions('resolved');
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();
  const info = useInfoDialog();
  const [detail, setDetail] = useState<SubmissionItem | null>(null);

  const doApprove = (id: string) => approve.mutate(id);
  const doReject = (id: string) => {
    reject.mutate(id, {
      onError: (error) =>
        info.show(
          'Gagal',
          error instanceof Error ? error.message : 'Terjadi kesalahan.',
        ),
    });
  };

  return (
    <View style={styles.body}>
      {info.element}
      <View style={styles.reviewSectionHeader}>
        <Text style={styles.reviewSectionTitle}>Nunggu diverifikasi</Text>
      </View>
      {pending.data && pending.data.length > 0 ? (
        pending.data.map((s) => (
          <View key={s.id} style={styles.reviewGroup}>
            <SubmissionReviewCard
              submission={s}
              onApprove={doApprove}
              onReject={doReject}
              busy={approve.isPending || reject.isPending}
            />
            <ReviewProofsSection submission={s} />
          </View>
        ))
      ) : (
        <EmptyState
          icon={<Bell color={colors.inkSoft} size={22} strokeWidth={2} />}
          title="Tidak ada yang menunggu diverifikasi"
          sub="Kalau ada piket yang dikirim ke lo buat diverifikasi, bakal muncul di sini."
        />
      )}

      <View
        style={[styles.reviewSectionHeader, styles.reviewSectionHeaderSpaced]}
      >
        <Text style={styles.reviewSectionTitle}>Riwayat</Text>
      </View>
      {resolved.data && resolved.data.length > 0 ? (
        resolved.data.map((s) => (
          <View key={s.id} style={styles.reviewGroup}>
            <SubmissionReviewCard
              submission={s}
              onApprove={doApprove}
              onReject={doReject}
              onPress={() => setDetail(s)}
            />
          </View>
        ))
      ) : (
        <EmptyState
          icon={<Check color={colors.inkSoft} size={22} strokeWidth={2} />}
          title="Belum ada riwayat"
          sub="Riwayat piket yang lo verifikasi bakal tampil di sini."
        />
      )}

      <ReviewSheet submission={detail} onClose={() => setDetail(null)} />
    </View>
  );
}

/** Bottom sheet: proof rooms + denda value for a resolved submission. */
function ReviewSheet({
  submission,
  onClose,
}: {
  submission: SubmissionItem | null;
  onClose: () => void;
}) {
  const approved = submission?.status === 'approved';
  return (
    <Modal
      visible={submission != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetHandle} />
          {submission && (
            <>
              <View style={styles.sheetHead}>
                <View style={styles.reviewHeadText}>
                  <Text style={styles.reviewSubject} numberOfLines={1}>
                    {submission.anggota.nama}
                    {submission.isMine ? ' (lo)' : ''} ·{' '}
                    {formatWeekdayDate(submission.tanggal)}
                  </Text>
                  <Text style={styles.reviewMeta}>
                    {approved
                      ? `Terverifikasi oleh ${submission.reviewerName ?? '—'}`
                      : 'Ditolak'}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={styles.sheetClose}
                >
                  <X color={colors.inkSoft} size={18} strokeWidth={2.4} />
                </Pressable>
              </View>
              <Text style={styles.reviewRooms}>
                {submission.proofs.length} ruangan
              </Text>

              {approved ? (
                submission.dendaApprove > 0 && (
                  <View style={styles.sheetDenda}>
                    <Text style={styles.sheetDendaLabel}>Denda sisa</Text>
                    <Text style={styles.sheetDendaValue}>
                      {formatCurrency(submission.dendaApprove)}
                    </Text>
                  </View>
                )
              ) : (
                <View style={styles.sheetDenda}>
                  <Text style={styles.sheetDendaLabel}>Denda</Text>
                  <Text style={styles.sheetDendaValue}>
                    {formatCurrency(submission.dendaReject)}
                  </Text>
                </View>
              )}

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
              >
                <ReviewProofsSection submission={submission} />
              </ScrollView>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

function SubmissionReviewCard({
  submission,
  onApprove,
  onReject,
  busy,
  onPress,
}: {
  submission: SubmissionItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busy?: boolean;
  onPress?: () => void;
}) {
  const pending = submission.status === 'menunggu';
  const approved = submission.status === 'approved';
  const rejected = submission.status === 'rejected';
  const resolved = approved || rejected;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.reviewCard,
        onPress && pressed && styles.reviewCardPressed,
      ]}
    >
      <View style={styles.reviewHead}>
        <View style={styles.reviewHeadText}>
          <Text style={styles.reviewSubject} numberOfLines={1}>
            {submission.anggota.nama}
            {submission.isMine ? ' (lo)' : ''} ·{' '}
            {formatWeekdayDate(submission.tanggal)}
          </Text>
          {resolved && submission.reviewerName ? (
            <Text style={styles.reviewMeta}>
              Terverifikasi oleh {submission.reviewerName}
            </Text>
          ) : (
            !submission.isMine && (
              <Text style={styles.reviewMeta}>
                Nunggu diverifikasi — siapa pun anggota bisa
              </Text>
            )
          )}
        </View>
        <Text style={styles.reviewRooms}>
          {submission.proofs.length} ruangan
        </Text>
      </View>
      {pending && submission.isMine ? (
        <View style={styles.reviewNoteRow}>
          <Text style={styles.reviewMeta}>
            Nunggu diverifikasi — siapa pun anggota bisa
          </Text>
          <Pressable
            onPress={() =>
              toast.success('Notifikasi telah dikirim ke reviewer.')
            }
            hitSlop={6}
            style={({ pressed }) => [
              styles.reviewBell,
              pressed && styles.reviewBellPressed,
            ]}
          >
            <Bell color={colors.olive} size={15} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}

      {pending && submission.isMyTurn && !submission.isMine && (
        <View style={styles.reviewActions}>
          <Pressable
            onPress={() => onApprove(submission.id)}
            disabled={busy}
            style={[styles.reviewApprove, busy && styles.reviewBtnBusy]}
          >
            <Text style={styles.reviewApproveText}>Approve submission</Text>
          </Pressable>
          <Pressable
            onPress={() => onReject(submission.id)}
            disabled={busy}
            style={[styles.reviewReject, busy && styles.reviewBtnBusy]}
          >
            <Text style={styles.reviewRejectText}>Reject</Text>
          </Pressable>
          <Text style={styles.reviewDendaPreview}>
            {submission.dendaApprove > 0
              ? `Setujui → denda sisa ${formatCurrency(submission.dendaApprove)} · Tolak → denda ${formatCurrency(submission.dendaReject)}`
              : `Tolak → denda ${formatCurrency(submission.dendaReject)}`}
          </Text>
        </View>
      )}

      {pending && !submission.isMyTurn && !submission.isMine && (
        <Text style={styles.reviewOwnNote}>
          Menunggu reviewer yang ditugaskan memverifikasi.
        </Text>
      )}

      {resolved && !onPress && (
        <View
          style={[
            styles.reviewResult,
            approved ? styles.reviewResultOk : styles.reviewResultBad,
          ]}
        >
          <Text
            style={[
              styles.reviewResultText,
              approved ? styles.reviewResultTextOk : styles.reviewResultTextBad,
            ]}
          >
            {approved
              ? `Disetujui${submission.dendaApprove > 0 ? ` · denda sisa ${formatCurrency(submission.dendaApprove)}` : ''}`
              : `Ditolak · denda ${formatCurrency(submission.dendaReject)}`}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** "Bukti per ruangan" — separate cards, rendered below the review card. */
function ReviewProofsSection({ submission }: { submission: SubmissionItem }) {
  return (
    <View style={styles.reviewProofsWrap}>
      <Text style={styles.reviewSectionKicker}>Bukti per ruangan</Text>
      {submission.proofs.map((p) => {
        const done = new Set(p.jenisSelesai);
        return (
          <View key={p.ruanganId} style={styles.reviewProofCard}>
            <View style={styles.reviewProofHead}>
              <Text style={styles.reviewProofName}>{p.ruanganNama}</Text>
              <Text style={styles.reviewProofCount}>
                {p.jenisSelesai.length} jenis tercentang
              </Text>
            </View>
            <View style={styles.reviewProofSlots}>
              <ReviewPhotoSlot label="BEFORE" uri={p.fotoBefore} />
              <ReviewPhotoSlot label="AFTER" uri={p.fotoAfter} />
            </View>
            {p.jenisList.length > 0 && (
              <View style={styles.reviewChips}>
                {p.jenisList.map((name) => {
                  const checked = done.has(name);
                  return (
                    <View
                      key={name}
                      style={[
                        styles.reviewChip,
                        checked
                          ? styles.reviewChipDone
                          : styles.reviewChipMissed,
                      ]}
                    >
                      {checked ? (
                        <Check color={colors.pine} size={10} strokeWidth={3} />
                      ) : (
                        <X color={colors.brick} size={10} strokeWidth={3} />
                      )}
                      <Text
                        style={[
                          styles.reviewChipText,
                          !checked && styles.reviewChipTextMissed,
                        ]}
                      >
                        {name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** BEFORE/AFTER photo slot in the review card — texture when no photo. */
function ReviewPhotoSlot({
  label,
  uri,
}: {
  label: string;
  uri: string | null;
}) {
  const token = useAuthStore((s) => s.token);
  const source = mediaSource(uri, token);
  return (
    <View style={styles.reviewPhotoCol}>
      <Text style={styles.reviewPhotoLabel}>{label}</Text>
      <View style={styles.reviewPhotoBox}>
        {source ? (
          <Image
            source={source}
            style={styles.reviewPhotoImage}
            contentFit="cover"
          />
        ) : (
          <PhotoEmptyStripes />
        )}
      </View>
    </View>
  );
}

function RuanganPiketCard({
  index,
  roomId,
  nama,
  jenis,
  submittedProof,
}: {
  index: number;
  roomId: string;
  nama: string;
  jenis: { id: string; nama: string }[];
  submittedProof?: {
    fotoBefore: string | null;
    fotoAfter: string | null;
    jenisSelesai: string[];
  };
}) {
  const { drafts, setPhoto, clearPhoto, toggleJenis } = usePiketDraft();
  const draft = drafts[roomId];
  const readOnly = submittedProof != null;
  const checkedCount = readOnly
    ? submittedProof.jenisSelesai.length
    : (draft?.jenisSelesai.length ?? 0);
  const complete = readOnly
    ? submittedProof.fotoBefore != null &&
      submittedProof.fotoAfter != null &&
      submittedProof.jenisSelesai.length > 0
    : isComplete(jenis, draft);
  const bad = readOnly && !complete;
  const [expanded, setExpanded] = useState(false);
  const [previewSlot, setPreviewSlot] = useState<'before' | 'after' | null>(
    null,
  );
  const fade = useAnimatedValue(1);
  const info = useInfoDialog();
  const wasComplete = useRef(false);

  // Auto-collapse once the room becomes complete (design: done rooms collapse).
  useEffect(() => {
    if (complete && !wasComplete.current) {
      wasComplete.current = true;
      setExpanded(false);
    }
  }, [complete]);

  const changePhoto = (slot: 'before' | 'after') => {
    setPreviewSlot(null);
    if (readOnly) return;
    void pickPhoto(roomId, slot, setPhoto).then((ok) => {
      if (!ok) {
        info.show(
          'Izin kamera',
          'Izinkan akses kamera untuk memotret bukti piket.',
        );
      }
    });
  };

  const toggle = () => {
    if (expanded) {
      // Fade-out then collapse.
      Animated.timing(fade, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(false);
      });
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(true);
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <View style={styles.roomCard}>
      <Pressable onPress={toggle} style={styles.roomTitleRow}>
        <View
          style={[
            styles.roomBadge,
            complete && styles.roomBadgeDone,
            bad && styles.roomBadgeBad,
          ]}
        >
          <Text
            style={[
              styles.roomBadgeText,
              (complete || bad) && styles.roomBadgeTextDone,
            ]}
          >
            {String(index + 1).padStart(2, '0')}
          </Text>
        </View>
        <Text style={styles.roomName} numberOfLines={1}>
          {nama}
        </Text>
        <Text style={styles.roomProgress}>
          {checkedCount}/{jenis.length}
        </Text>
        {complete ? (
          <View style={styles.roomCheck}>
            <Check color={colors.paper} size={10} strokeWidth={3} />
          </View>
        ) : bad ? (
          <View style={styles.roomCheckBad}>
            <X color={colors.paper} size={11} strokeWidth={3} />
          </View>
        ) : (
          <ChevronDown
            color={colors.inkSoft}
            size={16}
            strokeWidth={2.4}
            style={!expanded && styles.chevronRotated}
          />
        )}
      </Pressable>

      {expanded && (
        <Animated.View style={{ opacity: fade }}>
          <PhotoSection
            label="Foto before"
            uri={
              readOnly ? submittedProof.fotoBefore : (draft?.fotoBefore ?? null)
            }
            onPick={() => changePhoto('before')}
            onPreview={() => setPreviewSlot('before')}
            onClear={() => clearPhoto(roomId, 'before')}
            readOnly={readOnly}
          />

          <View style={styles.checklist}>
            {jenis.map((j) => {
              const checked = readOnly
                ? submittedProof.jenisSelesai.includes(j.id)
                : (draft?.jenisSelesai.includes(j.id) ?? false);
              return (
                <Pressable
                  key={j.id}
                  onPress={() => !readOnly && toggleJenis(roomId, j.id)}
                  style={({ pressed }) => [
                    styles.checkRow,
                    !readOnly && pressed && styles.checkRowPressed,
                  ]}
                >
                  <View
                    style={[styles.checkbox, checked && styles.checkboxActive]}
                  >
                    {checked && (
                      <Check color={colors.paper} size={11} strokeWidth={3} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.checkLabel,
                      checked && styles.checkLabelActive,
                    ]}
                  >
                    {j.nama}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <PhotoSection
            label="Foto after"
            uri={
              readOnly ? submittedProof.fotoAfter : (draft?.fotoAfter ?? null)
            }
            onPick={() => changePhoto('after')}
            onPreview={() => setPreviewSlot('after')}
            onClear={() => clearPhoto(roomId, 'after')}
            readOnly={readOnly}
          />
        </Animated.View>
      )}

      <PhotoPreviewModal
        visible={previewSlot != null}
        uri={
          previewSlot
            ? readOnly
              ? previewSlot === 'before'
                ? submittedProof.fotoBefore
                : submittedProof.fotoAfter
              : (draft?.[`foto${cap(previewSlot)}` as const] ?? null)
            : null
        }
        slot={previewSlot}
        readOnly={readOnly}
        onClose={() => setPreviewSlot(null)}
        onReplace={changePhoto}
      />
      {info.element}
    </View>
  );
}

function cap(s: string): 'Before' | 'After' {
  return s === 'before' ? 'Before' : 'After';
}

function PhotoSection({
  label,
  uri,
  onPick,
  onPreview,
  onClear,
  readOnly = false,
}: {
  label: string;
  uri: string | null;
  onPick: () => void;
  onPreview: () => void;
  onClear: () => void;
  readOnly?: boolean;
}) {
  return (
    <View style={styles.photoSection}>
      <View style={styles.photoLabelRow}>
        <Text style={styles.photoLabel}>{label}</Text>
        <Text style={styles.photoRequired}>
          {uri ? 'terisi' : readOnly ? 'kosong' : 'wajib'}
        </Text>
      </View>
      {readOnly && !uri ? (
        <View style={styles.photoReadonlyEmpty}>
          <PhotoEmptyStripes />
          <Text style={styles.photoReadonlyEmptyText}>
            foto tidak terpasang · karena ga dikerjain
          </Text>
        </View>
      ) : (
        <PhotoSlot
          uri={uri}
          onPick={uri ? onPreview : readOnly ? () => {} : onPick}
          onClear={uri && !readOnly ? onClear : undefined}
        />
      )}
    </View>
  );
}

/** Diagonal texture stripes (textureA/B) for read-only empty photo slots. */
function PhotoEmptyStripes() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      fill="none"
      preserveAspectRatio="none"
    >
      <Defs>
        <Pattern
          id="serumahPhotoStripe"
          patternUnits="userSpaceOnUse"
          width={16}
          height={16}
          patternTransform="rotate(45)"
        >
          <Rect width="8" height="16" fill={colors.textureA} />
          <Rect x="8" width="8" height="16" fill={colors.textureB} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#serumahPhotoStripe)" />
    </Svg>
  );
}

function PhotoPreviewModal({
  visible,
  uri,
  slot,
  readOnly = false,
  onClose,
  onReplace,
}: {
  visible: boolean;
  uri: string | null;
  slot: 'before' | 'after' | null;
  readOnly?: boolean;
  onClose: () => void;
  onReplace: (slot: 'before' | 'after') => void;
}) {
  const token = useAuthStore((s) => s.token);
  const source = mediaSource(uri, token);
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewFull}>
        <View style={styles.previewTopBar}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.previewX}>
            <X color={colors.paper} size={22} strokeWidth={2.2} />
          </Pressable>
        </View>
        {source ? (
          <Image
            source={source}
            style={styles.previewFullImage}
            contentFit="contain"
          />
        ) : (
          <View style={styles.previewFullEmpty}>
            <Text style={styles.previewEmptyText}>Foto belum diambil.</Text>
          </View>
        )}
        {slot && !readOnly && (
          <View style={styles.previewBottomBar}>
            <Pressable
              onPress={() => onReplace(slot)}
              style={styles.previewReplace}
            >
              <Text style={styles.previewReplaceText}>Ganti foto</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

async function pickPhoto(
  roomId: string,
  slot: 'before' | 'after',
  setPhoto: (roomId: string, slot: 'before' | 'after', uri: string) => void,
): Promise<boolean> {
  const ok = await ensureCameraPermission();
  if (!ok) return false;
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.7,
  });
  if (!result.canceled && result.assets[0]) {
    setPhoto(roomId, slot, result.assets[0].uri);
  }
  return true;
}

function PhotoSlot({
  uri,
  onPick,
  onClear,
}: {
  uri: string | null;
  onPick: () => void;
  onClear?: () => void;
}) {
  const token = useAuthStore((s) => s.token);
  const source = mediaSource(uri, token);
  return (
    <Pressable
      onPress={onPick}
      style={[styles.photoSlot, uri && styles.photoSlotFilled]}
    >
      {source ? (
        <>
          <Image
            source={source}
            style={styles.photoPreview}
            contentFit="cover"
          />
          <View style={styles.photoOverlay}>
            <Text style={styles.photoHintLight}>
              ketuk buat preview / ganti
            </Text>
          </View>
          {onClear && (
            <Pressable
              onPress={onClear}
              hitSlop={8}
              style={styles.photoClearBtn}
            >
              <X color={colors.paper} size={14} strokeWidth={2.4} />
            </Pressable>
          )}
        </>
      ) : (
        <View style={styles.photoIconRow}>
          <Camera color={colors.inkSoft} size={15} strokeWidth={1.8} />
          <Text style={styles.photoHint}>+ ambil foto</Text>
        </View>
      )}
    </Pressable>
  );
}

function BottomBar({
  totalJenis,
  hasExisting,
  nominalDenda,
  ruangan,
}: {
  totalJenis: number;
  hasExisting: boolean;
  nominalDenda: number;
  ruangan: { id: string; nama: string }[];
}) {
  const { drafts, reset } = usePiketDraft();
  const create = useCreateSubmission();
  const info = useInfoDialog();
  const { data } = usePiketToday();

  const worked = hasExisting
    ? (data?.existingSubmission?.proofs ?? []).reduce(
        (sum, p) => sum + p.jenisSelesai.length,
        0,
      )
    : Object.values(drafts).reduce(
        (sum, d) => sum + (d?.jenisSelesai.length ?? 0),
        0,
      );
  const unworked = Math.max(totalJenis - worked, 0);
  const remainingDenda =
    totalJenis > 0 ? Math.round((nominalDenda * unworked) / totalJenis) : 0;
  const loading = Object.values(drafts).some((d) => d.uploading);

  const onSubmit = async () => {
    const jadwal = data?.jadwal;
    if (!jadwal) return;

    // UI validation — list exactly which room/item is missing.
    const issues: string[] = [];
    for (const room of ruangan) {
      issues.push(...roomIssues(room.nama, drafts[room.id]));
    }
    if (issues.length > 0) {
      info.show('Belum lengkap', issues.join('\n'));
      return;
    }

    const proofs: RuanganProofInput[] = [];
    for (const room of ruangan) {
      const d = drafts[room.id];
      proofs.push({
        ruanganId: room.id,
        fotoBeforeUrl: d?.fotoBefore ?? null,
        fotoAfterUrl: d?.fotoAfter ?? null,
        jenisSelesai: d?.jenisSelesai ?? [],
      });
    }
    create.mutate(
      { jadwalId: jadwal.id, proofs },
      {
        onSuccess: () => {
          reset();
          info.show('Terkirim', 'Piket berhasil dikirim untuk diverifikasi.');
        },
        onError: (error) =>
          info.show(
            'Gagal',
            error instanceof Error ? error.message : 'Terjadi kesalahan.',
          ),
      },
    );
  };

  const canSubmit = !hasExisting && !loading;
  const allDone = unworked === 0;

  return (
    <View style={styles.bottom}>
      <RiskBanner all={allDone} remainingDenda={remainingDenda} />
      <Pressable
        onPress={() => void onSubmit()}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitBtn,
          !canSubmit && styles.submitBtnDisabled,
          pressed && styles.submitBtnPressed,
        ]}
      >
        <Text
          style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}
        >
          {hasExisting
            ? 'Sudah dikirim'
            : loading
              ? 'Mengunggah…'
              : create.isPending
                ? 'Mengirim…'
                : allDone
                  ? 'Submit semua ruangan'
                  : 'Submit · denda tersisa'}
        </Text>
      </Pressable>
      <Text style={styles.submitNote}>
        Denda dihitung per jenis piket yang nggak dikerjakan (
        {formatCurrency(nominalDenda)} ÷ {totalJenis} item). Yang dicentang
        bebas denda, sisanya jadi tagihan setelah diverifikasi.
      </Text>
      {info.element}
    </View>
  );
}

function RiskBanner({
  all,
  remainingDenda,
}: {
  all: boolean;
  remainingDenda: number;
}) {
  return (
    <View style={[styles.riskBanner, all && styles.riskBannerOk]}>
      <Text style={[styles.riskText, all && styles.riskTextOk]}>
        {all ? 'Semua ruangan lengkap' : 'Denda tersisa'}
      </Text>
      <Text style={[styles.riskAmount, all && styles.riskTextOk]}>
        {formatCurrency(remainingDenda)}
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
    draft.jenisSelesai.length === jenis.length
  );
}

/**
 * Shown after a successful submit (per Serumah.html): title + note on the
 * left, static "MENUNGGU VERIFIKASI" stamp on the right (stampIn animation
 * hanya untuk status approve/reject).
 */
function SubmissionSuccessCard({
  reviewerName,
}: {
  reviewerName: string | null;
}) {
  return (
    <View style={styles.submitSuccessCard}>
      <View style={styles.submitSuccessText}>
        <Text style={styles.submitSuccessTitle}>Submission terkirim</Text>
        <Text style={styles.submitSuccessNote}>
          {reviewerName
            ? `Nunggu ${reviewerName} verifikasi bukti before/after tiap ruangan.`
            : 'Nunggu verifikasi bukti before/after tiap ruangan.'}
        </Text>
      </View>
      <View style={styles.submitStamp}>
        <Text style={styles.submitStampText}>MENUNGGU VERIFIKASI</Text>
      </View>
    </View>
  );
}

/** Human-readable per-room problems (empty = room is submit-ready). */
function roomIssues(nama: string, draft?: RoomDraft): string[] {
  if (draft == null) return [];
  const hasActivity =
    draft.jenisSelesai.length > 0 ||
    draft.fotoBefore != null ||
    draft.fotoAfter != null;
  if (!hasActivity) return [];

  const issues: string[] = [];
  if (draft.fotoBefore == null) issues.push(`${nama}: foto sebelum belum ada`);
  if (draft.fotoAfter == null) issues.push(`${nama}: foto sesudah belum ada`);
  if (draft.jenisSelesai.length === 0)
    issues.push(`${nama}: pilih minimal satu jenis piket`);
  return issues;
}

function roomsDone(
  rooms: { id: string }[],
  drafts: Record<string, RoomDraft | undefined>,
  jenisByRuangan: Record<string, { id: string }[]>,
): number {
  return rooms.filter((room) =>
    isComplete(jenisByRuangan[room.id] ?? [], drafts[room.id]),
  ).length;
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
  segmented: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.paperDeep,
    borderRadius: 13,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12,
    color: colors.inkSoft,
  },
  segmentTextActive: { color: colors.paper },
  reviewSectionHeader: {
    paddingHorizontal: 2,
    marginTop: 2,
  },
  reviewSectionHeaderSpaced: { marginTop: 16 },
  reviewSectionTitle: {
    fontFamily: fontFamilies.mono[600],
    fontSize: 11,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  reviewCard: {
    position: 'relative',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 11,
  },
  reviewGroup: { gap: 8 },
  reviewCardPressed: { opacity: 0.8 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 26, 23, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    maxHeight: '85%',
    gap: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 6,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: { flexGrow: 0 },
  sheetScrollContent: { paddingBottom: 0 },
  sheetDenda: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.pineSoft,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  sheetDendaLabel: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12,
    color: colors.pineDeep,
  },
  sheetDendaValue: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 15,
    color: colors.pineDeep,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewHeadText: { flex: 1, gap: 2 },
  reviewSubject: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14,
    color: colors.ink,
    letterSpacing: -0.01,
  },
  reviewMeta: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11,
    color: colors.inkSoft,
  },
  reviewRooms: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10,
    color: colors.inkSoft,
  },
  reviewNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewBell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mustardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBellPressed: { backgroundColor: colors.mustardBorder },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reviewApprove: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.pine,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  reviewApproveText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  reviewReject: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: colors.brick,
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  reviewRejectText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.brick,
  },
  reviewBtnBusy: { opacity: 0.6 },
  reviewDendaPreview: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 11.5,
    color: colors.brick,
  },
  reviewOwnNote: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.inkSoft,
  },
  reviewSectionKicker: {
    fontFamily: fontFamilies.mono[600],
    fontSize: 11,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    paddingHorizontal: 2,
  },
  reviewProofsWrap: { gap: 8 },
  reviewProofCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 13,
    gap: 11,
  },
  reviewProofHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewProofName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13.5,
    color: colors.ink,
  },
  reviewProofCount: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10,
    color: colors.inkSoft,
  },
  reviewProofSlots: { flexDirection: 'row', gap: 8 },
  reviewPhotoCol: { flex: 1, gap: 4 },
  reviewPhotoLabel: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9,
    letterSpacing: 0.12,
    color: colors.inkMuted,
  },
  reviewPhotoBox: {
    height: 68,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.textureA,
    overflow: 'hidden',
  },
  reviewPhotoImage: { width: '100%', height: '100%' },
  reviewChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paperDeep,
    borderRadius: 20,
    paddingVertical: 5,
    paddingRight: 10,
    paddingLeft: 7,
  },
  reviewChipDone: { backgroundColor: colors.paperDeep },
  reviewChipMissed: { backgroundColor: colors.brickSoft },
  reviewChipText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 11,
    color: colors.pineDeep,
  },
  reviewChipTextMissed: {
    color: colors.brickDeep,
    textDecorationLine: 'line-through',
  },
  reviewResult: {
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  reviewResultOk: { backgroundColor: colors.pineSoft },
  reviewResultBad: { backgroundColor: colors.brickSoft },
  reviewResultText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 11.5,
    textAlign: 'center',
  },
  reviewResultTextOk: { color: colors.pineDeep },
  reviewResultTextBad: { color: colors.brickDeep },
  body: { gap: 12 },
  roomCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 12,
  },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roomBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.md,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomBadgeDone: { backgroundColor: colors.pine },
  roomBadgeBad: { backgroundColor: colors.brick },
  roomBadgeText: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 10,
    color: colors.inkSoft,
  },
  roomBadgeTextDone: { color: colors.paper },
  roomCheck: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCheckBad: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.brick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomName: {
    flex: 1,
    fontFamily: fontFamilies.body[600],
    fontSize: 14.5,
    color: colors.ink,
    letterSpacing: -0.01,
  },
  roomProgress: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  roomsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  roomsHeaderTitle: {
    fontFamily: fontFamilies.mono[600],
    fontSize: 11,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  roomsHeaderProgress: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  photoSection: { gap: 6, marginTop: 8 },
  photoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoLabel: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 0.12,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  photoRequired: {
    fontFamily: fontFamilies.body[400],
    fontSize: 10,
    color: colors.inkMuted,
  },
  photoSlot: {
    width: '100%',
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineDash,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    overflow: 'hidden',
  },
  photoSlotFilled: {
    borderStyle: 'solid',
    borderColor: colors.pineSoft,
    backgroundColor: colors.pineSoft,
  },
  photoReadonlyEmpty: {
    width: '100%',
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.textureA,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoReadonlyEmptyText: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 11,
    color: colors.inkSoft,
  },
  photoIconRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  photoHint: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 11,
    color: colors.inkSoft,
  },
  photoPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20, 26, 23, 0.45)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  photoHintLight: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9,
    color: colors.paper,
  },
  photoClearBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(20, 26, 23, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronRotated: { transform: [{ rotate: '-90deg' }] },
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
    ...type.body,
    color: colors.paper60,
  },
  previewBottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  previewReplace: {
    backgroundColor: colors.paper,
    borderRadius: radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
  },
  previewReplaceText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13,
    color: colors.ink,
  },
  checklist: { gap: 1, marginTop: 8 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDeep,
  },
  checkRowPressed: { opacity: 0.7 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.inkSoft,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.pine, borderColor: colors.pine },
  checkLabel: {
    flex: 1,
    fontFamily: fontFamilies.body[500],
    fontSize: 13,
    color: colors.ink,
  },
  checkLabelActive: {
    fontFamily: fontFamilies.body[600],
    color: colors.pineDeep,
    textDecorationLine: 'line-through',
  },
  bottom: { gap: 10, marginTop: 2 },
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.brickSoft,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  riskBannerOk: { backgroundColor: colors.pineSoft },
  riskText: {
    flex: 1,
    fontFamily: fontFamilies.body[500],
    fontSize: 11.5,
    color: colors.brickDeep,
  },
  riskAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 15,
    color: colors.brickDeep,
  },
  riskTextOk: { color: colors.pineDeep },
  submitSuccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 15,
  },
  submitSuccessText: { flex: 1, gap: 4 },
  submitSuccessTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 13.5,
    color: colors.ink,
  },
  submitSuccessNote: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.inkSoft,
  },
  submitStamp: {
    flex: 0,
    alignSelf: 'center',
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: colors.olive,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
    maxWidth: 96,
  },
  submitStampText: {
    fontFamily: fontFamilies.display[700],
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.1,
    textAlign: 'center',
    color: colors.olive,
  },
  submitBtn: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnPressed: { backgroundColor: colors.pineDeep },
  submitBtnDisabled: { backgroundColor: colors.paperDeep },
  submitText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 14,
    letterSpacing: 0.01,
    color: colors.paper,
  },
  submitTextDisabled: { color: colors.inkMuted },
  submitNote: {
    marginHorizontal: 2,
    fontFamily: fontFamilies.body[400],
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.inkSoft,
  },
});
