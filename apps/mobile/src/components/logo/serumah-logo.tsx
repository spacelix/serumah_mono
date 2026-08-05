import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/colors';

interface SerumahLogoProps {
  size?: number;
  /**
   * `full` — two overlapping roof lines (kebersamaan), used on splash.
   * `mark` — compact single roof, used in onboarding/login headers.
   */
  variant?: 'full' | 'mark';
  /** Roof stroke color (only used by `mark`). Defaults to white. */
  roofColor?: string;
}

/**
 * Serumah logo mark. Mirrors the SVGs in `context/designs/Serumah.html`:
 * - splash: two roof lines (muted then white, stroke 18)
 * - onboarding/login headers: single roof (stroke 26)
 * Door and badge/check are intentionally omitted from every logo mark.
 */
export function SerumahLogo({ size = 118, variant = 'full', roofColor = colors.logoRoof }: SerumahLogoProps) {
  const viewBox = variant === 'full' ? '0 102 512 211' : '0 115 512 160';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={viewBox} fill="none">
        {variant === 'full' && (
          <Path
            d="M150 270L256 170L362 270"
            stroke={colors.logoRoofMuted}
            strokeWidth={18}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <Path
          d="M150 245L256 145L362 245"
          stroke={roofColor}
          strokeWidth={variant === 'full' ? 18 : 26}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});