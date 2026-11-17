import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { SectionTitle } from "@/components/common";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/config/theme";
import { suppliesService } from "@/services/supplies.service";
import {
  supplyCategoryLabel,
  type SupplyCategory,
  type SupplyItemDto,
  type SupplyRequestDto,
} from "@/adapters/supplies.adapter";
import { showApiError } from "@/utils/errorHandler";

const CATEGORIES: SupplyCategory[] = ["FEED", "SUPPLEMENT", "MEDICINE", "EQUIPMENT"];

export type SupplyManagerActionMode =
  | "item-create"
  | "item-edit"
  | "reject"
  | "fulfill"
  | "cancel-request"
  | null;

interface SupplyManagerActionModalProps {
  visible: boolean;
  mode: SupplyManagerActionMode;
  item: SupplyItemDto | null;
  request: SupplyRequestDto | null;
  token: string;
  styles: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function SupplyManagerActionModal({
  visible,
  mode,
  item,
  request,
  token,
  styles,
  onClose,
  onSuccess,
}: SupplyManagerActionModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);

  const [name, setName] = useState("");
  const [itemCategory, setItemCategory] = useState<SupplyCategory>("FEED");
  const [unit, setUnit] = useState("");
  const [threshold, setThreshold] = useState("10");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (mode === "item-edit" && item) {
        setName(item.name);
        setItemCategory(item.category);
        setUnit(item.unit);
        setThreshold(String(item.reorderThreshold));
      } else if (mode === "item-create") {
        setName("");
        setItemCategory("FEED");
        setUnit("");
        setThreshold("10");
        setQuantity("");
        setUnitPrice("");
      } else if (mode === "fulfill" && request) {
        setQuantity(String(request.quantity ?? ""));
        setUnitPrice("");
      } else if (mode === "reject" || mode === "cancel-request") {
        setRequestReason("");
      }
    }
  }, [visible, mode, item, request]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!token) return;
    const limit = parseFloat(threshold);
    const amount = parseFloat(quantity);
    const price = parseInt(unitPrice || "0", 10);

    setSaving(true);
    try {
      if (mode === "item-create" || mode === "item-edit") {
        if (
          !name.trim() ||
          !unit.trim() ||
          !Number.isFinite(limit) ||
          limit < 0 ||
          limit > 1_000_000_000
        ) {
          Alert.alert(
            "Check supply details",
            "Enter a name, unit, and non-negative reorder threshold.",
          );
          return;
        }
        if (mode === "item-create") {
          const openingAmount = Number(quantity);
          if (
            !Number.isFinite(openingAmount) ||
            openingAmount < 0 ||
            openingAmount > 1_000_000_000 ||
            !Number.isInteger(price) ||
            price < 0 ||
            price > 1_000_000_000
          ) {
            Alert.alert(
              "Check opening stock",
              "Enter a non-negative starting quantity and a whole VND unit price.",
            );
            return;
          }
          await suppliesService.createItem(token, {
            name: name.trim(),
            category: itemCategory,
            unit: unit.trim(),
            quantityOnHand: openingAmount,
            openingUnitPrice: price,
            reorderThreshold: limit,
          });
        } else if (item) {
          await suppliesService.updateItem(token, item.id, {
            name: name.trim(),
            category: itemCategory,
            unit: unit.trim(),
            reorderThreshold: limit,
          });
        }
      } else if (mode === "reject" && request) {
        if (!requestReason.trim()) {
          Alert.alert("Reason required", "Enter a reason before rejecting this request.");
          return;
        }
        await suppliesService.updateRequestStatus(token, request.id, "REJECTED", {
          reason: requestReason.trim(),
        });
      } else if (mode === "fulfill" && request) {
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
          Alert.alert("Check quantity", "Enter a positive quantity issued.");
          return;
        }
        if (!Number.isInteger(price) || price < 0 || price > 1_000_000_000) {
          Alert.alert("Check unit price", "Enter the actual whole VND price paid for each unit.");
          return;
        }
        await suppliesService.updateRequestStatus(token, request.id, "FULFILLED", {
          quantity: amount,
          unitPrice: price,
        });
      } else if (mode === "cancel-request" && request) {
        if (!requestReason.trim()) {
          Alert.alert(t("Lý do bắt buộc"), t("Vui lòng nhập lý do hủy đề xuất đã duyệt."));
          return;
        }
        await suppliesService.updateRequestStatus(token, request.id, "CANCELLED", {
          reason: requestReason.trim(),
        });
      }
      onSuccess();
      onClose();
    } catch (error) {
      showApiError(error, "Could not save inventory change");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={
        mode === "item-create" ||
        mode === "item-edit" ||
        mode === "reject" ||
        mode === "fulfill" ||
        mode === "cancel-request"
      }
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Close")}
          onPress={handleClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>
                {t(
                  mode === "item-create"
                    ? "Add supply item"
                    : mode === "item-edit"
                      ? "Edit supply item"
                      : mode === "reject"
                        ? "Reject request"
                        : mode === "cancel-request"
                          ? "Hủy đề xuất đã duyệt"
                          : "Confirm supply issued",
                )}
              </Text>
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {item?.name ?? request?.item.name}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Close")}
              onPress={handleClose}
              style={styles.sheetCloseBtn}
            >
              <Ionicons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: space.md }}
          >
            {mode === "item-create" || mode === "item-edit" ? (
              <>
                <Field label="Item name">
                  <NativeInput value={name} onChangeText={setName} placeholder="e.g. Oat feed" />
                </Field>
                <View style={ui.section}>
                  <SectionTitle>Category</SectionTitle>
                  <Chips
                    options={CATEGORIES.map(supplyCategoryLabel)}
                    value={supplyCategoryLabel(itemCategory)}
                    onChange={(value) =>
                      setItemCategory(
                        CATEGORIES.find((c) => supplyCategoryLabel(c) === value) ?? "FEED",
                      )
                    }
                  />
                </View>
                <Field label="Unit">
                  <NativeInput
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="kg, bottle, roll"
                  />
                </Field>
                <Field label="Low stock threshold">
                  <NativeInput
                    value={threshold}
                    onChangeText={setThreshold}
                    keyboardType="decimal-pad"
                  />
                </Field>
                {mode === "item-create" ? (
                  <>
                    <Field label="Opening quantity">
                      <NativeInput
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="decimal-pad"
                      />
                    </Field>
                    <Field label="Opening unit price (VND)">
                      <NativeInput
                        value={unitPrice}
                        onChangeText={setUnitPrice}
                        keyboardType="numeric"
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : null}

            {mode === "reject" || mode === "cancel-request" ? (
              <Field
                label={
                  mode === "reject"
                    ? t("Rejection reason (required)")
                    : `${t("Lý do hủy (bắt buộc)")} *`
                }
              >
                <NativeInput
                  value={requestReason}
                  onChangeText={setRequestReason}
                  multiline
                  placeholder={
                    mode === "reject"
                      ? t("Nhập lý do từ chối...")
                      : t("Nhập lý do hủy (vd: Nhà cung cấp hết hàng...)")
                  }
                />
              </Field>
            ) : null}

            {mode === "fulfill" ? (
              <>
                <Panel>
                  <Text style={ui.muted}>
                    {request?.item.name}
                    {request?.quantity
                      ? ` · requested ${request.quantity} ${request.item.unit}`
                      : ""}
                  </Text>
                </Panel>
                <Field
                  label={`${t("Quantity issued")} (${request?.item.unit ?? "unit"})`}
                >
                  <NativeInput
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                  />
                </Field>
                <Field label="Actual unit price paid (VND)">
                  <NativeInput
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="numeric"
                  />
                </Field>
              </>
            ) : null}

            <View style={{ gap: space.sm, marginTop: space.sm }}>
              <PrimaryButton
                label={saving ? "Saving…" : "Save"}
                icon="checkmark"
                onPress={() => void handleSave()}
                disabled={
                  saving ||
                  ((mode === "reject" || mode === "cancel-request") && !requestReason.trim())
                }
              />
              <SecondaryButton label="Cancel" icon="close" onPress={handleClose} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
