import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { DangerButton, PrimaryButton } from "@/components/ui";
import type { SupplyItemDto, SupplyRequestDto } from "@/adapters/supplies.adapter";

type SuppliesStyles = Record<string, any>;

type ManagerSuppliesViewProps =
  | {
      mode: "add";
      onAdd: () => void;
    }
  | {
      mode: "item-actions";
      item: SupplyItemDto;
      styles: SuppliesStyles;
      t: (key: string) => string;
      colors: { foreground: string; destructive: string };
      onEdit: (item: SupplyItemDto) => void;
      onDelete: (item: SupplyItemDto) => void;
    }
  | {
      mode: "stock-actions";
      item: SupplyItemDto;
      canUse: boolean;
      styles: SuppliesStyles;
      t: (key: string) => string;
      colors: { foreground: string };
      onUse: (item: SupplyItemDto) => void;
    }
  | {
      mode: "request-actions";
      request: SupplyRequestDto;
      styles: SuppliesStyles;
      onApprove: () => void;
      onReject: () => void;
      onFulfill: () => void;
      onCancel: () => void;
    };

export function ManagerSuppliesView(props: ManagerSuppliesViewProps) {
  if (props.mode === "add") {
    return <PrimaryButton label="Add supply" icon="add" onPress={props.onAdd} />;
  }

  if (props.mode === "item-actions") {
    const { item, styles, t, colors, onEdit, onDelete } = props;
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Edit")}
          onPress={() => onEdit(item)}
          style={styles.editActionBtn}
        >
          <Ionicons name="create-outline" size={15} color={colors.foreground} />
          <Text style={styles.editActionBtnText} numberOfLines={1}>
            {t("Edit")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Delete")}
          onPress={() => onDelete(item)}
          style={styles.deleteActionBtn}
        >
          <Ionicons name="trash-outline" size={15} color={colors.destructive} />
          <Text style={styles.deleteActionBtnText} numberOfLines={1}>
            {t("Delete")}
          </Text>
        </Pressable>
      </>
    );
  }

  if (props.mode === "stock-actions") {
    const { item, canUse, styles, t, colors, onUse } = props;
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
      </View>
    );
  }

  const { request, styles, onApprove, onReject, onFulfill, onCancel } = props;
  if (request.status === "PENDING") {
    return (
      <View style={styles.requestActionRow}>
        <PrimaryButton
          label="Approve"
          icon="checkmark"
          style={{ flex: 1 }}
          onPress={onApprove}
        />
        <DangerButton label="Reject" icon="close" style={{ flex: 1 }} onPress={onReject} />
      </View>
    );
  }
  if (request.status === "APPROVED") {
    return (
      <View style={styles.requestActionRow}>
        <PrimaryButton
          label="Confirm issue"
          icon="cube-outline"
          style={{ flex: 1 }}
          onPress={onFulfill}
        />
        <DangerButton
          label="Cancel request"
          icon="close"
          style={{ flex: 1 }}
          onPress={onCancel}
        />
      </View>
    );
  }
  return null;
}
