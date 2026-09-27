import React from "react";
import { StyleSheet, View } from "react-native";

import Mascot from "@/src/components/Mascot";
import Button from "@/src/components/Button";
import { spacing } from "@/src/theme";

export default function EmptyState({
  message,
  ctaLabel,
  onPress,
  icon,
}: {
  message: string;
  ctaLabel?: string;
  onPress?: () => void;
  icon?: string;
}) {
  return (
    <View style={styles.wrap} testID="empty-state">
      <Mascot message={message} />
      {ctaLabel && onPress && (
        <Button
          label={ctaLabel}
          onPress={onPress}
          icon={icon}
          style={styles.cta}
          testID="empty-state-cta"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xl,
  },
  cta: { alignSelf: "stretch" },
});
