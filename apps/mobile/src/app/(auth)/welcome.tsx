import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { SerumahLogo } from '@/components/logo/serumah-logo';
import { colors } from '@/theme/colors';
import { fontFamilies, type } from '@/theme/typography';

interface ObStep {
  key: number;
  title: string;
  body: string;
  kicker: string;
  art: 'cal' | 'stamp' | 'money';
}

const OB_STEPS: ObStep[] = [
  {
    key: 0,
    title: 'Jadwal piket yang adil sendiri',
    body: 'Update status weekend, jadwalnya kegenerate otomatis. Yang piket Sabtu–Minggu bebas piket Senin–Jumat.',
    kicker: 'Papan piket digital',
    art: 'cal',
  },
  {
    key: 1,
    title: 'Bolong ya kena denda',
    body: 'Checklist per jenis piket plus foto before/after. Yang nggak dikerjain sampai jam 8 malam langsung jadi tagihan.',
    kicker: 'Bukti, bukan alasan',
    art: 'stamp',
  },
  {
    key: 2,
    title: 'Iuran & galon transparan',
    body: 'Sewa, wifi, listrik, sampai giliran galon dicatat satu tempat. Bayar cash diverifikasi anggota lain.',
    kicker: 'Satu atap, satu catatan',
    art: 'money',
  },
];

/**
 * Welcome screen — Serumah.html onboarding tutorial (3 steps).
 * Matches the prototype: green bg, logo chip + "Serumah" header, step art
 * box, kicker + title + body, dots, "Lewati" skip → login, back/Lanjut, and
 * last step "Mulai · Masuk" → login (email/password, not PIN).
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const stepData = OB_STEPS[step];
  const isLast = step === OB_STEPS.length - 1;
  const isFirst = step === 0;

  const goLogin = () => router.replace('/login');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SerumahLogo size={36} variant="mark" />
          <Text style={styles.brand}>Serumah</Text>
        </View>
        <Pressable onPress={goLogin} style={styles.skipBtn} hitSlop={8}>
          <Text style={styles.skipText}>Lewati</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        <StepArt art={stepData.art} />
        <View style={styles.textBlock}>
          <Text style={styles.kicker}>{stepData.kicker}</Text>
          <Text style={styles.title}>{stepData.title}</Text>
          <Text style={styles.body}>{stepData.body}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.dots}>
          {OB_STEPS.map((s) => (
            <View
              key={s.key}
              style={[styles.dot, s.key === step && styles.dotActive]}
            />
          ))}
        </View>
        <View style={styles.actions}>
          {!isFirst && (
            <Pressable
              onPress={() => setStep((v) => Math.max(0, v - 1))}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && styles.backBtnPressed,
              ]}
            >
              <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 18l-6-6 6-6"
                  stroke={colors.paper}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          )}
          <Pressable
            onPress={() => (isLast ? goLogin() : setStep((v) => v + 1))}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
          >
            <Text style={styles.primaryText}>
              {isLast ? 'Mulai · Masuk' : 'Lanjut'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function StepArt({ art }: { art: ObStep['art'] }) {
  if (art === 'cal') return <CalArt />;
  if (art === 'stamp') return <StampArt />;
  return <MoneyArt />;
}

function CalArt() {
  return (
    <View style={styles.artBox}>
      <View style={styles.calBox}>
        <View style={styles.calRow}>
          <Text style={styles.calName}>Sab · Lo</Text>
          <Text style={styles.calTag}>DI KOS</Text>
        </View>
        <View style={[styles.calRow, styles.calRowDim]}>
          <Text style={styles.calNameDim}>Sen · Dani</Text>
          <Text style={styles.calTagDim}>AUTO</Text>
        </View>
        <View style={[styles.calRow, styles.calRowDim]}>
          <Text style={styles.calNameDim}>Rab · Fajar</Text>
          <Text style={styles.calTagDim}>AUTO</Text>
        </View>
        <View style={[styles.calRow, styles.calRowDash]}>
          <Text style={styles.calNameDash}>Sel · Kam</Text>
          <Text style={styles.calTagDash}>LIBUR</Text>
        </View>
      </View>
    </View>
  );
}

function StampArt() {
  return (
    <View style={styles.artBox}>
      <View style={styles.stampBox}>
        <View style={styles.stampBlocks}>
          <Stripes />
          <Stripes />
        </View>
        <View style={styles.stampBadge}>
          <Text style={styles.stampBadgeText}>MENUNGGU</Text>
        </View>
        <Text style={styles.stampAmount}>−Rp 13.000</Text>
      </View>
    </View>
  );
}

/**
 * Diagonal 45° stripes at { paper28 .. paper14 }, 7px each — replicates the
 * `repeating-linear-gradient(135deg, rgba(paper,.28) 0 7px, rgba(paper,.14) 7px 14px)`
 * from Serumah.html stamp art.
 */
