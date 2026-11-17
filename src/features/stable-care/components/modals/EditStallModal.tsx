import { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import {
  Chips,
  Field,
  NativeInput,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { extractErrorMessage } from "@/utils/errorHandler";
import { stableService, type StallDto } from "@/services/stable.service";

type StallType = "STANDARD" | "ISOLATION" | "RECOVERY";

export type EditStallModalProps = {
  visible: boolean;
  onClose: () => void;
  stall: StallDto | null;
  token: string | null;
  onStallSaved: () => Promise<unknown>;
};

export function EditStallModal({
  visible,
  onClose,
  stall,
  token,
  onStallSaved,
}: EditStallModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  const [editStallCode, setEditStallCode] = useState("");
  const [editStallType, setEditStallType] = useState<StallType>("STANDARD");
  const [editStallHasCamera, setEditStallHasCamera] = useState(false);
  const [editStallDescription, setEditStallDescription] = useState("");
  const [savingStall, setSavingStall] = useState(false);

  useEffect(() => {
    if (visible && stall) {
      setEditStallCode(stall.code);
      setEditStallType(stall.type as StallType);
      setEditStallHasCamera(stall.hasCamera);
      setEditStallDescription(stall.description ?? "");
    }
  }, [visible, stall]);

  const handleSaveStall = async () => {
    if (!token || !stall || !editStallCode.trim()) return;
    setSavingStall(true);
    try {
      await stableService.updateStall(token, stall.id, {
        code: editStallCode.trim(),
        type: editStallType,
        hasCamera: editStallHasCamera,
        description: editStallDescription.trim() || undefined,
      });
      await onStallSaved();
      onClose();
      Alert.alert(t("Thành công"), t("Đã cập nhật thông tin ô chuồng."));
    } catch (err) {
      Alert.alert(t("Lỗi cập nhật ô chuồng"), extractErrorMessage(err));
    } finally {
      setSavingStall(false);
    }
  };

  if (!stall) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        Keyboard.dismiss();
        if (!savingStall) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            Keyboard.dismiss();
            if (!savingStall) onClose();
          }}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => {
              e.stopPropagation();
              Keyboard.dismiss();
            }}
          >
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("Sửa ô chuồng")}</Text>
                <Text style={uiStyles.muted}>{stall.code}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                disabled={savingStall}
                onPress={() => {
                  Keyboard.dismiss();
                  onClose();
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}
            >
              <Field label={t("Stall code")}>
                <NativeInput
                  value={editStallCode}
                  onChangeText={setEditStallCode}
                  placeholder="A-01"
                />
              </Field>

              <Field label={t("Stall type")}>
                <Chips
                  options={["STANDARD", "ISOLATION", "RECOVERY"]}
                  value={editStallType}
                  onChange={(val) => setEditStallType(val as StallType)}
                />
              </Field>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.switchTitle}>{t("Stall has surveillance camera")}</Text>
                  <Text style={uiStyles.muted}>{t("Giám sát camera 24/7")}</Text>
                </View>
                <Switch
                  value={editStallHasCamera}
                  onValueChange={setEditStallHasCamera}
                  disabled={savingStall}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <Field label={t("Description")}>
                <NativeInput
                  value={editStallDescription}
                  onChangeText={setEditStallDescription}
                  placeholder={t("Notes, camera angle…")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={savingStall ? t("Saving…") : t("Save changes")}
                  icon="checkmark"
                  disabled={savingStall || !editStallCode.trim()}
                  onPress={() => void handleSaveStall()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={savingStall}
                  onPress={() => {
                    Keyboard.dismiss();
                    onClose();
                  }}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      paddingBottom: space.xl,
      gap: space.md,
      maxHeight: "85%",
    },
    modalHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingBottom: space.sm,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
    },
    modalCloseBtn: {
      padding: 4,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: space.xs,
      gap: space.md,
    },
    switchTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
    },
  });

export default EditStallModal;
