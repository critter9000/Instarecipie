import React from "react";
import { Pressable, ScrollView, Text } from "react-native";
import * as Haptics from "expo-haptics";

import { fonts, makeStyles, radius, spacing } from "@/src/theme";

export default function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: string[];
  selected: string;
  onSelect: (c: string) => void;
}) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {categories.map((c) => {
        const active = c === selected;
        return (
          <Pressable
            key={c}
            testID={`category-chip-${c}`}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(c);
            }}
            style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
          >
            <Text style={[styles.text, active ? styles.textActive : styles.textIdle]}>
              {c}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  scroll: { flexGrow: 0 },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 56,
    alignItems: "center",
  },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  chipIdle: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
  },
  text: { fontFamily: fonts.text.semibold, fontSize: 13 },
  textActive: { color: colors.onBrandPrimary },
  textIdle: { color: colors.onSurfaceTertiary },
}));
