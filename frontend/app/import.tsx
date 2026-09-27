import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Icon from "@react-native-vector-icons/feather";

import { useImportRecipe } from "@/src/api";
import Button from "@/src/components/Button";
import Mascot from "@/src/components/Mascot";
import { useToast } from "@/src/components/Toast";
import { useHouseholdCtx } from "@/src/household-context";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SOURCES = [
  { icon: "instagram", label: "Instagram" },
  { icon: "video", label: "TikTok" },
  { icon: "youtube", label: "YouTube" },
  { icon: "globe", label: "Any website" },
];

export default function ImportScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { householdId, memberId } = useHouseholdCtx();
  const importRecipe = useImportRecipe(householdId ?? undefined);

  const [source, setSource] = useState("");

  const handleImport = async () => {
    if (source.trim().length < 4) {
      toast("Paste a link or recipe text first", "error");
      return;
    }
    try {
      const recipe = await importRecipe.mutateAsync({
        source: source.trim(),
        member_id: memberId ?? undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast("Recipe saved to your cookbook!", "success");
      router.replace(`/recipe/${recipe.id}`);
    } catch (e: any) {
      toast(e.message || "Import failed", "error");
    }
  };

  if (importRecipe.isPending) {
    return (
      <View style={[styles.container, styles.loadingWrap, { paddingTop: insets.top }]}>
        <Mascot size={170} message="Reading the recipe and sorting everything out… this takes a few seconds 🍳" />
        <Text style={styles.loadingHint}>Extracting ingredients, steps & nutrition</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Import a recipe</Text>
        <Pressable testID="import-close" onPress={() => router.back()} style={styles.closeBtn}>
          <Icon name="x" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Paste a link from social media or a website — or paste the recipe text itself.
        </Text>

        <View style={styles.inputWrap}>
          <TextInput
            testID="import-source-input"
            value={source}
            onChangeText={setSource}
            placeholder="https://…  or paste recipe text"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.sources}>
          {SOURCES.map((s) => (
            <View key={s.label} style={styles.sourceChip}>
              <Icon name={s.icon as any} size={16} color={colors.onSurfaceTertiary} />
              <Text style={styles.sourceText}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoCard}>
          <Icon name="zap" size={18} color={colors.onBrandTertiary} />
          <Text style={styles.infoText}>
            Foreign recipes are translated to English and nutrition is calculated automatically.
          </Text>
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          label="Import recipe"
          icon="download"
          onPress={handleImport}
          testID="import-submit"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  loadingWrap: { alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl },
  loadingHint: {
    fontFamily: fonts.text.medium,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontFamily: fonts.display.bold, fontSize: 24, color: colors.onSurface },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  subtitle: {
    fontFamily: fonts.text.regular,
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
  },
  inputWrap: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  input: {
    minHeight: 110,
    fontFamily: fonts.text.medium,
    fontSize: 15,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
  sources: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sourceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sourceText: { fontFamily: fonts.text.medium, fontSize: 13, color: colors.onSurfaceTertiary },
  infoCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.text.medium,
    fontSize: 13,
    color: colors.onBrandTertiary,
    lineHeight: 19,
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
}));
