import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { type } from '@/theme/typography';

type ButtonVariant = 'primary' | 'forest' | 'outline' | 'link';

interface SerumahButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

/**
 * Button primitives per `ui-tokens.md`:
 * - Primary · Ink: bg ink, fg paper, radius 14, py 15, Inter 600 14. Pressed → pine
 * - Primary · Forest: bg pine, fg paper, radius 11, py 13, Inter 600 12.5. Pressed → pineDeep
 * - Secondary · Outline: transparent, border line, fg ink, radius 11, py 13, Inter 600 12.5
 * - Link: transparent, fg pine, Inter 600 14
 * - Disabled: bg disabledBg / fg disabledFg
 */
export function SerumahButton({
  title,
  variant = 'primary',
  fullWidth = true,
  disabled,
  ...rest
}: SerumahButtonProps) {
  const isDisabled = disabled === true;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'primary' && styles.primary,
        variant === 'forest' && styles.forest,
        variant === 'outline' && styles.outline,
        variant === 'link' && styles.link,
        isDisabled && variant === 'primary' && styles.disabled,
        isDisabled && variant === 'forest' && styles.disabled,
        isDisabled && variant === 'outline' && styles.disabledOutline,
        pressed && !isDisabled && variant === 'primary' && styles.pressedInk,
        pressed && !isDisabled && variant === 'forest' && styles.pressedForest,
        pressed && !isDisabled && variant === 'outline' && styles.pressedOutline,
      ]}
      {...rest}>
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.labelOnDark,
          variant === 'forest' && styles.labelOnDark,
          variant === 'outline' && styles.labelOutline,
          variant === 'link' && styles.labelLink,
          isDisabled && (variant === 'primary' || variant === 'forest') && styles.labelDisabled,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  primary: {
    backgroundColor: colors.ink,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  forest: {
    backgroundColor: colors.pine,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  link: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
  },
  pressedInk: {
    backgroundColor: colors.pine,
  },
  pressedForest: {
    backgroundColor: colors.pineDeep,
  },
  pressedOutline: {
    backgroundColor: colors.paperDeep,
  },
  disabled: {
    backgroundColor: colors.disabledBg,
  },
  disabledOutline: {
    borderColor: colors.lineDash,
  },
  label: {
    ...type.button,
    color: colors.ink,
    textAlign: 'center',
  },
  labelOnDark: {
    color: colors.paper,
  },
  labelOutline: {
    color: colors.ink,
  },
  labelLink: {
    color: colors.pine,
  },
  labelDisabled: {
    color: colors.disabledFg,
  },
});