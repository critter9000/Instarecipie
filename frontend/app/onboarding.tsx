import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { createHousehold, joinHousehold } from "@/src/api";
import Button from "@/src/components/Button";
import Mascot from "@/src/components/Mascot";
import { useToast } from "@/src/components/Toast";
import { useHouseholdCtx } from "@/src/household-context";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Onboarding() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { save } = useHouseholdCtx();

  const [mode, setMode] = useState<"welcome" | "create" | "join">("welcome");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const doCreate = async () => {
    setLoading(true);
    try {
      const res = await createHousehold("My Kitchen", name.trim() || "Me");
      await save(res.household.id, res.member_id, name.trim() || "Me");
      router.replace("/(tabs)");
    } catch (e: any) {
      toast(e.message || "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  const doJoin = async () => {
    if (code.trim().length < 4) {
      toast("Enter the 6-character kitchen code", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await joinHousehold(code.trim().toUpperCase(), name.trim() || "Me");
      await save(res.household.id, res.member_id, name.trim() || "Me");
      router.replace("/(tabs)");
    } catch (e: any) {
      toast(e.message || "Could not join kitchen", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <Mascot
          size={160}
          message={
            mode === "welcome"
              ? "Hi! I'm Basil. Let's build your cookbook together! 🌿"
              : mode === "create"
                ? "What should I call you in the kitchen?"
                : "Got a kitchen code from your household?"
          }
        />

        <View style={styles.hero}>
          <Text style={styles.brand}>All My Meals</Text>
          <Text style={styles.tagline}>
            Save recipes from TikTok, Instagram & the web, then plan your week.
          </Text>
        </View>

        {mode !== "welcome" && (
          <View style={styles.form}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              testID="onboarding-name-input"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Alex"
              placeholderTextColor={colors.muted}
              style={styles.input}
              returnKeyType="done"
            />
            {mode === "join" && (
              <>
                <Text style={styles.label}>Kitchen code</Text>
                <TextInput
                  testID="onboarding-code-input"
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  placeholder="ABC123"
                  autoCapitalize="characters"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.codeInput]}
                  maxLength={6}
                />
              </>
            )}
          </View>
        )}
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        {mode === "welcome" && (
          <>
            <Button
              label="Create my kitchen"
              icon="plus-circle"
              onPress={() => setMode("create")}
              testID="onboarding-create-btn"
            />
            <Pressable
              testID="onboarding-join-link"
              onPress={() => setMode("join")}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>Join an existing kitchen</Text>
            </Pressable>
          </>
        )}
        {mode === "create" && (
          <>
            <Button
              label="Start cooking"
              icon="arrow-right"
              loading={loading}
              onPress={doCreate}
              testID="onboarding-start-btn"
            />
            <Pressable onPress={() => setMode("welcome")} style={styles.linkBtn}>
              <Text style={styles.linkText}>Back</Text>
            </Pressable>
          </>
        )}
        {mode === "join" && (
          <>
            <Button
              label="Join kitchen"
              icon="users"
              loading={loading}
              onPress={doJoin}
              testID="onboarding-join-btn"
            />
            <Pressable onPress={() => setMode("welcome")} style={styles.linkBtn}>
              <Text style={styles.linkText}>Back</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
    paddingVertical: spacing.xl,
  },
  hero: { alignItems: "center", gap: spacing.sm },
  brand: {
    fontFamily: fonts.display.bold,
    fontSize: 34,
    color: colors.onSurface,
  },
  tagline: {
    fontFamily: fonts.text.regular,
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  form: { alignSelf: "stretch", gap: spacing.sm },
  label: {
    fontFamily: fonts.text.semibold,
    fontSize: 13,
    color: colors.onSurfaceTertiary,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    fontFamily: fonts.text.medium,
    fontSize: 16,
    color: colors.onSurface,
  },
  codeInput: {
    letterSpacing: 6,
    fontFamily: fonts.text.bold,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  linkBtn: { alignItems: "center", paddingVertical: spacing.md },
  linkText: {
    fontFamily: fonts.text.semibold,
    fontSize: 15,
    color: colors.brandPrimary,
  },
}));
