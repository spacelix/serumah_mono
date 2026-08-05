import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/colors';

interface SerumahLogoProps {
  size?: number;
  /**
   * `full` — two overlapping roof lines (kebersamaan) + badge, used on splash.
   * `mark` — compact single roof + badge, used in onboarding/login headers.
   */
  variant?: 'full' | 'mark';
  /** Roof stroke color (only used by `mark`). Defaults to white. */
  roofColor?: string;
}

/**
 * Serumah logo mark. Mirrors the SVGs in `context/designs/Serumah.html`:
 * - splash: two roof lines (muted then white, stroke 18) + door + gold badge (stroke 8)
 * - onboarding/login headers: single roof (stroke 26) + door + gold badge (stroke 16/14)
 */
export function SerumahLogo({ size = 118, variant = 'full', roofColor = colors.logoRoof }: SerumahLogoProps) {
  const badge = variant === 'full' ? 8 : 16;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
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
        <Rect x="210" y="245" width="92" height="76" rx="12" fill={colors.logoDoor} />
        <Circle
          cx="350"
          cy="285"
          r="34"
          fill={colors.splashGreen}
          stroke={colors.goldCheck}
          strokeWidth={badge}
        />
        <Path
          d="M335 285L346 296L366 275"
          stroke={colors.goldCheck}
          strokeWidth={badge}
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