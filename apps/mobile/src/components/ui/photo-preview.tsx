import { Image as ExpoImage } from 'expo-image';
import { X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { mediaSource } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { usePreviewStore } from '@/stores/preview-store';
import { colors } from '@/theme/colors';

/**
 * Preview gambar full-screen di atas layar (bukti transfer, foto piket, dll).
 * Dipanggil via `usePreviewStore.getState().open(url)` atau `previewImage(url)`.
 * Gambar di-fetch lewat endpoint stream (dilindungi JWT) memakai `mediaSource`.
 *
 * Desain mengikuti PhotoPreviewModal di piket: kanvas `ink` solid, tombol X
 * bulat di kanan atas, gambar contain penuh — tanpa elemen lain.
 */
export function PhotoPreview() {
  const url = usePreviewStore((s) => s.url);
  const close = usePreviewStore((s) => s.close);
  const token = useAuthStore((s) => s.token);
  const source = mediaSource(url, token);

  return (
    <Modal visible={url != null} animationType="fade" onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Pressable onPress={close} hitSlop={8} style={styles.closeBtn}>
            <X color={colors.paper} size={22} strokeWidth={2.2} />
          </Pressable>
        </View>
        {source && (
          <ExpoImage
            source={source}
            style={styles.image}
            contentFit="contain"
            transition={150}
          />
        )}
      </View>
    </Modal>
  );
}

/** Helper ringkas untuk membuka preview dari mana saja. */
export const previewImage = (url: string) =>
  usePreviewStore.getState().open(url);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  topBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251, 249, 244, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    flex: 1,
    width: '100%',
  },
});