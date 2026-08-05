import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';


import { downloadUpdate, installApk, type UpdateManifest } from '@/lib/update';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
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
                <Text style={styles.badgeText}>WAJIB</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>
            Update tersedia
          </Text>
          <Text style={styles.body}>
            {force
              ? 'Versi sebelumnya tidak lagi didukung. Silakan perbaharui untuk melanjutkan.'
              : `Versi baru tersedia. Perbaharui untuk fitur terbaru dan perbaikan.`}
          </Text>
          {manifest.versionName.length > 0 && (
            <Text style={styles.meta}>v{manifest.versionName}</Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttons}>
            {!force && (
              <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onDismiss}>
                <Text style={styles.buttonSecondaryText}>Nanti saja</Text>
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
                <Text style={styles.buttonPrimaryText}>Update Sekarang</Text>
              )}
            </Pressable>
          </View>

          {downloading && (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressLabel}>{progress}%</Text>
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
    fontFamily: fontFamilies.mono[700],
    fontSize: 9,
    letterSpacing: 0.1,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    fontFamily: fontFamilies.display[600],
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
    fontFamily: fontFamilies.body[400],
  },
  meta: {
    marginTop: 12,
    fontFamily: fontFamilies.mono[500],
    fontSize: 12,
    color: colors.inkMuted,
  },
  error: {
    marginTop: 10,
    color: colors.brick,
    fontSize: 13,
    fontFamily: fontFamilies.body[400],
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
    color: colors.paper,
    fontFamily: fontFamilies.body[600],
    fontSize: 13,
  },
  buttonSecondaryText: {
    color: colors.ink,
    fontFamily: fontFamilies.body[600],
    fontSize: 13,
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
    fontFamily: fontFamilies.mono[500],
    fontSize: 11,
    color: colors.inkSoft,
  },
});