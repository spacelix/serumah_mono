import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamilies, type } from '@/theme/typography';

interface SerumahInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string | null;
}

/**
 * Form field per `Serumah.html` register screen:
 * label = JetBrains Mono 500 10px, .13em, uppercase, inkSoft
 * input = border line 1px, bg card, radius 13, padding 13×14,
 *         Inter 500 13.5px ink, focus border pine
 * error banner = bg brickSoft, Inter 500 11.5, brickDeep
 */
export function SerumahInput({
  label,
  hint,
  error,
  ...rest
}: SerumahInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, error != null && styles.inputError]}
        {...rest}
      />
      {error != null ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint != null ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    ...type.kicker,
    fontSize: 10,
    letterSpacing: 1.3,
    color: colors.inkSoft,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 14,
    color: colors.ink,
    fontFamily: fontFamilies.body[500],
    fontSize: 13.5,
  },
  inputError: {
    borderColor: colors.brick,
  },
  error: {
    fontFamily: fontFamilies.body[500],
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.brickDeep,
  },
  hint: {
    ...type.body,
    color: colors.inkSoft,
  },
});
