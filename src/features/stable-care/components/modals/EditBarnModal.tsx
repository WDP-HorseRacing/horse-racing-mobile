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
import { stableService, type BarnListItemDto } from "@/services/stable.service";

type BarnStatus = "ACTIVE" | "MAINTENANCE" | "CLOSED";

export type EditBarnModalProps = {
  visible: boolean;
  onClose: () => void;
  barn: BarnListItemDto | null;
  token: string | null;
  activeHeadTrainers: { id: string; fullName: string }[];
  onBarnSaved: () => Promise<unknown>;
};

export function EditBarnModal({
  visible,
  onClose,
  barn,
  token,
  activeHeadTrainers,
  onBarnSaved,
}: EditBarnModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  const [editBarnName, setEditBarnName] = useState("");
  const [editBarnCapacity, setEditBarnCapacity] = useState("9");
  const [editBarnStatus, setEditBarnStatus] = useState<BarnStatus>("ACTIVE");
  const [editBarnHeadTrainerId, setEditBarnHeadTrainerId] = useState("");
  const [editBarnDescription, setEditBarnDescription] = useState("");
  const [savingBarn, setSavingBarn] = useState(false);

  useEffect(() => {
    if (visible && barn) {
      setEditBarnName(barn.name);
      setEditBarnCapacity(String(barn.capacity ?? 9));
      setEditBarnStatus(barn.status as BarnStatus);
      setEditBarnHeadTrainerId(barn.headTrainerId ?? "");
      setEditBarnDescription(barn.description ?? "");
    }
  }, [visible, barn]);

  const handleSaveBarn = async () => {
    if (!token || !barn || !editBarnName.trim()) return;
    const capacityNum = parseInt(editBarnCapacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1 || capacityNum > 9) {
      Alert.alert(t("Invalid capacity"), t("Barn capacity must be between 1 and 9 stalls."));
      return;
    }
    setSavingBarn(true);
    try {
      await stableService.updateBarn(token, barn.id, {
        name: editBarnName.trim(),
        capacity: capacityNum,
        status: editBarnStatus,
        headTrainerId: editBarnHeadTrainerId || null,
        description: editBarnDescription.trim() || undefined,
      });
      await onBarnSaved();
      onClose();
      Alert.alert(t("Thành công"), t("Đã cập nhật thông tin khu chuồng."));
    } catch (err) {
      Alert.alert(t("Lỗi cập nhật khu chuồng"), extractErrorMessage(err));
    } finally {
      setSavingBarn(false);
    }
  };

  if (!barn) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        Keyboard.dismiss();
        if (!savingBarn) onClose();
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
            if (!savingBarn) onClose();
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
                <Text style={styles.modalTitle}>{t("Chỉnh sửa khu chuồng")}</Text>
                <Text style={uiStyles.muted}>{barn.name}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                disabled={savingBarn}
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
              <Field label={t("Barn name")}>
                <NativeInput
                  value={editBarnName}
                  onChangeText={setEditBarnName}
                  placeholder={t("e.g. Barn A")}
                />
              </Field>

              <Field label={t("Capacity (1–9 stalls)")}>
                <NativeInput
                  value={editBarnCapacity}
                  onChangeText={setEditBarnCapacity}
                  keyboardType="number-pad"
                  placeholder="9"
                />
              </Field>

              <Field label={t("Trạng thái khu")}>
                <Chips
                  options={["ACTIVE", "MAINTENANCE", "CLOSED"]}
                  value={editBarnStatus}
                  onChange={(val) => setEditBarnStatus(val as BarnStatus)}
                />
              </Field>

              <Field label={t("Head Trainer phụ trách")}>
                <View style={{ gap: space.xs }}>
                  <Chips
                    options={[
                      t("Không gán HLV"),
                      ...activeHeadTrainers.map((ht) => ht.fullName),
                    ]}
                    value={
                      activeHeadTrainers.find((ht) => ht.id === editBarnHeadTrainerId)?.fullName ??
                      t("Không gán HLV")
                    }
                    onChange={(label) => {
                      if (label === t("Không gán HLV")) {
                        setEditBarnHeadTrainerId("");
                      } else {
                        const ht = activeHeadTrainers.find((item) => item.fullName === label);
                        if (ht) setEditBarnHeadTrainerId(ht.id);
                      }
                    }}
                  />
                </View>
              </Field>

              <Field label={t("Description")}>
                <NativeInput
                  value={editBarnDescription}
                  onChangeText={setEditBarnDescription}
                  placeholder={t("Description")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={savingBarn ? t("Saving…") : t("Save changes")}
                  icon="checkmark"
                  disabled={savingBarn || !editBarnName.trim()}
                  onPress={() => void handleSaveBarn()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={savingBarn}
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
  });

export default EditBarnModal;
