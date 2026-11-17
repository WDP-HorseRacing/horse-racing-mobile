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
import { Field, NativeInput, PrimaryButton, SecondaryButton } from "@/components/ui";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/config/theme";
import { suppliesService } from "@/services/supplies.service";
import { type SupplyItemDto, type SupplyRequestDto } from "@/adapters/supplies.adapter";
import { formatQuantity } from "@/utils/formatters";
import { extractErrorMessage } from "@/utils/errorHandler";

const REQUEST_REASON_SUGGESTIONS = ["Low stock risk", "Demand increase", "Next week reserve"];

interface ProposeRestockModalProps {
  visible: boolean;
  mode: "request" | "request-edit" | null;
  item: SupplyItemDto | null;
  request: SupplyRequestDto | null;
  token: string;
  styles: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProposeRestockModal({
  visible,
  mode,
  item,
  request,
  token,
  styles,
  onClose,
  onSuccess,
}: ProposeRestockModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setNote(request?.note ?? "");
    }
  }, [visible, request]);

  const handleClose = () => {
    setNote("");
    onClose();
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      if (mode === "request" && item) {
        await suppliesService.createRequest(token, item.id, note.trim() || undefined);
      } else if (mode === "request-edit" && request) {
        await suppliesService.editRequest(token, request.id, {
          note: note.trim() || undefined,
        });
      }
      setNote("");
      onSuccess();
      onClose();
    } catch (error) {
      Alert.alert("Failed to save", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const currentItem = item ?? (request?.item as unknown as SupplyItemDto);

  return (
    <Modal
      visible={visible && Boolean(item || request)}
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
              <Text style={styles.sheetTitle}>{t("Propose restock")}</Text>
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {currentItem?.name}
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
            {item ? (
              <View style={styles.infoBanner}>
                <Ionicons name="cube-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoBannerLabel}>{t("Available in stock:")}</Text>
                  <Text style={styles.infoBannerValue}>
                    {formatQuantity(item.quantityOnHand, item.unit)}
                    <Text style={[styles.infoBannerLabel, { fontWeight: "normal" }]}>
                      {"  ·  "}
                      {t("reorder threshold")}{" "}
                      {formatQuantity(item.reorderThreshold, item.unit)}
                    </Text>
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Note / Reason */}
            <Field label={t("Restock reason (optional)")}>
              <NativeInput
                value={note}
                onChangeText={setNote}
                multiline
                placeholder={t("Reason or note")}
              />
            </Field>

            <View style={styles.quickChipsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickChipsScroll}
              >
                {REQUEST_REASON_SUGGESTIONS.map((sug) => (
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

            {/* Actions */}
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              <PrimaryButton
                label={saving ? "Saving…" : "Submit request"}
                icon="paper-plane-outline"
                onPress={() => void handleSave()}
                disabled={saving}
              />
              <SecondaryButton label="Cancel" icon="close" onPress={handleClose} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
