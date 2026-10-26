import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  DimensionValue,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { radius, space } from "@/config/theme";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";

export type BottomSheetModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  saveLoading?: boolean;
  children: React.ReactNode;
  maxHeight?: DimensionValue;
};

export function BottomSheetModal({
  visible,
  title,
  onClose,
  onSave,
  saveLabel,
  cancelLabel,
  saveDisabled = false,
  saveLoading = false,
  children,
  maxHeight = "85%",
}: BottomSheetModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
    }
  }, [visible, panY]);

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 0,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            panY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 60 || gesture.vy > 0.5) {
            Animated.timing(panY, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              panY.setValue(0);
              onClose();
            });
          } else {
            Animated.spring(panY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [onClose, panY],
  );

  const headerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            panY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 60 || gesture.vy > 0.5) {
            Animated.timing(panY, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              panY.setValue(0);
              onClose();
            });
          } else {
            Animated.spring(panY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [onClose, panY],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Close")}
          onPress={saveLoading ? undefined : onClose}
          style={styles.backdrop}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              maxHeight,
              borderColor: colors.border,
              transform: [{ translateY: panY }],
            },
          ]}
        >
          {/* Top drag handle indicator - drag down or tap to dismiss */}
          <View style={styles.handleContainer} {...handlePanResponder.panHandlers}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          </View>

          {/* Top Header Bar: Left = Cancel, Center = Title, Right = Save */}
          <View
            style={[styles.header, { borderBottomColor: colors.border }]}
            {...headerPanResponder.panHandlers}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(cancelLabel ?? "Cancel")}
              hitSlop={12}
              onPress={onClose}
              disabled={saveLoading}
              style={styles.cancelBtn}
            >
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>
                {cancelLabel ?? t("Cancel")}
              </Text>
            </Pressable>

            <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {title}
            </Text>

            {onSave ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(saveLabel ?? "Save")}
                hitSlop={12}
                onPress={onSave}
                disabled={saveDisabled || saveLoading}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: saveDisabled ? colors.border : colors.primary,
                    opacity: saveDisabled || saveLoading ? 0.6 : 1,
                  },
                ]}
              >
                {saveLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>{saveLabel ?? t("Save")}</Text>
                )}
              </Pressable>
            ) : (
              <View style={styles.saveBtnPlaceholder} />
            )}
          </View>

          {/* Scrollable form body */}
          <ScrollView
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    minWidth: 64,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "500",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginHorizontal: 8,
  },
  saveBtn: {
    minWidth: 70,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  saveBtnPlaceholder: {
    minWidth: 64,
  },
  scrollContent: {
    padding: space.md,
    paddingBottom: 40,
    gap: space.md,
  },
});
