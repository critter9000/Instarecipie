import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Icon from "@react-native-vector-icons/feather";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import dayjs from "dayjs";

import {
  useAddMeal,
  useDeleteRecipe,
  useGroceryFromRecipe,
  useRecipe,
  useRefreshRecipePhoto,
} from "@/src/api";
import SourcePhoto from "@/src/components/SourcePhoto";
import { useToast } from "@/src/components/Toast";
import { useHouseholdCtx } from "@/src/household-context";
import { scaleQuantity } from "@/src/scale";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { householdId, memberId } = useHouseholdCtx();

  const { data: recipe, isLoading } = useRecipe(id);
  const addGrocery = useGroceryFromRecipe(householdId ?? undefined);
  const addMeal = useAddMeal(householdId ?? undefined);
  const deleteRecipe = useDeleteRecipe(householdId ?? undefined);
  const refreshPhoto = useRefreshRecipePhoto(householdId ?? undefined);

  const [tab, setTab] = useState<"ingredients" | "steps">("ingredients");
  const [servings, setServings] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [selectedMeal, setSelectedMeal] = useState("Dinner");

  const sheetRef = useRef<BottomSheetModal>(null);
  const days = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => dayjs().add(i, "day")),
    [],
  );

  if (isLoading || !recipe) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const totalTime = recipe.prep_time_minutes + recipe.cook_time_minutes;

  const baseServings = Math.max(recipe.servings || 1, 1);
  const currentServings = servings ?? baseServings;
  const factor = currentServings / baseServings;
  const totalCalories = Math.round(recipe.calories * currentServings);

  const handleRefreshPhoto = async () => {
    try {
      await refreshPhoto.mutateAsync(recipe.id);
      toast("Looking for the original photo…", "info");
    } catch (e: any) {
      toast(e.message || "Could not refresh the photo", "error");
    }
  };

  const openVideo = async () => {
    const url = recipe.video_url || recipe.source_url;
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Linking.openURL(url);
    }
  };
  const isYouTubeEmbed = !!recipe.video_url && recipe.video_url.includes("youtube.com/embed");

  const handleAddGrocery = async () => {
    try {
      const res = await addGrocery.mutateAsync({
        recipe_id: recipe.id,
        member_id: memberId ?? undefined,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toast(`Added ${res.added} items to your grocery list`, "success");
    } catch (e: any) {
      toast(e.message || "Could not add items", "error");
    }
  };

  const handleAddMeal = async () => {
    try {
      await addMeal.mutateAsync({
        date: selectedDate,
        meal_type: selectedMeal,
        recipe_id: recipe.id,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
      toast(`Planned for ${selectedMeal} on ${dayjs(selectedDate).format("ddd D MMM")}`, "success");
    } catch (e: any) {
      toast(e.message || "Could not add to plan", "error");
    }
  };

  const handleDelete = async () => {
    await deleteRecipe.mutateAsync(recipe.id);
    toast("Recipe removed", "info");
    router.back();
  };

  const nutrition = [
    { label: "Cal", value: recipe.calories },
    { label: "Protein", value: `${recipe.protein_g}g` },
    { label: "Carbs", value: `${recipe.carbs_g}g` },
    { label: "Fat", value: `${recipe.fat_g}g` },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      >
        {/* Hero */}
        <View style={styles.heroWrap}>
          <SourcePhoto
            testID="recipe-hero-photo"
            uri={recipe.image_url}
            status={recipe.image_status}
            title={recipe.title}
            style={styles.hero}
            fit="contain"
          />
          <LinearGradient
            colors={["rgba(41,37,36,0.55)", "rgba(41,37,36,0)", "rgba(41,37,36,0.0)"]}
            style={styles.scrimTop}
          />
          <View style={[styles.heroActions, { top: insets.top + spacing.sm }]}>
            <Pressable testID="back-button" onPress={() => router.back()} style={styles.circleBtn}>
              <Icon name="chevron-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Pressable testID="delete-recipe" onPress={handleDelete} style={styles.circleBtn}>
              <Icon name="trash-2" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.content}>
          {!!recipe.source_url && (
            <View style={styles.photoInfo}>
              <Text testID="recipe-photo-status" style={styles.photoStatus}>
                {recipe.image_status === "pending" ? "Finding the original photo…" : recipe.image_status === "ready" ? "Photo from the original source" : recipe.image_status === "error" ? "Photo couldn’t be saved. Try again." : "The source photo isn’t available yet"}
              </Text>
              <Pressable testID="refresh-recipe-photo" accessibilityRole="button" accessibilityLabel="Refresh original recipe photo"
                disabled={refreshPhoto.isPending || recipe.image_status === "pending" || !householdId}
                onPress={handleRefreshPhoto}
                style={({ pressed }) => [styles.photoRefresh, { opacity: pressed || recipe.image_status === "pending" ? 0.5 : 1 }]}>
                <Icon name="refresh-cw" size={16} color={colors.brandPrimary} />
                <Text testID="refresh-recipe-photo-label" style={styles.photoRefreshText}>Refresh</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.catRow}>
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{recipe.category}</Text>
            </View>
            {recipe.translated_from && (
              <View style={styles.translatedBadge}>
                <Icon name="globe" size={12} color={colors.onInfo} />
                <Text style={styles.translatedText}>Translated from {recipe.translated_from}</Text>
              </View>
            )}
          </View>

          <Text style={styles.title} testID="recipe-title">{recipe.title}</Text>
          {!!recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

          <View style={styles.metaRow}>
            {totalTime > 0 && (
              <View style={styles.metaItem}>
                <Icon name="clock" size={16} color={colors.brandPrimary} />
                <Text style={styles.metaText}>{totalTime} min</Text>
              </View>
            )}
            <View style={styles.servingsStepper}>
              <Pressable
                testID="servings-minus"
                hitSlop={8}
                onPress={() => setServings(Math.max(1, currentServings - 1))}
                style={styles.stepBtn}
              >
                <Icon name="minus" size={16} color={colors.onSurfaceTertiary} />
              </Pressable>
              <Text style={styles.servingsText} testID="servings-value">
                {currentServings} {currentServings === 1 ? "serving" : "servings"}
              </Text>
              <Pressable
                testID="servings-plus"
                hitSlop={8}
                onPress={() => setServings(currentServings + 1)}
                style={styles.stepBtn}
              >
                <Icon name="plus" size={16} color={colors.onSurfaceTertiary} />
              </Pressable>
            </View>
          </View>

          {(recipe.video_url || recipe.source_url) && (
            <View>
              {isYouTubeEmbed && Platform.OS !== "web" ? (
                <View style={styles.videoWrap}>
                  <WebView
                    testID="recipe-video"
                    source={{ uri: recipe.video_url! }}
                    style={styles.video}
                    allowsFullscreenVideo
                    javaScriptEnabled
                  />
                </View>
              ) : (
                <Pressable testID="watch-video-btn" onPress={openVideo} style={styles.videoBtn}>
                  <Icon name="play-circle" size={20} color={colors.brandPrimary} />
                  <Text style={styles.videoBtnText}>Watch the original video</Text>
                  <Icon name="external-link" size={16} color={colors.muted} />
                </Pressable>
              )}
            </View>
          )}

          {/* Nutrition */}
          <View>
            <Text style={styles.nutriHeading}>Nutrition · per serving</Text>
            <View style={styles.nutritionRow}>
              {nutrition.map((n) => (
                <View key={n.label} style={styles.nutriPill}>
                  <Text style={styles.nutriValue}>{n.value}</Text>
                  <Text style={styles.nutriLabel}>{n.label}</Text>
                </View>
              ))}
            </View>
            {recipe.calories > 0 && (
              <Text style={styles.totalCal} testID="total-calories">
                ≈ {totalCalories} cal total for {currentServings}{" "}
                {currentServings === 1 ? "serving" : "servings"}
              </Text>
            )}
          </View>

          {/* Segmented control */}
          <View style={styles.segment}>
            {(["ingredients", "steps"] as const).map((t) => (
              <Pressable
                key={t}
                testID={`tab-${t}`}
                onPress={() => setTab(t)}
                style={[styles.segmentBtn, tab === t && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                  {t === "ingredients"
                    ? `Ingredients (${recipe.ingredients.length})`
                    : `Steps (${recipe.steps.length})`}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === "ingredients" ? (
            <View style={styles.list}>
              {recipe.ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <View style={styles.dot} />
                  <Text style={styles.ingredientName}>{ing.name}</Text>
                  {!!ing.quantity && (
                    <Text style={styles.ingredientQty}>
                      {scaleQuantity(ing.quantity, factor)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.list}>
              {recipe.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <BlurView intensity={40} tint="light" style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable
          testID="add-to-grocery"
          onPress={handleAddGrocery}
          style={[styles.actionBtn, styles.actionSecondary]}
        >
          <Icon name="shopping-cart" size={18} color={colors.onBrandSecondary} />
          <Text style={[styles.actionText, { color: colors.onBrandSecondary }]}>Grocery</Text>
        </Pressable>
        <Pressable
          testID="open-plan-sheet"
          onPress={() => sheetRef.current?.present()}
          style={[styles.actionBtn, styles.actionPrimary]}
        >
          <Icon name="calendar" size={18} color={colors.onBrandPrimary} />
          <Text style={[styles.actionText, { color: colors.onBrandPrimary }]}>Add to Plan</Text>
        </Pressable>
      </BlurView>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["58%"]}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
        )}
      >
        <BottomSheetView style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.sheetTitle}>Add to meal plan</Text>

          <Text style={styles.sheetLabel}>Day</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
          >
            {days.map((d) => {
              const ds = d.format("YYYY-MM-DD");
              const active = ds === selectedDate;
              return (
                <Pressable
                  key={ds}
                  testID={`day-${ds}`}
                  onPress={() => setSelectedDate(ds)}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                >
                  <Text style={[styles.dayName, active && styles.dayTextActive]}>
                    {d.format("ddd")}
                  </Text>
                  <Text style={[styles.dayNum, active && styles.dayTextActive]}>
                    {d.format("D")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.sheetLabel}>Meal</Text>
          <View style={styles.mealRow}>
            {MEAL_TYPES.map((m) => {
              const active = m === selectedMeal;
              return (
                <Pressable
                  key={m}
                  testID={`meal-${m}`}
                  onPress={() => setSelectedMeal(m)}
                  style={[styles.mealChip, active && styles.mealChipActive]}
                >
                  <Text style={[styles.mealText, active && styles.mealTextActive]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable testID="confirm-add-plan" onPress={handleAddMeal} style={styles.confirmBtn}>
            <Text style={styles.confirmText}>Add to plan</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  heroWrap: { width: "100%", height: 300 },
  hero: { width: "100%", height: "100%", backgroundColor: colors.surfaceTertiary },
  photoInfo: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  photoStatus: { flex: 1, fontFamily: fonts.text.medium, fontSize: 12, lineHeight: 18, color: colors.muted },
  photoRefresh: { minHeight: 44, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  photoRefreshText: { fontFamily: fonts.text.semibold, fontSize: 12, color: colors.brandPrimary },
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0, height: 140 },
  heroActions: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(41,37,36,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.lg,
    marginTop: -spacing.xl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.md,
  },
  catRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  catBadge: {
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  catBadgeText: { fontFamily: fonts.text.semibold, fontSize: 12, color: colors.onBrandTertiary },
  translatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.info,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  translatedText: { fontFamily: fonts.text.medium, fontSize: 11, color: colors.onInfo },
  title: { fontFamily: fonts.display.bold, fontSize: 28, color: colors.onSurface, lineHeight: 34 },
  description: { fontFamily: fonts.text.regular, fontSize: 15, color: colors.muted, lineHeight: 22 },
  metaRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs, alignItems: "center", flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontFamily: fonts.text.semibold, fontSize: 14, color: colors.onSurfaceTertiary },
  servingsStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsText: {
    fontFamily: fonts.text.semibold,
    fontSize: 14,
    color: colors.onSurface,
    minWidth: 78,
    textAlign: "center",
  },
  videoWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  video: { flex: 1, backgroundColor: "#000000" },
  videoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 50,
  },
  videoBtnText: {
    flex: 1,
    fontFamily: fonts.text.semibold,
    fontSize: 15,
    color: colors.onBrandTertiary,
  },
  nutriHeading: {
    fontFamily: fonts.text.semibold,
    fontSize: 13,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  nutritionRow: { flexDirection: "row", gap: spacing.sm },
  totalCal: {
    fontFamily: fonts.text.medium,
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  nutriPill: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  nutriValue: { fontFamily: fonts.text.bold, fontSize: 16, color: colors.onSurface },
  nutriLabel: { fontFamily: fonts.text.medium, fontSize: 11, color: colors.muted },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: 4,
    marginTop: spacing.sm,
  },
  segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: colors.surfaceSecondary },
  segmentText: { fontFamily: fonts.text.semibold, fontSize: 14, color: colors.muted },
  segmentTextActive: { color: colors.brandPrimary },
  list: { gap: spacing.md, marginTop: spacing.sm },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: spacing.md,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brandPrimary },
  ingredientName: { flex: 1, fontFamily: fonts.text.medium, fontSize: 15, color: colors.onSurface },
  ingredientQty: { fontFamily: fonts.text.semibold, fontSize: 14, color: colors.muted },
  stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontFamily: fonts.text.bold, fontSize: 14, color: colors.onBrandPrimary },
  stepText: { flex: 1, fontFamily: fonts.text.regular, fontSize: 15, color: colors.onSurface, lineHeight: 23, paddingTop: 2 },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "rgba(253,251,247,0.85)",
  },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  actionSecondary: { backgroundColor: colors.brandSecondary },
  actionPrimary: { backgroundColor: colors.brandPrimary },
  actionText: { fontFamily: fonts.text.semibold, fontSize: 15 },
  sheet: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  sheetTitle: { fontFamily: fonts.display.bold, fontSize: 22, color: colors.onSurface, marginBottom: spacing.sm },
  sheetLabel: {
    fontFamily: fonts.text.semibold,
    fontSize: 13,
    color: colors.onSurfaceTertiary,
    marginTop: spacing.md,
  },
  dayRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  dayChip: {
    width: 54,
    height: 68,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayChipActive: { backgroundColor: colors.brandPrimary },
  dayName: { fontFamily: fonts.text.medium, fontSize: 12, color: colors.muted },
  dayNum: { fontFamily: fonts.text.bold, fontSize: 18, color: colors.onSurface },
  dayTextActive: { color: colors.onBrandPrimary },
  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  mealChip: {
    paddingHorizontal: spacing.lg,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  mealChipActive: { backgroundColor: colors.brandPrimary },
  mealText: { fontFamily: fonts.text.semibold, fontSize: 14, color: colors.onSurfaceTertiary },
  mealTextActive: { color: colors.onBrandPrimary },
  confirmBtn: {
    marginTop: spacing.xl,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { fontFamily: fonts.text.semibold, fontSize: 16, color: colors.onBrandPrimary },
}));
