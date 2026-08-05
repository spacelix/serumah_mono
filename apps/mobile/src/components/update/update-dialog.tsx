import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { downloadUpdate, installApk, type UpdateManifest } from '@/lib/update';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { radius } from '@/theme/radius';

interface UpdateDialogProps {
  visible: boolean;
  manual?: boolean;
  force?: boolean;
  manifest: UpdateManifest;
  onDismiss: () => void;
}

export function UpdateDialog({ visible, manual = false, force = false, manifest, onDismiss }: UpdateDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    setProgress(0);
    try {
      const file = await downloadUpdate(manifest.apkUrl, (written, total) => {
        if (total > 0) setProgress(Math.round((written / total) * 100));
      });
      await installApk(file);
    } catch {
      setError('Gagal mengunduh pembaruan. Coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={force ? undefined : onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            {force && (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>WAJIB</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles.title}>
            Update tersedia
          </ThemedText>
          <ThemedText style={styles.body}>
            {force
              ? 'Versi sebelumnya tidak lagi didukung. Silakan perbaharui untuk melanjutkan.'
              : `Versi baru tersedia. Perbaharui untuk fitur terbaru dan perbaikan.`}
          </ThemedText>
          {manifest.versionName.length > 0 && (
            <ThemedText style={styles.meta}>v{manifest.versionName}</ThemedText>
          )}
          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <View style={styles.buttons}>
            {!force && (
              <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onDismiss}>
                <ThemedText style={styles.buttonSecondaryText}>Nanti saja</ThemedText>
              </Pressable>
            )}
            <Pressable
              style={[styles.button, styles.buttonPrimary, downloading && styles.buttonDisabled]}
              onPress={handleUpdate}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <ThemedText style={styles.buttonPrimaryText}>Update Sekarang</ThemedText>
              )}
            </Pressable>
          </View>

          {downloading && (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <ThemedText style={styles.progressLabel}>{progress}%</ThemedText>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 26, 23, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
    minHeight: 20,
  },
  badge: {
    backgroundColor: colors.brick,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    color: colors.white,
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    fontFamily: fonts.display,
    fontWeight: '600',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
    fontFamily: fonts.body,
  },
  meta: {
    marginTop: 12,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkMuted,
  },
  error: {
    marginTop: 10,
    color: colors.brick,
    fontSize: 13,
    fontFamily: fonts.body,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  buttonPrimary: {
    backgroundColor: colors.ink,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonPrimaryText: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  progressWrap: {
    marginTop: 16,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.pine,
    borderRadius: radius.pill,
  },
  progressLabel: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
  },
});