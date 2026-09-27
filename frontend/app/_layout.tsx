import "react-native-reanimated";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { HouseholdProvider } from "@/src/household-context";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    "Lora-Regular": require("../assets/fonts/Lora-Regular.ttf"),
    "Lora-Medium": require("../assets/fonts/Lora-Medium.ttf"),
    "Lora-SemiBold": require("../assets/fonts/Lora-SemiBold.ttf"),
    "Lora-Bold": require("../assets/fonts/Lora-Bold.ttf"),
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    Feather: require("@react-native-vector-icons/feather/fonts/Feather.ttf"),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: "#FDFBF7" }} />;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <BottomSheetModalProvider>
                <HouseholdProvider>
                  <ToastProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="index" />
                      <Stack.Screen name="onboarding" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen
                        name="import"
                        options={{ presentation: "modal" }}
                      />
                      <Stack.Screen name="recipe/[id]" />
                    </Stack>
                  </ToastProvider>
                </HouseholdProvider>
              </BottomSheetModalProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
