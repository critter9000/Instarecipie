import React from "react";
import { ActivityIndicator, Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Icon from "@react-native-vector-icons/feather";

import { fonts, makeStyles, radius, spacing } from "@/src/theme";

type Variant = "primary" | "secondary" | "ghost";

export default function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const styles = useStyles();
  const isDisabled = disabled || loading;

  const handle = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const textColor =
    variant === "primary" ? "#FFFFFF" : variant === "secondary" ? "#8A311D" : "#C84C31";

  return (
    <Pressable
      testID={testID}
      onPress={handle}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon as any} size={18} color={textColor} />}
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.brandPrimary },
  secondary: { backgroundColor: colors.brandSecondary },
  ghost: { backgroundColor: "transparent" },
  label: {
    fontFamily: fonts.text.semibold,
    fontSize: 16,
  },
}));
