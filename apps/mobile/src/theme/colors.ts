export const colors = {
  paperCanvas: '#DCD6C8',
  paper: '#EFEAE0',
  card: '#FBF9F4',
  paperDeep: '#E5DFD1',
  paperFaint: '#EFEAE08C',
  line: '#D9D2C0',
  lineDash: '#C3BAA2',
  disabledBg: '#CFC7B4',
  disabledFg: '#7D7768',

  ink: '#1E2A24',
  inkSoft: '#5B6862',
  inkMuted: '#8B8474',

  pine: '#3D6B5C',
  pineDeep: '#2B4E43',
  pineSoft: '#D7E6DF',

  brick: '#B33F3F',
  brickDeep: '#8F2F2F',
  brickSoft: '#F1DAD5',

  mustard: '#C9A227',
  mustardSoft: '#F4E9C8',
  mustardBorder: '#E4D3A0',
  mustardInk: '#7D6C1F',
  mustardText: '#6B6135',
  mustardInkStrong: '#241F08',
  olive: '#9A8A3A',

  splashGreen: '#3F6F61',
  frameRing: '#43514A',
  logoDoor: '#27463D',
  logoRoofMuted: '#B7C4BE',
  logoRoof: '#FFFFFF',
  goldCheck: '#F0B529',
  textureA: '#DDD6C6',
  textureB: '#E7E1D2',

  white: '#FFFFFF',
} as const;

export type SerumahColor = keyof typeof colors;

export const borderColors: Record<'ok' | 'danger' | 'pending', string> = {
  ok: colors.pine,
  danger: colors.brick,
  pending: colors.olive,
} as const;