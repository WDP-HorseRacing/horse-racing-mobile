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
import { stableService, type BarnListItemDto, type StallDto } from "@/services/stable.service";

type StallType = "STANDARD" | "ISOLATION" | "RECOVERY";

export type CreateStallModalProps = {
  visible: boolean;
  onClose: () => void;
  targetBarn: BarnListItemDto | null;
  token: string | null;
  suggestedCode?: string;
  onStallCreated: () => Promise<unknown>;
};

export function CreateStallModal({
  visible,
  onClose,
  targetBarn,
  token,
  suggestedCode = "",
  onStallCreated,
}: CreateStallModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  const [newStallCode, setNewStallCode] = useState(suggestedCode);
  const [newStallType, setNewStallType] = useState<StallType>("STANDARD");
  const [newStallHasCamera, setNewStallHasCamera] = useState(false);
  const [newStallDescription, setNewStallDescription] = useState("");
  const [creatingStall, setCreatingStall] = useState(false);

  useEffect(() => {
    if (visible && suggestedCode) {
      setNewStallCode(suggestedCode);
    }
  }, [visible, suggestedCode]);

  const handleCreateStall = async () => {
    if (!token || !targetBarn || !newStallCode.trim()) return;
    setCreatingStall(true);
    try {
      await stableService.createStall(token, {
        barnId: targetBarn.id,
        code: newStallCode.trim(),
        type: newStallType,
        hasCamera: newStallHasCamera,
        description: newStallDescription.trim() || undefined,
      });
      await onStallCreated();
      setNewStallCode("");
      setNewStallType("STANDARD");
      setNewStallHasCamera(false);
      setNewStallDescription("");
      onClose();
      Alert.alert(t("Thành công"), t("Đã tạo ô chuồng mới thành công."));
    } catch (err) {
      Alert.alert(t("Lỗi tạo ô chuồng"), extractErrorMessage(err));
    } finally {
      setCreatingStall(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        Keyboard.dismiss();
        if (!creatingStall) onClose();
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
            if (!creatingStall) onClose();
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
                <Text style={styles.modalTitle}>{t("Create stall")}</Text>
                <Text style={uiStyles.muted}>
                  {t("Add stall to")} {targetBarn?.name}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                disabled={creatingStall}
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
                  value={newStallCode}
                  onChangeText={setNewStallCode}
                  placeholder="A-01"
                />
              </Field>

              <Field label={t("Stall type")}>
                <Chips
                  options={["STANDARD", "ISOLATION", "RECOVERY"]}
                  value={newStallType}
                  onChange={(val) => setNewStallType(val as StallType)}
                />
              </Field>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.switchTitle}>{t("Stall has surveillance camera")}</Text>
                  <Text style={uiStyles.muted}>{t("New stalls are available by default")}</Text>
                </View>
                <Switch
                  value={newStallHasCamera}
                  onValueChange={setNewStallHasCamera}
                  disabled={creatingStall}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <Field label={t("Description")}>
                <NativeInput
                  value={newStallDescription}
                  onChangeText={setNewStallDescription}
                  placeholder={t("Notes, camera angle…")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={creatingStall ? t("Creating…") : t("Create stall")}
                  icon="add"
                  disabled={creatingStall || !newStallCode.trim()}
                  onPress={() => void handleCreateStall()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={creatingStall}
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

export default CreateStallModal;
