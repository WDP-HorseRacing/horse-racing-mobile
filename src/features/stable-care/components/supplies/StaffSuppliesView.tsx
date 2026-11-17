import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { SecondaryButton } from "@/components/ui";
import type { SupplyItemDto, SupplyRequestDto } from "@/adapters/supplies.adapter";

type SuppliesStyles = Record<string, any>;

type StaffSuppliesViewProps =
  | {
      mode: "stock-actions";
      item: SupplyItemDto;
      canUse: boolean;
      canRequest: boolean;
      styles: SuppliesStyles;
      colors: { foreground: string; primary: string };
      t: (key: string) => string;
      onUse: (item: SupplyItemDto) => void;
      onPropose: (item: SupplyItemDto) => void;
    }
  | {
      mode: "request-actions";
      request: SupplyRequestDto;
      canRequest: boolean;
      onEditRequest: (request: SupplyRequestDto) => void;
    };

export function StaffSuppliesView(props: StaffSuppliesViewProps) {
  if (props.mode === "stock-actions") {
    const { item, canUse, canRequest, styles, colors, t, onUse, onPropose } = props;
    return (
      <View style={styles.cardMovementRow}>
        {canUse ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Use")}
            onPress={() => onUse(item)}
            style={[styles.useActionBtn, { flex: 1 }]}
          >
            <Ionicons name="remove-circle-outline" size={16} color={colors.foreground} />
            <Text style={styles.useActionBtnText} numberOfLines={1}>
              {t("Use")}
            </Text>
          </Pressable>
        ) : null}
        {canRequest ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Propose restock")}
            onPress={() => onPropose(item)}
            style={styles.requestActionBtn}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.requestActionBtnText} numberOfLines={1}>
              {t("Propose restock")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const { request, canRequest, onEditRequest } = props;
  if (!canRequest || request.status !== "PENDING" || request.requestedBy !== request.requester.id)
    return null;

  return (
    <SecondaryButton
      label="Edit pending request"
      icon="create-outline"
      onPress={() => onEditRequest(request)}
    />
  );
}
