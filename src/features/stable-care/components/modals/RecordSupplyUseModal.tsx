import React, { useState } from "react";
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
import { Field, NativeInput, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/config/theme";
import { suppliesService } from "@/services/supplies.service";
import { supplyCategoryLabel, type SupplyItemDto } from "@/adapters/supplies.adapter";
import { formatQuantity } from "@/utils/formatters";
import { extractErrorMessage } from "@/utils/errorHandler";

const USE_QUICK_AMOUNTS = [1, 2, 5, 10];
const USE_NOTE_SUGGESTIONS = [
  "Daily feeding routine",
  "Post-training recovery",
  "Medical checkup dosage",
  "Stable maintenance",
  "First aid treatment",
];

interface RecordSupplyUseModalProps {
  visible: boolean;
  item: SupplyItemDto | null;
  token: string;
  styles: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordSupplyUseModal({
  visible,
  item,
  token,
  styles,
  onClose,
  onSuccess,
}: RecordSupplyUseModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);

  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const availableQty = item?.quantityOnHand ?? 0;
  const usedAmount = parseFloat(quantity) || 0;
  const remainingStock = availableQty - usedAmount;
  const isUsageOver = usedAmount > availableQty;
  const isUsageBelowThreshold =
    remainingStock <= (item?.reorderThreshold ?? 0) && remainingStock >= 0;

  const handleClose = () => {
    setQuantity("");
    setNote("");
    onClose();
  };

  const handleSave = async () => {
    if (!item || !token) return;
    const amount = parseFloat(quantity);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      Alert.alert("Check usage", "Enter a quantity greater than zero.");
      return;
    }
    if (amount > item.quantityOnHand) {
      Alert.alert("Check usage", "Quantity used cannot exceed available stock.");
      return;
    }
    if (!note.trim()) {
      Alert.alert(t("Check usage"), t("Usage note is required."));
      return;
    }
    setSaving(true);
    try {
      await suppliesService.use(token, item.id, {
        quantity: amount,
        note: note.trim(),
      });
      setQuantity("");
      setNote("");
      onSuccess();
      onClose();
    } catch (error) {
      Alert.alert("Failed to save", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible && Boolean(item)}
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
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sheetTitle}>{t("Record supply use")}</Text>
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {item?.name} ({t(supplyCategoryLabel(item?.category ?? "FEED"))})
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
            keyboardShouldPersistTaps="handled"
          >
            {/* Available Stock Banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="cube" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoBannerLabel}>{t("Available in stock:")}</Text>
                <Text style={styles.infoBannerValue}>
                  {formatQuantity(availableQty, item?.unit ?? "unit")}
                </Text>
              </View>
            </View>

            {/* Quantity Input */}
            <Field label={`${t("Quantity to use")} (${item?.unit ?? "unit"})`}>
              <NativeInput
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                placeholder="0.0"
              />
            </Field>

            {/* Quick Stepper Chips */}
            <View style={styles.quickChipsContainer}>
              <Text style={styles.quickChipsLabel}>{t("Quick add")}:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickChipsScroll}
              >
                {USE_QUICK_AMOUNTS.map((amt) => (
                  <Pressable
                    key={amt}
                    accessibilityRole="button"
                    onPress={() => setQuantity(String(amt))}
                    style={styles.quickChip}
                  >
                    <Text style={styles.quickChipText}>+{amt}</Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setQuantity(String(availableQty))}
                  style={[styles.quickChip, styles.quickChipMax]}
                >
                  <Text style={styles.quickChipTextMax}>{t("Use all")}</Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* Real-time Remaining Calculation & Alert Box */}
            {usedAmount > 0 ? (
              <View
                style={[
                  styles.calcBox,
                  isUsageOver && styles.calcBoxDanger,
                  isUsageBelowThreshold && !isUsageOver && styles.calcBoxWarning,
                ]}
              >
                <View style={ui.row}>
                  <Text style={styles.calcLabel}>{t("Remaining after use:")}</Text>
                  <Text
                    style={[
                      styles.calcValue,
                      isUsageOver && { color: colors.destructive },
                      isUsageBelowThreshold && !isUsageOver && { color: colors.monitor },
                    ]}
                  >
                    {formatQuantity(Math.max(0, remainingStock), item?.unit ?? "")}
                  </Text>
                </View>

                {isUsageOver ? (
                  <View style={styles.calcWarningRow}>
                    <Ionicons name="alert-circle" size={15} color={colors.destructive} />
                    <Text style={styles.calcWarningDangerText}>
                      {t("Exceeds available stock")}
                    </Text>
                  </View>
                ) : isUsageBelowThreshold ? (
                  <View style={styles.calcWarningRow}>
                    <Ionicons name="warning" size={15} color={colors.monitor} />
                    <Text style={styles.calcWarningText}>
                      {t("Stock below threshold warning")}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Usage Note & Suggestion Chips */}
            <Field label={`${t("Ghi chú xuất dùng (bắt buộc)")} *`}>
              <NativeInput
                value={note}
                onChangeText={setNote}
                multiline
                placeholder={t("Usage reason or horse name")}
              />
              {!note.trim() ? (
                <Text style={styles.fieldError}>
                  {t("Vui lòng nhập ghi chú hoặc lý do xuất dùng.")}
                </Text>
              ) : null}
            </Field>

            <View style={styles.quickChipsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickChipsScroll}
              >
                {USE_NOTE_SUGGESTIONS.map((sug) => (
                  <Pressable
                    key={sug}
                    accessibilityRole="button"
                    onPress={() => setNote((prev) => (prev ? `${prev}; ${t(sug)}` : t(sug)))}
                    style={styles.quickNoteChip}
                  >
                    <Text style={styles.quickNoteChipText}>+ {t(sug)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Modal Action Buttons */}
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              <PrimaryButton
                label={saving ? "Saving…" : "Confirm usage"}
                icon="checkmark"
                onPress={() => void handleSave()}
                disabled={saving || isUsageOver || usedAmount <= 0 || !note.trim()}
              />
              <SecondaryButton label="Cancel" icon="close" onPress={handleClose} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
