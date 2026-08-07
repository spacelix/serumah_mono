import Svg, { Path } from 'react-native-svg';

export type TabIconName = 'beranda' | 'piket' | 'tagihan' | 'swap';

const PATHS: Record<TabIconName, string> = {
  beranda:
    'M4 6.5a2 2 0 012-2h12a2 2 0 012 2V19a2 2 0 01-2 2H6a2 2 0 01-2-2V6.5zM4 10h16M8.5 3v3M15.5 3v3',
  piket:
    'M9 4.5H6a2 2 0 00-2 2V19a2 2 0 002 2h12a2 2 0 002-2V6.5a2 2 0 00-2-2h-3M9 4.5a1.5 1.5 0 013 0M9 4.5h6M8.5 13l2.5 2.5 4.5-5',
  tagihan: 'M5 3.5l14 0v17l-3.5-2-3.5 2-3.5-2L5 20.5v-17zM9 9h6M9 13.5h4',
  swap: 'M4 8.5h13l-3.5-3.5M20 15.5H7l3.5 3.5',
};

interface TabIconProps {
  name: TabIconName;
  size?: number;
  color: string;
}

/** Ikon tab bottom bar — path SVG persis dari Serumah.html. */
export function TabIcon({ name, size = 21, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={PATHS[name]}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
