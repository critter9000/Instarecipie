import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { MASCOT } from "@/src/assets";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

export default function Mascot({
  message,
  size = 150,
}: {
  message?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Image
        source={{ uri: MASCOT }}
        style={{ width: size, height: size, borderRadius: radius.lg }}
        contentFit="cover"
        transition={300}
      />
      {message && (
        <View
          style={[
            styles.bubble,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.bubbleText, { color: colors.onSurfaceSecondary }]}>
            {message}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.lg },
  bubble: {
    maxWidth: 300,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bubbleText: {
    fontFamily: fonts.text.medium,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
  },
});
