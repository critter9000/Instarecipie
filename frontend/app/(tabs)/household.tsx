import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Icon from "@react-native-vector-icons/feather";

import { useHousehold } from "@/src/api";
import Mascot from "@/src/components/Mascot";
import { useToast } from "@/src/components/Toast";
import { useHouseholdCtx } from "@/src/household-context";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function HouseholdScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { householdId, memberId, clear } = useHouseholdCtx();
  const { data: household, isLoading } = useHousehold(householdId ?? undefined);

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const copyCode = async () => {
    if (!household) return;
    await Clipboard.setStringAsync(household.code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast("Kitchen code copied!", "success");
  };

  const shareCode = async () => {
    if (!household) return;
    await Share.share({
      message: `Join my kitchen on All My Meals! Use code ${household.code} to share our recipes, meal plan & grocery list. 🥦`,
    });
  };

  const leave = async () => {
    await clear();
    router.replace("/onboarding");
  };

  if (isLoading || !household) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR KITCHEN</Text>
        <Text style={styles.title}>{household.name}</Text>
      </View>

      <View style={[styles.body, { paddingBottom: bottomChrome + spacing["2xl"] }]}>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>SHARE THIS CODE</Text>
          <Text style={styles.code} testID="kitchen-code">{household.code}</Text>
          <Text style={styles.codeHint}>
            Household members who enter this code share the same recipes, meal plan and grocery list.
          </Text>
          <View style={styles.codeActions}>
            <Pressable testID="copy-code-btn" onPress={copyCode} style={[styles.codeBtn, styles.codeBtnSecondary]}>
              <Icon name="copy" size={18} color={colors.onBrandSecondary} />
              <Text style={[styles.codeBtnText, { color: colors.onBrandSecondary }]}>Copy</Text>
            </Pressable>
            <Pressable testID="share-code-btn" onPress={shareCode} style={[styles.codeBtn, styles.codeBtnPrimary]}>
              <Icon name="share-2" size={18} color={colors.onBrandPrimary} />
              <Text style={[styles.codeBtnText, { color: colors.onBrandPrimary }]}>Share</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>MEMBERS ({household.members.length})</Text>
        <View style={styles.membersCard}>
          {household.members.map((m, idx) => (
            <View
              key={m.id}
              style={[styles.memberRow, idx > 0 && styles.memberBorder]}
            >
              <View style={[styles.avatar, { backgroundColor: m.color }]}>
                <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.memberName}>{m.name}</Text>
              {m.id === memberId && (
                <View style={styles.youBadge}>
                  <Text style={styles.youText}>You</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <Pressable testID="leave-kitchen-btn" onPress={leave} style={styles.leaveBtn}>
          <Icon name="log-out" size={18} color={colors.onError} />
          <Text style={styles.leaveText}>Leave this kitchen</Text>
        </Pressable>

        <View style={styles.mascotFooter}>
          <Mascot size={90} />
          <Text style={styles.footerText}>All My Meals — happy cooking!</Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  eyebrow: { fontFamily: fonts.text.semibold, fontSize: 11, letterSpacing: 1.5, color: colors.brandPrimary },
  title: { fontFamily: fonts.display.bold, fontSize: 30, color: colors.onSurface },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  codeCard: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  codeLabel: { fontFamily: fonts.text.semibold, fontSize: 11, letterSpacing: 1.5, color: colors.onBrandTertiary },
  code: {
    fontFamily: fonts.display.bold,
    fontSize: 42,
    letterSpacing: 8,
    color: colors.brandPrimary,
  },
  codeHint: {
    fontFamily: fonts.text.regular,
    fontSize: 13,
    color: colors.onBrandTertiary,
    textAlign: "center",
    lineHeight: 19,
  },
  codeActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignSelf: "stretch" },
  codeBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  codeBtnPrimary: { backgroundColor: colors.brandPrimary },
  codeBtnSecondary: { backgroundColor: colors.brandSecondary },
  codeBtnText: { fontFamily: fonts.text.semibold, fontSize: 15 },
  sectionTitle: {
    fontFamily: fonts.text.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  membersCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  memberBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.text.bold, fontSize: 16, color: "#FFFFFF" },
  memberName: { flex: 1, fontFamily: fonts.text.semibold, fontSize: 16, color: colors.onSurface },
  youBadge: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  youText: { fontFamily: fonts.text.semibold, fontSize: 12, color: colors.onSurfaceTertiary },
  leaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: radius.md,
    height: 50,
    marginTop: spacing.sm,
  },
  leaveText: { fontFamily: fonts.text.semibold, fontSize: 15, color: colors.onError },
  mascotFooter: { alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  footerText: { fontFamily: fonts.text.medium, fontSize: 13, color: colors.muted },
}));
