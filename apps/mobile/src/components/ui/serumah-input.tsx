import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
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
  secureTextEntry,
  ...rest
}: SerumahInputProps) {
  const [show, setShow] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={colors.inkMuted}
          style={[
            styles.input,
            error != null && styles.inputError,
            secureTextEntry && styles.inputSecure,
          ]}
          secureTextEntry={secureTextEntry && !show}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setShow((v) => !v)}
            style={styles.eyeBtn}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={show ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {show ? (
              <EyeOff color={colors.inkSoft} size={18} strokeWidth={1.9} />
            ) : (
              <Eye color={colors.inkSoft} size={18} strokeWidth={1.9} />
            )}
          </Pressable>
        )}
      </View>
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
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
  inputSecure: {
    paddingRight: 44,
  },
  inputError: {
    borderColor: colors.brick,
  },
  eyeBtn: {
    position: 'absolute',
    right: 4,
    width: 36,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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