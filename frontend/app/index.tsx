import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useHouseholdCtx } from "@/src/household-context";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { ready, householdId } = useHouseholdCtx();
  const { colors } = useTheme();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  return <Redirect href={householdId ? "/(tabs)" : "/onboarding"} />;
}
