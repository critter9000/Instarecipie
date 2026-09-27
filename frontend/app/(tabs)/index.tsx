import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/feather";

import { CATEGORIES, useRecipes } from "@/src/api";
import CategoryChips from "@/src/components/CategoryChips";
import EmptyState from "@/src/components/EmptyState";
import RecipeCard from "@/src/components/RecipeCard";
import { useHouseholdCtx } from "@/src/household-context";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Library() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { householdId } = useHouseholdCtx();

  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } = useRecipes(
    householdId ?? undefined,
    category,
    search,
  );

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.eyebrow}>ALL MY MEALS</Text>
            <Text style={styles.title}>My Cookbook</Text>
          </View>
          <Pressable
            testID="import-button"
            onPress={() => router.push("/import")}
            style={styles.importBtn}
          >
            <Icon name="plus" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            testID="recipe-search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Search your recipes"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} testID="clear-search">
              <Icon name="x" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <CategoryChips categories={CATEGORIES} selected={category} onSelect={setCategory} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : isError ? (
        <EmptyState
          message="Oops, I burnt the toast! Couldn't load your recipes."
          ctaLabel="Try again"
          icon="refresh-cw"
          onPress={refetch}
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          message="Paste a recipe link to start your cookbook! I'll sort the ingredients and steps for you."
          ctaLabel="Import a recipe"
          icon="download"
          onPress={() => router.push("/import")}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomChrome + spacing["2xl"] },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.brandPrimary}
            />
          }
          renderItem={({ item }) => (
            <RecipeCard recipe={item} onPress={() => router.push(`/recipe/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontFamily: fonts.text.semibold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.brandPrimary,
  },
  title: {
    fontFamily: fonts.display.bold,
    fontSize: 30,
    color: colors.onSurface,
  },
  importBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.text.medium,
    fontSize: 15,
    color: colors.onSurface,
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  column: { gap: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
}));
