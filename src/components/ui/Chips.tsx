import { useState } from "react";
import { ScrollView, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { formatEnum } from "@/utils/formatters";

export function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { t } = useI18n();
  const [canScrollRight, setCanScrollRight] = useState(options.length >= 4);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const isEnd = layoutMeasurement.width + contentOffset.x >= contentSize.width - 20;
          setCanScrollRight(!isEnd && contentSize.width > layoutMeasurement.width);
        }}
        scrollEventThrottle={16}
      >
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.chip, value === option && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, value === option && styles.chipTextActive]}
              numberOfLines={1}
            >
              {formatEnum(t(option))}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {canScrollRight && (
        <View style={styles.scrollHint} pointerEvents="none">
          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      position: "relative",
      width: "100%",
    },
    chips: { flexDirection: "row", gap: space.sm, paddingRight: space.xl, paddingVertical: 3 },
    scrollHint: {
      position: "absolute",
      right: 0,
      top: 2,
      bottom: 2,
      width: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.pill,
      borderBottomLeftRadius: radius.pill,
      borderLeftWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: -1, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    chip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: space.md,
      paddingVertical: 9,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600" },
    chipTextActive: { color: "#FFFFFF" },
  });
