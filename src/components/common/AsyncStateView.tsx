import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { extractErrorMessage } from "@/utils/errorHandler";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

type Props = {
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  loadingLabel?: string;
  empty?: boolean;
  emptyLabel?: string;
};

export function AsyncStateView({
  isLoading,
  error,
  onRetry,
  loadingLabel = "Đang tải…",
  empty = false,
  emptyLabel = "Chưa có dữ liệu.",
}: Props) {
  const { colors } = useTheme();
  if (isLoading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground }}>{loadingLabel}</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.error, { color: colors.destructive }]}>
          {extractErrorMessage(error)}
        </Text>
        <Pressable onPress={onRetry} style={[styles.retry, { backgroundColor: colors.fitSoft }]}>
          <Text style={[styles.retryText, { color: colors.primary }]}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }
  if (empty) {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.mutedForeground }}>{emptyLabel}</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  state: { minHeight: 96, alignItems: "center", justifyContent: "center", gap: space.sm },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.md },
  error: { fontSize: 13, lineHeight: 19 },
  retry: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  retryText: { fontSize: 13, fontWeight: "700" },
});
