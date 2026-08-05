import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/colors';

interface SerumahLogoProps {
  size?: number;
}

/**
 * Serumah logo mark — two overlapping roof lines (kebersamaan) + door + gold
 * badge. Mirrors the SVG in `context/designs/Serumah.html` exactly.
 */
export function SerumahLogo({ size = 118 }: SerumahLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <Path
          d="M150 270L256 170L362 270"
          stroke={colors.logoRoofMuted}
          strokeWidth={18}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M150 245L256 145L362 245"
          stroke={colors.logoRoof}
          strokeWidth={18}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect x="210" y="245" width="92" height="76" rx="12" fill={colors.logoDoor} />
        <Circle cx="350" cy="285" r="34" fill={colors.splashGreen} stroke={colors.goldCheck} strokeWidth={8} />
        <Path
          d="M335 285L346 296L366 275"
          stroke={colors.goldCheck}
          strokeWidth={8}
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