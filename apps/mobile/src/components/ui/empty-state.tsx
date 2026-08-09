import { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

interface EmptyStateProps {
  title: string;
  sub?: string;
  /** Custom icon element (lucide etc.) rendered in the circle. */
  icon?: ReactNode;
  /** Optional call-to-action button below the text. */
  action?: { label: string; onPress: () => void } & Pick<
    ComponentProps<typeof Pressable>,
    'disabled'
  >;
}

/**
 * Empty state yang konsisten dengan design system: ikon dalam lingkaran
 * paperDeep, judul display, sub body, dan opsi tombol aksi.
 */
export function EmptyState({ title, sub, icon, action }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {sub != null && sub !== '' && <Text style={styles.sub}>{sub}</Text>}
      {action && (
        <Pressable
          onPress={action.onPress}
          disabled={action.disabled}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
            action.disabled && styles.actionDisabled,
          ]}
        >
          <Text
            style={[
              styles.actionText,
              action.disabled && styles.actionTextDisabled,
            ]}
          >
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    gap: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.display[600],
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
    color: colors.ink,
    textAlign: 'center',
  },
  sub: {
    ...type.body,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 280,
  },
  action: {
    marginTop: 6,
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  actionPressed: { backgroundColor: colors.pineDeep },
  actionDisabled: { backgroundColor: colors.paperDeep },
  actionText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.paper,
  },
  actionTextDisabled: { color: colors.inkMuted },
});
