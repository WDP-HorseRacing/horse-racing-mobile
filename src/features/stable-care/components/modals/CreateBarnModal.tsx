import { useState } from "react";
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
import { stableService } from "@/services/stable.service";

export type CreateBarnModalProps = {
  visible: boolean;
  onClose: () => void;
  token: string | null;
  activeHeadTrainers: { id: string; fullName: string }[];
  onBarnCreated: () => Promise<unknown>;
};

export function CreateBarnModal({
  visible,
  onClose,
  token,
  activeHeadTrainers,
  onBarnCreated,
}: CreateBarnModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  const [newBarnName, setNewBarnName] = useState("");
  const [newBarnDescription, setNewBarnDescription] = useState("");
  const [newBarnCapacity, setNewBarnCapacity] = useState("9");
  const [newBarnHeadTrainerId, setNewBarnHeadTrainerId] = useState("");
  const [creatingBarn, setCreatingBarn] = useState(false);

  const handleCreateBarn = async () => {
    if (!token || !newBarnName.trim()) return;
    const capacityNum = parseInt(newBarnCapacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1 || capacityNum > 9) {
      Alert.alert(t("Invalid capacity"), t("Barn capacity must be between 1 and 9 stalls."));
      return;
    }
    setCreatingBarn(true);
    try {
      const created = await stableService.createBarn(token, {
        name: newBarnName.trim(),
        description: newBarnDescription.trim() || undefined,
        capacity: capacityNum,
      });
      if (newBarnHeadTrainerId) {
        await stableService.updateBarn(token, created.id, {
          headTrainerId: newBarnHeadTrainerId,
        });
      }
      await onBarnCreated();
      setNewBarnName("");
      setNewBarnDescription("");
      setNewBarnCapacity("9");
      setNewBarnHeadTrainerId("");
      onClose();
      Alert.alert(t("Thành công"), t("Đã tạo khu chuồng mới thành công."));
    } catch (err) {
      Alert.alert(t("Lỗi tạo khu chuồng"), extractErrorMessage(err));
    } finally {
      setCreatingBarn(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        Keyboard.dismiss();
        if (!creatingBarn) onClose();
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
            if (!creatingBarn) onClose();
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
                <Text style={styles.modalTitle}>{t("Create barn")}</Text>
                <Text style={uiStyles.muted}>{t("Add a new barn zone")}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                disabled={creatingBarn}
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
                  value={newBarnName}
                  onChangeText={setNewBarnName}
                  placeholder={t("e.g. Barn D")}
                />
              </Field>

              <Field label={t("Capacity (max stalls)")}>
                <NativeInput
                  value={newBarnCapacity}
                  onChangeText={setNewBarnCapacity}
                  placeholder={t("1–9 stalls (default is 9)")}
                  keyboardType="numeric"
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
                      activeHeadTrainers.find((ht) => ht.id === newBarnHeadTrainerId)?.fullName ??
                      t("Không gán HLV")
                    }
                    onChange={(label) => {
                      if (label === t("Không gán HLV")) {
                        setNewBarnHeadTrainerId("");
                      } else {
                        const ht = activeHeadTrainers.find((item) => item.fullName === label);
                        if (ht) setNewBarnHeadTrainerId(ht.id);
                      }
                    }}
                  />
                </View>
              </Field>

              <Field label={t("Description")}>
                <NativeInput
                  value={newBarnDescription}
                  onChangeText={setNewBarnDescription}
                  placeholder={t("Location, facilities…")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={creatingBarn ? t("Creating…") : t("Create barn")}
                  icon="add"
                  disabled={creatingBarn || !newBarnName.trim()}
                  onPress={() => void handleCreateBarn()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={creatingBarn}
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

export default CreateBarnModal;
