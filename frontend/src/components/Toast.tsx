import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  FadeOutUp,
} from "react-native-reanimated";
import Icon from "@react-native-vector-icons/feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, spacing, radius, useTheme } from "@/src/theme";

type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type: ToastType } | null;

const ToastContext = createContext<(message: string, type?: ToastType) => void>(
  () => {},
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback((message: string, type: ToastType = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const iconName =
    toast?.type === "error"
      ? "alert-circle"
      : toast?.type === "info"
        ? "info"
        : "check-circle";
  const accent =
    toast?.type === "error"
      ? colors.onError
      : toast?.type === "info"
        ? colors.onInfo
        : colors.onSuccess;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          entering={FadeInUp.springify().damping(18)}
          exiting={FadeOutUp}
          pointerEvents="none"
          style={[
            styles.wrap,
            { top: insets.top + spacing.sm, backgroundColor: colors.surfaceInverse },
          ]}
          testID="app-toast"
        >
          <Icon name={iconName as any} size={18} color={accent} />
          <Text style={[styles.text, { color: colors.onSurfaceInverse }]} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 9999,
  },
  text: {
    flex: 1,
    fontFamily: fonts.text.medium,
    fontSize: 14,
  },
});
