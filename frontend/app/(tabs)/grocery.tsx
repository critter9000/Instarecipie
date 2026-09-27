import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Icon from "@react-native-vector-icons/feather";

import {
  AISLE_ORDER,
  GroceryItem,
  useAddGrocery,
  useClearCompleted,
  useDeleteGrocery,
  useGrocery,
  useHousehold,
  useToggleGrocery,
} from "@/src/api";
import EmptyState from "@/src/components/EmptyState";
import { useToast } from "@/src/components/Toast";
import { useHouseholdCtx } from "@/src/household-context";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Grocery() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { householdId, memberId } = useHouseholdCtx();
  const toast = useToast();

  const { data: items, isLoading } = useGrocery(householdId ?? undefined);
  const { data: household } = useHousehold(householdId ?? undefined);
  const addGrocery = useAddGrocery(householdId ?? undefined);
  const toggle = useToggleGrocery(householdId ?? undefined);
  const remove = useDeleteGrocery(householdId ?? undefined);
  const clearCompleted = useClearCompleted(householdId ?? undefined);

  const [newItem, setNewItem] = useState("");
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const memberColor = (id: string | null) =>
    household?.members.find((m) => m.id === id)?.color ?? colors.muted;
  const memberInitial = (id: string | null) =>
    (household?.members.find((m) => m.id === id)?.name ?? "?").charAt(0).toUpperCase();

  const { grouped, completed } = useMemo(() => {
    const active = (items ?? []).filter((i) => !i.checked);
    const done = (items ?? []).filter((i) => i.checked);
    const g: Record<string, GroceryItem[]> = {};
    active.forEach((i) => {
      (g[i.aisle] = g[i.aisle] || []).push(i);
    });
    return { grouped: g, completed: done };
  }, [items]);

  const handleAdd = () => {
    if (newItem.trim().length === 0) return;
    addGrocery.mutate({ name: newItem.trim(), added_by: memberId ?? undefined });
    setNewItem("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onToggle = (item: GroceryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggle.mutate({ id: item.id, checked: !item.checked });
  };

  const activeCount = (items ?? []).filter((i) => !i.checked).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.eyebrow}>SHARED LIST</Text>
            <Text style={styles.title}>Grocery List</Text>
          </View>
          <View style={styles.avatars}>
            {(household?.members ?? []).slice(0, 4).map((m, idx) => (
              <View
                key={m.id}
                style={[
                  styles.avatar,
                  { backgroundColor: m.color, marginLeft: idx === 0 ? 0 : -10 },
                ]}
              >
                <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.addRow}>
          <TextInput
            testID="grocery-add-input"
            value={newItem}
            onChangeText={setNewItem}
            placeholder="Add an item…"
            placeholderTextColor={colors.muted}
            style={styles.addInput}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <Pressable testID="grocery-add-btn" onPress={handleAdd} style={styles.addBtn}>
            <Icon name="plus" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (items?.length ?? 0) === 0 ? (
        <EmptyState message="All stocked up! Add ingredients from a recipe or type them above." />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: bottomChrome + spacing["2xl"] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {activeCount === 0 && (
            <Text style={styles.allDone}>Everything is checked off! 🎉</Text>
          )}
          {AISLE_ORDER.filter((a) => grouped[a]?.length).map((aisle) => (
            <View key={aisle} style={styles.section}>
              <Text style={styles.sectionTitle}>{aisle}</Text>
              {grouped[aisle].map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Pressable
                    testID={`grocery-toggle-${item.id}`}
                    onPress={() => onToggle(item)}
                    style={styles.checkbox}
                  >
                    <Icon name="circle" size={22} color={colors.borderStrong} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {!!item.quantity && <Text style={styles.itemQty}>{item.quantity}</Text>}
                  </View>
                  {item.added_by && (
                    <View style={[styles.miniAvatar, { backgroundColor: memberColor(item.added_by) }]}>
                      <Text style={styles.miniAvatarText}>{memberInitial(item.added_by)}</Text>
                    </View>
                  )}
                  <Pressable
                    testID={`grocery-delete-${item.id}`}
                    hitSlop={8}
                    onPress={() => remove.mutate(item.id)}
                  >
                    <Icon name="x" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))}

          {completed.length > 0 && (
            <View style={styles.completedSection}>
              <View style={styles.completedHead}>
                <Text style={styles.sectionTitle}>Completed ({completed.length})</Text>
                <Pressable testID="clear-completed-btn" onPress={() => clearCompleted.mutate()}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              </View>
              {completed.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Pressable
                    testID={`grocery-toggle-${item.id}`}
                    onPress={() => onToggle(item)}
                    style={styles.checkbox}
                  >
                    <Icon name="check-circle" size={22} color={colors.onSuccess} />
                  </Pressable>
                  <Text style={[styles.itemName, styles.itemDone]}>{item.name}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontFamily: fonts.text.semibold, fontSize: 11, letterSpacing: 1.5, color: colors.brandPrimary },
  title: { fontFamily: fonts.display.bold, fontSize: 30, color: colors.onSurface },
  avatars: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarText: { fontFamily: fonts.text.bold, fontSize: 14, color: "#FFFFFF" },
  addRow: { flexDirection: "row", gap: spacing.sm },
  addInput: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.text.medium,
    fontSize: 15,
    color: colors.onSurface,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xl },
  allDone: { fontFamily: fonts.text.medium, fontSize: 15, color: colors.muted, textAlign: "center" },
  section: { gap: spacing.xs },
  sectionTitle: {
    fontFamily: fonts.text.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkbox: { padding: 2 },
  itemName: { flex: 1, fontFamily: fonts.text.medium, fontSize: 15, color: colors.onSurface },
  itemQty: { fontFamily: fonts.text.regular, fontSize: 13, color: colors.muted, marginTop: 1 },
  itemDone: { textDecorationLine: "line-through", color: colors.muted },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  miniAvatarText: { fontFamily: fonts.text.bold, fontSize: 11, color: "#FFFFFF" },
  completedSection: { gap: spacing.xs },
  completedHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearText: { fontFamily: fonts.text.semibold, fontSize: 13, color: colors.brandPrimary },
}));
