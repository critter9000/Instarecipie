import { useEffect, useState } from "react";
import { ActivityIndicator, StyleProp, Text, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import Icon from "@react-native-vector-icons/feather";

import { photoUrl, Recipe } from "@/src/api";
import { fonts, makeStyles, spacing, useTheme } from "@/src/theme";

type Props = {
  uri?: string | null;
  status?: Recipe["image_status"];
  title: string;
  testID: string;
  style: StyleProp<ViewStyle>;
  compact?: boolean;
  fit?: "cover" | "contain";
};

export default function SourcePhoto({ uri, status, title, testID, style, compact = false, fit = "cover" }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const source = photoUrl(uri);
  useEffect(() => { setFailed(false); setLoaded(false); }, [source]);
  const showImage = !!source && !failed;
  const pending = status === "pending" || (showImage && !loaded);

  return (
    <View testID={`${testID}-container`} style={[styles.container, style]}>
      {showImage && (
        <Image key={source} testID={testID} source={{ uri: source }} style={styles.image}
          accessibilityLabel={`Original source photo for ${title}`} contentFit={fit}
          cachePolicy="memory-disk" transition={200} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      )}
      {(!showImage || !loaded) && (
        <View testID={`${testID}-status`} style={styles.fallback}>
          {pending ? <ActivityIndicator testID={`${testID}-loading`} color={colors.brandPrimary} /> : <Icon name="image" size={compact ? 20 : 30} color={colors.muted} />}
          {!compact && <Text testID={`${testID}-message`} style={styles.label}>{pending ? "Finding source photo…" : "Source photo unavailable"}</Text>}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  fallback: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md },
  label: { fontFamily: fonts.text.medium, fontSize: 12, textAlign: "center", color: colors.muted },
}));