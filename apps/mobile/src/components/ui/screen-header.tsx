import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/features/profile/api/profile';
import { mediaSource } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

/**
 * Screen header: mono kicker (rumah) + Space Grotesk H1 title on the left,
 * avatar chip (→ /profile) on the right. Sub-screens pass `onBack` to render
 * a back button row BELOW the header (with optional `backLabel`).
 */
export function ScreenHeader({
  title,
  kicker,
  onBack,
  backLabel = 'Kembali',
  right,
  showAvatar = true,
}: {
  title: string;
  kicker?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  showAvatar?: boolean;
}) {
  const { data } = useProfile();
  const rumahNama = data?.rumah?.nama ?? null;
  const nama = data?.anggota?.nama ?? null;

  const resolvedKicker =
    kicker ??
    (onBack
      ? 'Serumah'
      : rumahNama
        ? `Papan piket · ${rumahNama}`
        : 'Papan piket');

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.textCol}>
          <Text style={styles.kicker} numberOfLines={1}>
            {resolvedKicker}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right ?? (showAvatar ? <AvatarChip nama={nama} fotoProfil={data?.anggota?.fotoProfil ?? null} /> : null)}
      </View>
      {onBack != null && (
        <Pressable onPress={onBack} style={styles.backRow} hitSlop={6}>
          <ArrowLeft color={colors.inkSoft} size={15} strokeWidth={2.4} />
          <Text style={styles.backLabel}>{backLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function AvatarChip({
  nama,
  fotoProfil,
}: {
  nama?: string | null;
  fotoProfil?: string | null;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const source = mediaSource(fotoProfil, token);
  return (
    <Pressable onPress={() => router.push('/profile')} style={styles.avatarChip}>
      <View style={styles.avatarCircle}>
        {source ? (
          <ExpoImage source={source} style={styles.avatarImage} contentFit="cover" />
        ) : (
          <Text style={styles.avatarInitial}>{nama?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        )}
      </View>
      <Text style={styles.avatarName} numberOfLines={1}>
        {nama ?? 'Kamu'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 2,
    paddingBottom: 6,
  },
  backLabel: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.inkSoft },
  textCol: { flexDirection: 'column', gap: 3, flexShrink: 1 },
  kicker: { ...type.kicker, color: colors.inkSoft },
  title: { ...type.display, color: colors.ink },
  avatarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['3xl'],
    paddingVertical: 5,
    paddingRight: 9,
    paddingLeft: 5,
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: { fontFamily: fontFamilies.display[600], fontSize: 11, color: colors.paper },
  avatarName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 11.5,
    color: colors.ink,
    maxWidth: 110,
  },
});