function Stripes() {
  return (
    <View style={styles.stampStripesWrap}>
      <Svg width="100%" height="100%" fill="none" preserveAspectRatio="none">
        <Defs>
          <Pattern
            id="serumahStripe"
            patternUnits="userSpaceOnUse"
            width={9.9}
            height={9.9}
            patternTransform="rotate(45)"
          >
            <Rect width="4.95" height="9.9" fill={colors.paper28} />
            <Rect x="4.95" width="4.95" height="9.9" fill={colors.paper14} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#serumahStripe)" />
      </Svg>
    </View>
  );
}

function MoneyArt() {
  return (
    <View style={styles.artBox}>
      <View style={styles.moneyBox}>
        <View style={styles.moneyRow}>
          <Text style={styles.moneyLabel}>Wifi</Text>
          <Text style={styles.moneyValue}>110rb</Text>
        </View>
        <View style={styles.moneyRow}>
          <Text style={styles.moneyLabel}>Listrik</Text>
          <Text style={styles.moneyValue}>158rb</Text>
        </View>
        <View style={styles.moneyDivider} />
        <View style={styles.galonChip}>
          <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 2.5h6M10 2.5v3l-3 3.5V20a1.5 1.5 0 001.5 1.5h7A1.5 1.5 0 0017 20V9l-3-3.5v-3M7.4 13h9.2"
              stroke={colors.mustard}
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.galonText}>Galon · giliran lo</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.splashGreen,
    paddingTop: 46,
    paddingHorizontal: 26,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brand: {
    fontFamily: fontFamilies.display[700],
    fontSize: 15,
    letterSpacing: -0.15,
    color: colors.paper,
  },
  skipBtn: {
    padding: 4,
  },
  skipText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.paper60,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
  },
  textBlock: {
    alignItems: 'center',
    gap: 9,
  },
  kicker: {
    ...type.kicker,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: colors.paper50,
  },
  title: {
    fontFamily: fontFamilies.display[600],
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.48,
    textAlign: 'center',
    color: colors.paper,
  },
  body: {
    fontFamily: fontFamilies.body[400],
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.paper70,
    maxWidth: 290,
  },
  controls: {
    gap: 15,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 20,
    backgroundColor: colors.paper30,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.paper,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 17,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.paper30,
  },
  backBtnPressed: {
    backgroundColor: colors.paper16,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 13,
    backgroundColor: colors.paper,
  },
  primaryBtnPressed: {
    backgroundColor: colors.paperDeep,
  },
  primaryText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.ink,
  },
  artBox: {
    alignSelf: 'center',
    width: 200,
    height: 186,
    borderRadius: 26,
    backgroundColor: colors.paper09,
    borderWidth: 1,
    borderColor: colors.paper16,
    padding: 20,
    justifyContent: 'center',
  },
  calBox: {
    gap: 7,
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paper,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  calRowDim: {
    backgroundColor: colors.paper16,
  },
  calRowDash: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.paper35,
  },
  calName: {
    fontFamily: fontFamilies.body[600],
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.ink,
  },
  calNameDim: {
    fontFamily: fontFamilies.body[600],
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.paper,
  },
  calNameDash: {
    fontFamily: fontFamilies.body[500],
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.paper65,
  },
  calTag: {
    fontFamily: fontFamilies.mono[600],
    fontSize: 8,
    lineHeight: 12,
    color: colors.pineDeep,
    backgroundColor: colors.pineSoft,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  calTagDim: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 8,
    lineHeight: 12,
    color: colors.paper60,
  },
  calTagDash: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 8,
    lineHeight: 12,
    color: colors.paper50,
  },
  stampBox: {
    alignItems: 'center',
    gap: 13,
  },
  stampBlocks: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  stampStripesWrap: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stampBadge: {
    transform: [{ rotate: '-6deg' }],
    borderWidth: 3,
    borderColor: colors.goldCheck,
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  stampBadgeText: {
    fontFamily: fontFamilies.display[700],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.44,
    color: colors.goldCheck,
  },
  stampAmount: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 15,
    lineHeight: 20,
    color: colors.paper,
  },
  moneyBox: {
    gap: 8,
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  moneyLabel: {
    fontFamily: fontFamilies.body[500],
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.paper60,
  },
  moneyValue: {
    fontFamily: fontFamilies.mono[700],
    fontSize: 12,
    lineHeight: 16,
    color: colors.paper,
  },
  moneyDivider: {
    height: 1,
    backgroundColor: colors.paper16,
    marginVertical: 2,
  },
  galonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.paper,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  galonText: {
    fontFamily: fontFamilies.body[600],
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.ink,
  },
});
