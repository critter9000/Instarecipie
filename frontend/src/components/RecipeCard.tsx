import React from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/feather";

import { Recipe } from "@/src/api";
import { RECIPE_PLACEHOLDER } from "@/src/assets";
import { fonts, makeStyles, radius, spacing } from "@/src/theme";

export default function RecipeCard({
  recipe,
  onPress,
}: {
  recipe: Recipe;
  onPress: () => void;
}) {
  const styles = useStyles();
  const totalTime = recipe.prep_time_minutes + recipe.cook_time_minutes;

  return (
    <Pressable
      testID={`recipe-card-${recipe.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: recipe.image_url || RECIPE_PLACEHOLDER }}
          style={styles.image}
          contentFit="cover"
          transition={250}
        />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{recipe.category}</Text>
        </View>
        {recipe.source_type !== "manual" && (
          <View style={styles.importBadge}>
            <Icon name="download" size={11} color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>
        <View style={styles.metaRow}>
          {totalTime > 0 && (
            <View style={styles.meta}>
              <Icon name="clock" size={12} color="#78716C" />
              <Text style={styles.metaText}>{totalTime}m</Text>
            </View>
          )}
          {recipe.calories > 0 && (
            <View style={styles.meta}>
              <Icon name="zap" size={12} color="#78716C" />
              <Text style={styles.metaText}>{recipe.calories} cal</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageWrap: { width: "100%", aspectRatio: 1.1 },
  image: { width: "100%", height: "100%", backgroundColor: colors.surfaceTertiary },
  badge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.text.semibold,
    fontSize: 10,
  },
  importBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(41,37,36,0.7)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing.md, gap: spacing.xs },
  title: {
    fontFamily: fonts.display.semibold,
    fontSize: 16,
    color: colors.onSurfaceSecondary,
    lineHeight: 21,
  },
  metaRow: { flexDirection: "row", gap: spacing.md, marginTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: {
    fontFamily: fonts.text.medium,
    fontSize: 12,
    color: colors.muted,
  },
}));

// keep gradient import used to satisfy tree-shaking-safe usage in future overlays
export const _LinearGradient = LinearGradient;
