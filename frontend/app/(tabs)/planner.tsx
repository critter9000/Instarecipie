import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Icon from "@react-native-vector-icons/feather";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
} from "@gorhom/bottom-sheet";
import dayjs from "dayjs";

import { useAddMeal, useDeleteMeal, useMealPlan, useRecipes } from "@/src/api";
import SourcePhoto from "@/src/components/SourcePhoto";
import EmptyState from "@/src/components/EmptyState";
import { useToast } from "@/src/components/Toast";
import { useHouseholdCtx } from "@/src/household-context";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function Planner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { householdId } = useHouseholdCtx();

  const days = useMemo(
    () => Array.from({ length: 14 }).map((_, i) => dayjs().add(i, "day")),
    [],
  );
  const start = days[0].format("YYYY-MM-DD");
  const end = days[days.length - 1].format("YYYY-MM-DD");

  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [pickMeal, setPickMeal] = useState("Dinner");

  const { data: plan, isLoading } = useMealPlan(householdId ?? undefined, start, end);
  const { data: recipes } = useRecipes(householdId ?? undefined);
  const addMeal = useAddMeal(householdId ?? undefined);
  const deleteMeal = useDeleteMeal(householdId ?? undefined);

  const sheetRef = useRef<BottomSheetModal>(null);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const dayEntries = (plan ?? []).filter((e) => e.date === selectedDate);

  const openPicker = (meal: string) => {
    setPickMeal(meal);
    sheetRef.current?.present();
  };

  const addRecipeToPlan = async (recipeId: string) => {
    try {
      await addMeal.mutateAsync({ date: selectedDate, meal_type: pickMeal, recipe_id: recipeId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
      toast(`Added to ${pickMeal}`, "success");
    } catch (e: any) {
      toast(e.message || "Could not add", "error");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>THIS WEEK</Text>
        <Text style={styles.title}>Meal Planner</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}
        style={styles.dayScroll}
      >
        {days.map((d) => {
          const ds = d.format("YYYY-MM-DD");
          const active = ds === selectedDate;
          const hasMeals = (plan ?? []).some((e) => e.date === ds);
          return (
            <Pressable
              key={ds}
              testID={`planner-day-${ds}`}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedDate(ds);
              }}
              style={[styles.dayChip, active && styles.dayChipActive]}
            >
              <Text style={[styles.dayName, active && styles.dayTextActive]}>{d.format("ddd")}</Text>
              <Text style={[styles.dayNum, active && styles.dayTextActive]}>{d.format("D")}</Text>
              {hasMeals && <View style={[styles.dayDot, active && styles.dayDotActive]} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (recipes?.length ?? 0) === 0 ? (
        <EmptyState
          message="Your week is looking hungry! Import some recipes first, then plan your meals."
          ctaLabel="Import a recipe"
          icon="download"
          onPress={() => router.push("/import")}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: bottomChrome + spacing["2xl"] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {MEAL_TYPES.map((meal) => {
            const entries = dayEntries.filter((e) => e.meal_type === meal);
            return (
              <View key={meal} style={styles.mealSection}>
                <Text style={styles.mealHeading}>{meal}</Text>
                {entries.map((e) => (
                  <Pressable
                    key={e.id}
                    testID={`plan-entry-${e.id}`}
                    onPress={() => router.push(`/recipe/${e.recipe_id}`)}
                    style={styles.filledSlot}
                  >
                    <SourcePhoto
                      testID={`plan-photo-${e.id}`}
                      uri={recipes?.some((recipe) => recipe.id === e.recipe_id) ? recipes.find((recipe) => recipe.id === e.recipe_id)?.image_url : e.recipe_image}
                      status={recipes?.find((recipe) => recipe.id === e.recipe_id)?.image_status}
                      title={e.recipe_title}
                      compact
                      style={styles.slotThumb}
                    />
                    <Text style={styles.slotTitle} numberOfLines={2}>{e.recipe_title}</Text>
                    <Pressable
                      testID={`remove-plan-${e.id}`}
                      hitSlop={10}
                      onPress={() => deleteMeal.mutate(e.id)}
                      style={styles.removeBtn}
                    >
                      <Icon name="x" size={18} color={colors.muted} />
                    </Pressable>
                  </Pressable>
                ))}
                <Pressable
                  testID={`add-slot-${meal}`}
                  onPress={() => openPicker(meal)}
                  style={styles.emptySlot}
                >
                  <Icon name="plus" size={18} color={colors.brandPrimary} />
                  <Text style={styles.emptySlotText}>Add {meal.toLowerCase()}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["70%"]}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
        )}
      >
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Pick a recipe for {pickMeal}</Text>
        </View>
        <BottomSheetFlatList
          data={recipes ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              testID={`pick-recipe-${item.id}`}
              onPress={() => addRecipeToPlan(item.id)}
              style={styles.pickRow}
            >
              <SourcePhoto
                testID={`picker-photo-${item.id}`}
                uri={item.image_url}
                status={item.image_status}
                title={item.title}
                compact
                style={styles.pickThumb}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.pickMeta}>{item.category}</Text>
              </View>
              <Icon name="plus-circle" size={22} color={colors.brandPrimary} />
            </Pressable>
          )}
        />
      </BottomSheetModal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  eyebrow: {
    fontFamily: fonts.text.semibold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.brandPrimary,
  },
  title: { fontFamily: fonts.display.bold, fontSize: 30, color: colors.onSurface },
  dayScroll: { flexGrow: 0 },
  dayRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  dayChip: {
    width: 52,
    height: 70,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  dayName: { fontFamily: fonts.text.medium, fontSize: 12, color: colors.muted },
  dayNum: { fontFamily: fonts.text.bold, fontSize: 18, color: colors.onSurface },
  dayTextActive: { color: colors.onBrandPrimary },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brandPrimary, marginTop: 2 },
  dayDotActive: { backgroundColor: colors.onBrandPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xl },
  mealSection: { gap: spacing.sm },
  mealHeading: { fontFamily: fonts.display.semibold, fontSize: 18, color: colors.onSurface },
  filledSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotThumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  slotTitle: { flex: 1, fontFamily: fonts.text.semibold, fontSize: 15, color: colors.onSurface },
  removeBtn: { padding: spacing.xs },
  emptySlot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  emptySlotText: { fontFamily: fonts.text.semibold, fontSize: 14, color: colors.brandPrimary },
  sheetHead: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  sheetTitle: { fontFamily: fonts.display.bold, fontSize: 20, color: colors.onSurface },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickThumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  pickTitle: { fontFamily: fonts.text.semibold, fontSize: 15, color: colors.onSurface },
  pickMeta: { fontFamily: fonts.text.medium, fontSize: 12, color: colors.muted, marginTop: 2 },
}));
