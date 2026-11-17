import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { BottomSheetModal, SecondaryButton } from "@/components/ui";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { mediaService, type LocalMediaAsset } from "@/services/media.service";
import { extractErrorMessage } from "@/utils/errorHandler";

export function ChecklistEvidenceSheet({
  visible,
  saving,
  onClose,
  onComplete,
}: {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onComplete: (photo: LocalMediaAsset | null) => void | Promise<void>;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [photo, setPhoto] = useState<LocalMediaAsset | null>(null);

  useEffect(() => {
    if (visible) setPhoto(null);
  }, [visible]);

  const choosePhoto = async (source: "camera" | "library") => {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t("Permission required"),
          t(
            source === "camera"
              ? "Permission to use the camera is required to take photos."
              : "Permission to access the photo library is required to attach photos.",
          ),
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: false,
              quality: 0.8,
            });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      let size = asset.fileSize;
      if (!size) {
        try {
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (info.exists && !info.isDirectory) size = info.size;
        } catch {}
      }
      const extension = asset.mimeType?.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      setPhoto({
        name: asset.fileName || `checklist-evidence-${Date.now()}.${extension}`,
        uri: asset.uri,
        size,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    } catch (error) {
      Alert.alert(t("Could not choose photo"), extractErrorMessage(error));
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      title="Complete checklist task"
      saveLabel={t("Save")}
      saveLoading={saving}
      saveDisabled={saving}
      cancelLabel="Cancel"
      onClose={() => {
        if (!saving) onClose();
      }}
      onSave={() => void onComplete(photo)}
    >
      <View style={styles.content}>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t("Attach an optional photo to show this task has been completed.")}
        </Text>
        {photo ? (
          <View style={[styles.previewRow, { backgroundColor: colors.muted }]}>
            <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.photoDetails}>
              <Text style={[styles.photoName, { color: colors.foreground }]} numberOfLines={2}>
                {photo.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Remove photo")}
                disabled={saving}
                onPress={() => setPhoto(null)}
                style={styles.removeButton}
              >
                <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                <Text style={[styles.removeButtonText, { color: colors.destructive }]}>
                  {t("Remove photo")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.actions}>
          {Platform.OS !== "web" ? (
            <SecondaryButton
              label="Take photo"
              icon="camera-outline"
              disabled={saving}
              onPress={() => void choosePhoto("camera")}
              style={styles.actionButton}
            />
          ) : null}
          <SecondaryButton
            label="Choose from library"
            icon="image-outline"
            disabled={saving}
            onPress={() => void choosePhoto("library")}
            style={styles.actionButton}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

export function ChecklistEvidenceLink({
  token,
  mediaId,
  photoUrl,
  style,
}: {
  token: string | null;
  mediaId: string | null | undefined;
  photoUrl?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  if ((!mediaId && !photoUrl) || !token) return null;

  const showPhoto = async () => {
    if (photoUrl) {
      setUrl(photoUrl);
      setVisible(true);
      return;
    }
    if (!mediaId) return;
    setLoading(true);
    try {
      const result = await mediaService.downloadUrl(token, mediaId);
      setUrl(result.url);
      setVisible(true);
    } catch (error) {
      Alert.alert(t("Could not load evidence photo"), extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("View evidence photo")}
        disabled={loading}
        onPress={() => void showPhoto()}
        style={[
          styles.evidenceLink,
          {
            backgroundColor: colors.fitSoft,
            borderColor: colors.fit,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.fit} />
        ) : (
          <Ionicons name="image-outline" size={13} color={colors.fit} />
        )}
        <Text style={[styles.evidenceLinkText, { color: colors.fit }]}>
          {t("Evidence photo")}
        </Text>
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.photoModal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Close")}
            onPress={() => setVisible(false)}
            style={styles.closePhoto}
          >
            <Ionicons name="close" size={25} color="#FFFFFF" />
          </Pressable>
          {url ? (
            <Image source={{ uri: url }} style={styles.fullPhoto} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingBottom: space.sm },
  hint: { fontSize: 14, lineHeight: 20 },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(127, 127, 127, 0.08)",
  },
  preview: { width: 76, height: 76, borderRadius: radius.sm, backgroundColor: "#E5E7EB" },
  photoDetails: { flex: 1, minWidth: 0, gap: space.sm },
  photoName: { fontSize: 13, fontWeight: "600" },
  removeButton: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  removeButtonText: { fontSize: 13, fontWeight: "700" },
  actions: { gap: space.xs },
  actionButton: { marginVertical: 0 },
  evidenceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  evidenceLinkText: { fontSize: 11, fontWeight: "700" },
  photoModal: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
    justifyContent: "center",
    alignItems: "center",
    padding: space.md,
  },
  fullPhoto: { width: "100%", height: "82%" },
  closePhoto: {
    position: "absolute",
    right: space.md,
    top: 54,
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
});
