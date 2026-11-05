import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent, type WebViewProps } from "react-native-webview";
import MODEL_ASSET from "./assets/horse-anatomy-v2.glb";
import VIEWER_BUNDLE_ASSET from "./assets/injury-viewer.bundle.txt";
import { Text } from "@/components/common/LocalizedText";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { radius, space } from "@/config/theme";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import type { InjuryTimelineItemDto } from "@/adapters/medical.adapter";
import { formatEnum } from "@/utils/formatters";
import {
  INJURY_BODY_REGIONS,
  INJURY_MODEL_VERSION,
  type HorseLocalPosition,
  type InjuryBodyRegion,
  type InjuryDraftMarker,
  type InjuryRecoveryStatus,
  type InjuryType,
  type InjuryUpdateInput,
  type InjuryViewerMarker,
  type NativeToWebMessage,
} from "@/features/medical/injury-mapper/injury-mapper.types";
import { readInjuryPlacements } from "@/features/medical/injury-mapper/injury-model-metadata";
import {
  hasSameInjuryPosition,
  isValidInjuryDraft,
  isVerifiedInjuryPlacement,
} from "@/features/medical/injury-mapper/injury-mapper-policy";
import { parseWebToNativeMessage } from "@/features/medical/injury-mapper/injury-mapper-protocol";

const MODEL_CHUNK_SIZE = 96_000;
const BODY_REGIONS = [...INJURY_BODY_REGIONS];
const INJURY_KIND_OPTIONS = [
  "FRACTURE",
  "SPRAIN",
  "STRAIN",
  "WOUND",
  "LACERATION",
  "INFLAMMATION",
  "CONTUSION",
  "INFECTION",
  "OTHER",
];
const RECOVERY_OPTIONS = ["ACUTE", "RECOVERING", "HEALED"];
const EMPTY_INJURY_IDS = new Set<string>();

type Props = {
  horseId: string;
  existingInjuries: InjuryTimelineItemDto[];
  drafts: InjuryDraftMarker[];
  onDraftsChange: (markers: InjuryDraftMarker[]) => void;
  updates: InjuryUpdateInput[];
  onUpdatesChange: (updates: InjuryUpdateInput[]) => void;
  allowNew: boolean;
  allowFollowUpUpdates: boolean;
  historyUnavailable?: boolean;
};

type ReadyAssets = { bundleSource: string; modelBase64: string };

function isRegion(value: string): value is InjuryBodyRegion {
  return INJURY_BODY_REGIONS.some((item) => item === value);
}

function createViewerHtml(bundleSource: string): string {
  const safeBundle = bundleSource.replace(/<\/script/gi, "<\\/script");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; worker-src 'none'; frame-src 'none';">
<style>html,body,#viewer{width:100%;height:100%;margin:0;overflow:hidden;background:#f4f3ef}canvas{display:block;width:100%;height:100%;touch-action:none;outline:none;-webkit-user-select:none;user-select:none}</style>
</head>
<body><div id="viewer"><canvas id="horse-canvas" aria-label="3D horse injury map"></canvas></div>
<script>${safeBundle}</script>
</body>
</html>`;
}

function formatPosition(position: HorseLocalPosition): string {
  return `X ${position.x.toFixed(3)} · Y ${position.y.toFixed(3)} · Z ${position.z.toFixed(3)} m`;
}

export function Injury3DMapper({
  horseId,
  existingInjuries,
  drafts,
  onDraftsChange,
  updates,
  onUpdatesChange,
  allowNew,
  allowFollowUpUpdates,
  historyUnavailable = false,
}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const webViewRef = useRef<WebView<WebViewProps>>(null);
  const mountedRef = useRef(true);
  const sentModelRef = useRef(false);
  const lastFocusedMarkerId = useRef("");
  const nextDraftSequence = useRef(0);
  const [visible, setVisible] = useState(false);
  const [assets, setAssets] = useState<ReadyAssets | null>(null);
  const [assetError, setAssetError] = useState("");
  const [viewerReady, setViewerReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [viewerMode, setViewerMode] = useState<"rotate" | "mark">("rotate");
  const [selectedMarkerId, setSelectedMarkerId] = useState("");
  const [compatibility, setCompatibility] = useState<{
    horseId: string;
    injuryIds: Set<string>;
  } | null>(null);
  const compatibleIds =
    compatibility?.horseId === horseId ? compatibility.injuryIds : EMPTY_INJURY_IDS;

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleCloseModal = useCallback(() => {
    // Auto-confirm draft markers if valid and complete so user isn't blocked on submit
    const updated = drafts.map((draft) => {
      if (!draft.confirmed && isValidInjuryDraft({ ...draft, confirmed: true })) {
        return { ...draft, confirmed: true };
      }
      return draft;
    });
    onDraftsChange(updated);
    setVisible(false);
  }, [drafts, onDraftsChange]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      webViewRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!visible || assets) return;
    const loadAssets = async () => {
      setAssetError("");
      try {
        const modelAsset = Asset.fromModule(MODEL_ASSET);
        const bundleAsset = Asset.fromModule(VIEWER_BUNDLE_ASSET);
        await Promise.all([modelAsset.downloadAsync(), bundleAsset.downloadAsync()]);
        if (!modelAsset.localUri || !bundleAsset.localUri) {
          throw new Error("Could not access the bundled 3D model files.");
        }
        const [bundleSource, modelBase64] = await Promise.all([
          FileSystem.readAsStringAsync(bundleAsset.localUri, { encoding: "utf8" }),
          FileSystem.readAsStringAsync(modelAsset.localUri, { encoding: "base64" }),
        ]);
        if (!bundleSource || !modelBase64) throw new Error("The bundled 3D model is empty.");
        if (active) setAssets({ bundleSource, modelBase64 });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("Could not prepare the 3D model.");
        if (active) setAssetError(message);
      }
    };
    void loadAssets();
    return () => {
      active = false;
    };
  }, [assets, t, visible]);

  useEffect(() => {
    let active = true;
    if (!existingInjuries.length) return;
    void readInjuryPlacements(horseId).then((placements) => {
      if (!active) return;
      const compatible = new Set<string>();
      for (const injury of existingInjuries) {
        const placement = placements[injury.id];
        if (isVerifiedInjuryPlacement(injury, placement)) {
          compatible.add(injury.id);
        }
      }
      setCompatibility({ horseId, injuryIds: compatible });
    });
    return () => {
      active = false;
    };
  }, [existingInjuries, horseId]);

  const mappedExisting = useMemo(
    () => existingInjuries.filter((injury) => compatibleIds.has(injury.id)),
    [compatibleIds, existingInjuries],
  );
  const legacyExisting = useMemo(
    () => existingInjuries.filter((injury) => !compatibleIds.has(injury.id)),
    [compatibleIds, existingInjuries],
  );
  const sortedExistingInjuries = useMemo(() => {
    return [...existingInjuries].sort((a, b) => {
      const aHealed = a.currentRecoveryStatus === "HEALED" ? 1 : 0;
      const bHealed = b.currentRecoveryStatus === "HEALED" ? 1 : 0;
      if (aHealed !== bHealed) return aHealed - bHealed;
      return new Date(b.firstExamDate).getTime() - new Date(a.firstExamDate).getTime();
    });
  }, [existingInjuries]);
  const unhealedCount = useMemo(
    () => existingInjuries.filter((item) => item.currentRecoveryStatus !== "HEALED").length,
    [existingInjuries],
  );
  const selectedDraft = drafts.find((marker) => marker.id === selectedMarkerId) ?? null;
  const selectedSaved = mappedExisting.find((injury) => injury.id === selectedMarkerId) ?? null;
  const markersForViewer = useMemo<InjuryViewerMarker[]>(
    () => [
      ...mappedExisting.map((injury) => ({
        id: injury.id,
        source: "saved" as const,
        bodyRegion: injury.bodyRegion as InjuryBodyRegion,
        position: injury.position,
      })),
      ...drafts.map((draft) => ({
        id: draft.id,
        source: "draft" as const,
        bodyRegion: draft.bodyRegion,
        position: draft.position,
      })),
    ],
    [drafts, mappedExisting],
  );
  const html = useMemo(() => (assets ? createViewerHtml(assets.bundleSource) : ""), [assets]);

  const postToViewer = useCallback((message: NativeToWebMessage) => {
    webViewRef.current?.postMessage(JSON.stringify(message));
  }, []);

  const focusMarker = useCallback(
    (id: string) => {
      setSelectedMarkerId(id);
      if (visible && viewerReady && modelLoaded) {
        lastFocusedMarkerId.current = id;
        postToViewer({ type: "FOCUS_MARKER", id });
      } else {
        lastFocusedMarkerId.current = "";
      }
    },
    [modelLoaded, postToViewer, viewerReady, visible],
  );

  useEffect(() => {
    if (!visible || !viewerReady || !assets || sentModelRef.current) return;
    sentModelRef.current = true;
    const chunkCount = Math.ceil(assets.modelBase64.length / MODEL_CHUNK_SIZE);
    postToViewer({ type: "LOAD_MODEL_START", modelVersion: INJURY_MODEL_VERSION, chunkCount });
    for (let index = 0; index < chunkCount; index += 1) {
      if (!mountedRef.current) return;
      const start = index * MODEL_CHUNK_SIZE;
      const data = assets.modelBase64.slice(start, start + MODEL_CHUNK_SIZE);
      postToViewer({ type: "LOAD_MODEL_CHUNK", modelVersion: INJURY_MODEL_VERSION, index, data });
    }
  }, [assets, postToViewer, viewerReady, visible]);

  useEffect(() => {
    if (visible && viewerReady) postToViewer({ type: "LOAD_MARKERS", markers: markersForViewer });
  }, [markersForViewer, postToViewer, viewerReady, visible]);

  useEffect(() => {
    if (!selectedMarkerId) {
      lastFocusedMarkerId.current = "";
      return;
    }
    if (
      visible &&
      viewerReady &&
      modelLoaded &&
      selectedMarkerId !== lastFocusedMarkerId.current &&
      markersForViewer.some((marker) => marker.id === selectedMarkerId)
    ) {
      lastFocusedMarkerId.current = selectedMarkerId;
      postToViewer({ type: "FOCUS_MARKER", id: selectedMarkerId });
    }
  }, [markersForViewer, modelLoaded, postToViewer, selectedMarkerId, viewerReady, visible]);

  useEffect(() => {
    if (visible && viewerReady) postToViewer({ type: "SET_MODE", mode: viewerMode });
  }, [postToViewer, viewerMode, viewerReady, visible]);

  const updateDraft = (id: string, patch: Partial<InjuryDraftMarker>) => {
    onDraftsChange(drafts.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addFollowUpUpdate = (injury: InjuryTimelineItemDto) => {
    if (injury.currentRecoveryStatus === "HEALED") return;
    const existing = updates.find((item) => item.injuryId === injury.id);
    if (existing) {
      onUpdatesChange(updates.filter((item) => item.injuryId !== injury.id));
      return;
    }
    const latestNotes = injury.history.at(-1)?.notes?.trim();
    onUpdatesChange([
      ...updates,
      {
        injuryId: injury.id,
        recoveryStatus: injury.currentRecoveryStatus as InjuryRecoveryStatus,
        ...(latestNotes ? { notes: latestNotes } : {}),
      },
    ]);
  };

  const updateFollowUp = (injuryId: string, patch: Partial<InjuryUpdateInput>) => {
    onUpdatesChange(
      updates.map((item) => (item.injuryId === injuryId ? { ...item, ...patch } : item)),
    );
  };

  const onViewerMessage = (event: WebViewMessageEvent) => {
    const message = parseWebToNativeMessage(event.nativeEvent.data);
    if (!message) return;
    switch (message.type) {
      case "VIEWER_READY":
        sentModelRef.current = false;
        setViewerReady(true);
        setViewerError("");
        return;
      case "MODEL_LOADED":
        setModelLoaded(true);
        setViewerError("");
        return;
      case "POINT_SELECTED": {
        if (!allowNew || drafts.length >= 20) {
          if (drafts.length >= 20)
            Alert.alert(
              t("Marker limit reached"),
              t("A visit can contain at most 20 new injuries."),
            );
          return;
        }
        const duplicate = drafts.find((marker) =>
          hasSameInjuryPosition(marker.position, message.position),
        );
        if (duplicate) {
          setSelectedMarkerId(duplicate.id);
          return;
        }
        nextDraftSequence.current += 1;
        const id = `draft-${Date.now().toString(36)}-${nextDraftSequence.current}`;
        onDraftsChange([
          ...drafts,
          {
            id,
            bodyRegion: message.bodyRegion,
            position: message.position,
            injuryType: "",
            recoveryStatus: "ACUTE",
            notes: "",
            confirmed: false,
          },
        ]);
        setSelectedMarkerId(id);
        return;
      }
      case "MARKER_SELECTED":
        setSelectedMarkerId(message.id);
        return;
      case "VIEWER_ERROR":
        setViewerError(message.message || t("Could not load the 3D model."));
        return;
      default:
        return;
    }
  };

  const chooseMode = (nextMode: "rotate" | "mark") => {
    setViewerMode(nextMode);
    postToViewer({ type: "SET_MODE", mode: nextMode });
  };

  const removeSelectedDraft = () => {
    if (!selectedDraft) return;
    postToViewer({ type: "REMOVE_DRAFT_MARKER", id: selectedDraft.id });
    onDraftsChange(drafts.filter((marker) => marker.id !== selectedDraft.id));
    setSelectedMarkerId("");
  };

  return (
    <>
      <Panel style={styles.launchPanel}>
        <Text style={uiStyles.value}>{t("3D injury mapping")}</Text>
        <Text style={uiStyles.muted}>
          {t(
            "Place one or more points on the horse, then confirm the suggested body region and injury details.",
          )}
        </Text>
        <View style={styles.summaryRow}>
          <Text style={uiStyles.label}>
            {t("New markers")}: {drafts.length}/20
          </Text>
          <Text style={uiStyles.label}>
            {t("Saved markers")}: {mappedExisting.length}
          </Text>
        </View>
        {mappedExisting.length === 0 && existingInjuries.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.muted,
              padding: space.xs,
              borderRadius: radius.sm,
              marginTop: 4,
            }}
          >
            <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
            <Text style={{ fontSize: 11, color: colors.mutedForeground, flex: 1, lineHeight: 15 }}>
              Hồ sơ ghi nhận {existingInjuries.length} chẩn đoán tổn thương nhưng chưa được định vị tọa độ 3D trên mô hình.
            </Text>
          </View>
        ) : null}
        {historyUnavailable ? (
          <Text style={[uiStyles.muted, { color: colors.destructive }]}>
            {t(
              "Existing injury history could not be loaded. Check the connection before changing an existing injury.",
            )}
          </Text>
        ) : null}
        <PrimaryButton
          label={allowFollowUpUpdates ? "Open 3D map & recovery updates" : "Open 3D injury map"}
          icon="body-outline"
          onPress={() => setVisible(true)}
        />
      </Panel>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseModal}
        statusBarTranslucent={false}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={[
              styles.modalRoot,
              {
                paddingTop: Math.max(insets.top, space.sm),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close 3D injury map")}
                onPress={handleCloseModal}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                style={styles.headerButton}
              >
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
              <View style={styles.headerTitle}>
                <Text style={uiStyles.value} numberOfLines={1}>
                  {t("3D injury map")}
                </Text>
                <Text style={uiStyles.muted} numberOfLines={1}>
                  {t("Horse-local coordinates · metres")}
                </Text>
              </View>
              <View style={styles.headerRightActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Reset camera")}
                  onPress={() => postToViewer({ type: "RESET_CAMERA" })}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.headerButton}
                >
                  <Ionicons name="scan-outline" size={20} color={colors.foreground} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Done")}
                  onPress={handleCloseModal}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.headerDoneButton}
                >
                  <Text style={styles.headerDoneText}>{t("Done")}</Text>
                </Pressable>
              </View>
            </View>

          <View style={styles.modeBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: viewerMode === "rotate" }}
              onPress={() => chooseMode("rotate")}
              style={[styles.modeButton, viewerMode === "rotate" && styles.modeButtonActive]}
            >
              <Ionicons
                name="hand-left-outline"
                size={17}
                color={viewerMode === "rotate" ? "#fff" : colors.foreground}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  viewerMode === "rotate" && styles.modeButtonTextActive,
                ]}
              >
                {t("Rotate and zoom")}
              </Text>
            </Pressable>
            {allowNew ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: viewerMode === "mark" }}
                onPress={() => chooseMode("mark")}
                style={[styles.modeButton, viewerMode === "mark" && styles.modeButtonActive]}
              >
                <Ionicons
                  name="locate-outline"
                  size={17}
                  color={viewerMode === "mark" ? "#fff" : colors.foreground}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    viewerMode === "mark" && styles.modeButtonTextActive,
                  ]}
                >
                  {t("Mark injuries")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Marker Count & Status Badges */}
          <View style={styles.modalMarkerBadgeRow}>
            <View style={styles.savedMarkerBadge}>
              <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
              <Text style={styles.savedMarkerBadgeText}>
                {mappedExisting.length} đã lưu
              </Text>
            </View>
            <View style={styles.draftMarkerBadge}>
              <Ionicons name="flag" size={13} color={colors.monitor ?? "#d97706"} />
              <Text style={styles.draftMarkerBadgeText}>
                {drafts.length} bản nháp
              </Text>
            </View>
            {selectedMarkerId ? (
              <View style={styles.activeMarkerBadge}>
                <Ionicons name="location" size={13} color={colors.primary} />
                <Text style={styles.activeMarkerBadgeText} numberOfLines={1}>
                  Đang chọn: {selectedDraft ? formatEnum(t(selectedDraft.bodyRegion)) : "Điểm đã lưu"}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.viewerFrame,
              isKeyboardVisible && styles.viewerFrameKeyboard,
            ]}
          >
            {html ? (
              <WebView<WebViewProps>
                ref={webViewRef}
                source={{ html }}
                originWhitelist={["*"]}
                onShouldStartLoadWithRequest={(request) => request.url === "about:blank"}
                onLoadStart={() => {
                  sentModelRef.current = false;
                  lastFocusedMarkerId.current = "";
                  setViewerReady(false);
                  setModelLoaded(false);
                }}
                onMessage={onViewerMessage}
                onError={() => setViewerError(t("Could not load the 3D model."))}
                javaScriptEnabled
                domStorageEnabled={false}
                cacheEnabled={false}
                allowFileAccess={false}
                allowFileAccessFromFileURLs={false}
                allowUniversalAccessFromFileURLs={false}
                mixedContentMode="never"
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                style={styles.webView}
              />
            ) : null}
            {!assets || !modelLoaded || viewerError || assetError ? (
              <View pointerEvents="none" style={styles.loadingOverlay}>
                {assetError || viewerError ? (
                  <View style={styles.errorContent}>
                    <Text style={[uiStyles.muted, styles.errorText]}>
                      {assetError || viewerError}
                    </Text>
                    {allowNew ? (
                      <Text style={[uiStyles.muted, styles.errorText]}>
                        {t(
                          "The API requires a real 3D point. New injury markers cannot be saved until the model loads; close and reopen this map to retry.",
                        )}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <>
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text style={uiStyles.muted}>{t("Loading bundled 3D horse…")}</Text>
                  </>
                )}
              </View>
            ) : null}
          </View>

          <ScrollView
            style={[styles.editorScroll, isKeyboardVisible && styles.editorScrollKeyboard]}
            contentContainerStyle={[
              styles.editorContent,
              isKeyboardVisible && { paddingBottom: 160 },
            ]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
          >
            {allowNew ? (
              <Panel>
                <Text style={uiStyles.value}>
                  {t("Draft injury markers")}: {drafts.length}/20
                </Text>
                <Text style={uiStyles.muted}>
                  {viewerMode === "mark"
                    ? t("Tap the horse surface to add a marker. Dragging does not place a marker.")
                    : t("Choose Mark injuries to add points; drag to rotate and pinch to zoom.")}
                </Text>
                {!drafts.length ? (
                  <Text style={uiStyles.muted}>{t("No new injury points yet.")}</Text>
                ) : null}
                {drafts.map((draft, index) => (
                  <Pressable
                    key={draft.id}
                    accessibilityRole="button"
                    onPress={() => {
                      focusMarker(draft.id);
                    }}
                    style={[
                      styles.markerCard,
                      selectedMarkerId === draft.id && styles.markerCardActive,
                    ]}
                  >
                    <View style={styles.markerTitleRow}>
                      <Text style={[uiStyles.value, { flex: 1 }]}>
                        {t("New marker {value}").replace("{value}", String(index + 1))}
                      </Text>
                      <Ionicons
                        name={
                          selectedMarkerId === draft.id ? "radio-button-on" : "radio-button-off"
                        }
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={uiStyles.muted}>{formatPosition(draft.position)}</Text>
                    <Text style={uiStyles.muted}>
                      {t(draft.confirmed ? "Confirmed region" : "Suggested region")}:{" "}
                      {formatEnum(t(draft.bodyRegion))}
                    </Text>
                  </Pressable>
                ))}

                {selectedDraft ? (
                  <View style={styles.editorSection}>
                    <Text style={uiStyles.value}>{t("Confirm selected marker")}</Text>
                    <Field label="Body region (confirm or change)">
                      <Chips
                        options={BODY_REGIONS}
                        value={selectedDraft.bodyRegion}
                        onChange={(value) => {
                          if (isRegion(value))
                            updateDraft(selectedDraft.id, { bodyRegion: value, confirmed: false });
                        }}
                      />
                    </Field>
                    <Field label="Injury type">
                      <Chips
                        options={INJURY_KIND_OPTIONS}
                        value={selectedDraft.injuryType}
                        onChange={(value) => {
                          if (INJURY_KIND_OPTIONS.includes(value))
                            updateDraft(selectedDraft.id, {
                              injuryType: value as InjuryType,
                              confirmed: false,
                            });
                        }}
                      />
                    </Field>
                    <Field label="Recovery status">
                      <Chips
                        options={RECOVERY_OPTIONS}
                        value={selectedDraft.recoveryStatus}
                        onChange={(value) => {
                          if (RECOVERY_OPTIONS.includes(value))
                            updateDraft(selectedDraft.id, {
                              recoveryStatus: value as InjuryRecoveryStatus,
                              confirmed: false,
                            });
                        }}
                      />
                    </Field>
                    <Field label="Injury clinical notes">
                      <NativeInput
                        value={selectedDraft.notes}
                        onChangeText={(notes) =>
                          updateDraft(selectedDraft.id, { notes: notes.slice(0, 1000) })
                        }
                        multiline
                        placeholder="Severity, swelling, palpation pain notes..."
                      />
                    </Field>
                    {selectedDraft.confirmed ? (
                      <View style={styles.confirmedNotice}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        <Text style={[uiStyles.muted, { color: colors.primary }]}>
                          {t("Marker details confirmed for this examination.")}
                        </Text>
                      </View>
                    ) : (
                      <PrimaryButton
                        label="Confirm injury marker"
                        icon="checkmark-circle-outline"
                        disabled={!isValidInjuryDraft({ ...selectedDraft, confirmed: true })}
                        onPress={() => updateDraft(selectedDraft.id, { confirmed: true })}
                      />
                    )}
                    <SecondaryButton
                      label="Remove selected draft marker"
                      icon="trash-outline"
                      onPress={removeSelectedDraft}
                    />
                  </View>
                ) : null}
              </Panel>
            ) : null}

            {/* Unified Injury Records & Recovery Panel */}
            <Panel style={styles.editorSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[uiStyles.value, { fontSize: 16, fontWeight: "700" }]}>
                    {t("Horse injury records")}
                  </Text>
                  <Text style={[uiStyles.muted, { fontSize: 12 }]}>
                    {allowFollowUpUpdates
                      ? "Xem vị trí trên mô hình 3D và cập nhật tiến trình hồi phục của từng chấn thương."
                      : "Danh sách chấn thương đã ghi nhận. Chạm để xem vị trí trên mô hình 3D."}
                  </Text>
                </View>
                {existingInjuries.length > 0 ? (
                  <View
                    style={[
                      styles.headerCountBadge,
                      unhealedCount > 0 ? styles.badgePending : styles.badgeAllHealed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.headerCountBadgeText,
                        unhealedCount > 0 ? styles.textPending : styles.textAllHealed,
                      ]}
                    >
                      {unhealedCount > 0 ? `${unhealedCount} chưa lành` : "Đã lành"}
                    </Text>
                  </View>
                ) : null}
              </View>

              {existingInjuries.length === 0 ? (
                <View style={styles.emptyInjuriesBox}>
                  <Ionicons name="shield-checkmark-outline" size={26} color={colors.primary} />
                  <Text style={[uiStyles.muted, { fontSize: 13, textAlign: "center" }]}>
                    Ngựa hiện chưa có ghi nhận chấn thương nào trong hồ sơ y tế.
                  </Text>
                </View>
              ) : (
                sortedExistingInjuries.map((injury) => {
                  const isSelected = selectedMarkerId === injury.id;
                  const has3D = compatibleIds.has(injury.id);
                  const isUnhealed = injury.currentRecoveryStatus !== "HEALED";
                  const update = updates.find((item) => item.injuryId === injury.id);
                  const latestNote = injury.history?.at(-1)?.notes?.trim();

                  return (
                    <View
                      key={injury.id}
                      style={[
                        styles.unifiedInjuryCard,
                        isSelected && styles.unifiedInjuryCardSelected,
                        update && styles.unifiedInjuryCardUpdating,
                      ]}
                    >
                      {/* Top Row: Region · Type and Current Status */}
                      <View style={styles.injuryCardHeader}>
                        <View style={{ flex: 1, gap: 3 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Text style={[uiStyles.value, { fontSize: 15, fontWeight: "700" }]}>
                              {formatEnum(t(injury.bodyRegion))} · {formatEnum(t(injury.injuryType))}
                            </Text>
                            {update?.recoveryStatus === "HEALED" ? (
                              <View style={styles.miniHealedBadge}>
                                <Text style={styles.miniHealedBadgeText}>Mới: Đã lành</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={[uiStyles.muted, { fontSize: 11 }]}>
                            {t("First recorded")}: {new Date(injury.firstExamDate).toLocaleDateString()}
                          </Text>
                        </View>

                        {/* Status badge */}
                        <View
                          style={[
                            styles.statusPill,
                            injury.currentRecoveryStatus === "ACUTE"
                              ? styles.statusPillAcute
                              : injury.currentRecoveryStatus === "RECOVERING"
                                ? styles.statusPillRecovering
                                : styles.statusPillHealed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              injury.currentRecoveryStatus === "ACUTE"
                                ? styles.statusTextAcute
                                : injury.currentRecoveryStatus === "RECOVERING"
                                  ? styles.statusTextRecovering
                                  : styles.statusTextHealed,
                            ]}
                          >
                            {formatEnum(t(injury.currentRecoveryStatus))}
                          </Text>
                        </View>
                      </View>

                      {/* Action Bar: 3D focus & update trigger */}
                      <View style={styles.injuryCardActionBar}>
                        {has3D ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => focusMarker(injury.id)}
                            style={[
                              styles.view3DBadgeBtn,
                              isSelected && styles.view3DBadgeBtnActive,
                            ]}
                          >
                            <Ionicons
                              name={isSelected ? "location" : "locate-outline"}
                              size={14}
                              color={isSelected ? "#FFFFFF" : colors.primary}
                            />
                            <Text
                              style={[
                                styles.view3DBadgeBtnText,
                                isSelected && styles.view3DBadgeBtnTextActive,
                              ]}
                            >
                              {isSelected ? "Đang xem trên 3D" : "Xem vị trí 3D"}
                            </Text>
                          </Pressable>
                        ) : (
                          <View style={styles.no3DTag}>
                            <Ionicons name="cube-outline" size={13} color={colors.mutedForeground} />
                            <Text style={styles.no3DTagText}>Chưa có tọa độ 3D</Text>
                          </View>
                        )}

                        {allowFollowUpUpdates && isUnhealed && !update ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => addFollowUpUpdate(injury)}
                            style={styles.triggerUpdateBtn}
                          >
                            <Ionicons name="create-outline" size={14} color={colors.primary} />
                            <Text style={styles.triggerUpdateBtnText}>Cập nhật hồi phục</Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {/* Latest Notes from history */}
                      {latestNote ? (
                        <View style={styles.previousNoteBox}>
                          <Ionicons name="document-text-outline" size={13} color={colors.mutedForeground} />
                          <Text style={styles.previousNoteText} numberOfLines={2}>
                            Ghi chú: &ldquo;{latestNote}&rdquo;
                          </Text>
                        </View>
                      ) : null}

                      {/* In-place Follow-up update editor */}
                      {allowFollowUpUpdates && isUnhealed && update ? (
                        <View style={styles.updateEditorBox}>
                          <View style={styles.updateEditorTitleRow}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                              <Ionicons name="create" size={15} color={colors.primary} />
                              <Text style={styles.updateEditorTitle}>Cập nhật trong lần tái khám này</Text>
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => addFollowUpUpdate(injury)}
                              style={styles.cancelUpdateBtn}
                            >
                              <Ionicons name="close-circle-outline" size={15} color={colors.destructive} />
                              <Text style={styles.cancelUpdateText}>Hủy</Text>
                            </Pressable>
                          </View>

                          <View style={{ marginTop: 6 }}>
                            <Text style={[uiStyles.label, { fontSize: 12, marginBottom: 4 }]}>
                              Mức độ hồi phục mới
                            </Text>
                            <Chips
                              options={RECOVERY_OPTIONS}
                              value={update.recoveryStatus}
                              onChange={(value) => {
                                if (RECOVERY_OPTIONS.includes(value))
                                  updateFollowUp(injury.id, {
                                    recoveryStatus: value as InjuryRecoveryStatus,
                                  });
                              }}
                            />
                          </View>

                          {update.recoveryStatus === "HEALED" ? (
                            <View style={styles.healedConfirmationBox}>
                              <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                              <Text style={styles.healedConfirmationText}>
                                Đã chuyển thành Đã lành. Bệnh án sẽ đủ điều kiện đóng khi tất cả chấn thương đều đã lành.
                              </Text>
                            </View>
                          ) : null}

                          <View style={{ marginTop: space.xs }}>
                            <Text style={[uiStyles.label, { fontSize: 12, marginBottom: 4 }]}>
                              Ghi chú lâm sàng lần khám này
                            </Text>
                            <NativeInput
                              value={update.notes ?? ""}
                              onChangeText={(notes) =>
                                updateFollowUp(injury.id, { notes: notes.slice(0, 1000) })
                              }
                              multiline
                              placeholder="Ghi chú mức độ hồi phục, giảm sưng, phản xạ đau..."
                            />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </Panel>
          </ScrollView>

          {!isKeyboardVisible ? (
            <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
              <PrimaryButton
                label="Close 3D injury map"
                icon="checkmark-circle-outline"
                onPress={handleCloseModal}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    launchPanel: { gap: space.xs },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
    modalRoot: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      minHeight: 56,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      zIndex: 10,
    },
    headerTitle: { flex: 1, minWidth: 0, gap: 2 },
    headerRightActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
    },
    headerButton: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerDoneButton: {
      minHeight: 44,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerDoneText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 14,
    },
    modalFooter: {
      paddingHorizontal: space.md,
      paddingTop: space.xs,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    modeBar: {
      flexDirection: "row",
      gap: space.sm,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
    },
    modeButton: {
      minHeight: 40,
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: space.sm,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: space.xs,
    },
    modeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    modeButtonText: { color: colors.foreground, fontSize: 12, fontWeight: "700" },
    modeButtonTextActive: { color: "#fff" },
    modalMarkerBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      paddingHorizontal: space.md,
      paddingVertical: 4,
      flexWrap: "wrap",
    },
    savedMarkerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    savedMarkerBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.primary,
    },
    draftMarkerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.monitor ?? "#d97706",
    },
    draftMarkerBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.monitor ?? "#d97706",
    },
    activeMarkerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      maxWidth: 180,
    },
    activeMarkerBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.foreground,
    },
    viewerFrame: {
      flex: 1,
      minHeight: 250,
      marginHorizontal: space.md,
      marginVertical: space.xs,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: "#f4f3ef",
      borderWidth: 1,
      borderColor: colors.border,
    },
    viewerFrameKeyboard: {
      flex: 0,
      minHeight: 110,
      height: 110,
      marginVertical: 2,
    },
    webView: { flex: 1, backgroundColor: "#f4f3ef" },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      gap: space.sm,
      padding: space.lg,
      backgroundColor: "rgba(244,243,239,0.92)",
    },
    errorText: { textAlign: "center", color: colors.destructive },
    errorContent: { gap: space.sm, paddingHorizontal: space.md },
    confirmedNotice: { flexDirection: "row", alignItems: "center", gap: space.xs },
    editorScroll: { flexGrow: 0, maxHeight: "47%" },
    editorScrollKeyboard: {
      flex: 1,
      maxHeight: undefined,
    },
    editorContent: { padding: space.md, gap: space.sm, paddingBottom: space.xl },
    editorSection: { gap: space.sm, paddingTop: space.md },
    markerCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: space.sm,
      gap: 4,
      marginTop: space.xs,
    },
    markerCardActive: { borderColor: colors.primary, borderWidth: 2 },
    markerTitleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: space.sm,
      marginBottom: space.xs,
    },
    headerCountBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    headerCountBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    badgePending: {
      backgroundColor: "#fef3c7",
      borderColor: "#fde68a",
    },
    badgeAllHealed: {
      backgroundColor: colors.fitSoft ?? "#dcfce7",
      borderColor: colors.primary,
    },
    textPending: {
      color: "#b45309",
    },
    textAllHealed: {
      color: colors.primary,
    },
    emptyInjuriesBox: {
      alignItems: "center",
      justifyContent: "center",
      padding: space.lg,
      gap: space.xs,
    },
    unifiedInjuryCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: space.sm,
      gap: space.xs,
      marginTop: space.xs,
    },
    unifiedInjuryCardSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    unifiedInjuryCardUpdating: {
      borderColor: colors.primary,
    },
    injuryCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: space.sm,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    statusPillAcute: {
      backgroundColor: "#fee2e2",
      borderColor: "#fca5a5",
    },
    statusPillRecovering: {
      backgroundColor: "#fef3c7",
      borderColor: "#fde68a",
    },
    statusPillHealed: {
      backgroundColor: "#dcfce7",
      borderColor: "#86efac",
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    statusTextAcute: { color: "#dc2626" },
    statusTextRecovering: { color: "#d97706" },
    statusTextHealed: { color: "#16a34a" },
    miniHealedBadge: {
      backgroundColor: "#dcfce7",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: "#86efac",
    },
    miniHealedBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#16a34a",
    },
    injuryCardActionBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.xs,
      flexWrap: "wrap",
      marginTop: 2,
    },
    view3DBadgeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    view3DBadgeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    view3DBadgeBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    view3DBadgeBtnTextActive: {
      color: "#FFFFFF",
    },
    no3DTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    no3DTagText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
    triggerUpdateBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    triggerUpdateBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    previousNoteBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.muted,
      padding: space.xs,
      borderRadius: radius.sm,
      marginTop: 2,
    },
    previousNoteText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontStyle: "italic",
      flex: 1,
    },
    updateEditorBox: {
      marginTop: space.xs,
      padding: space.sm,
      backgroundColor: colors.muted,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      gap: 4,
    },
    updateEditorTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    updateEditorTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    cancelUpdateBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      padding: 2,
    },
    cancelUpdateText: {
      fontSize: 12,
      color: colors.destructive,
      fontWeight: "600",
    },
    healedConfirmationBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#dcfce7",
      padding: space.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: "#86efac",
      marginTop: 6,
    },
    healedConfirmationText: {
      fontSize: 11,
      color: "#166534",
      fontWeight: "600",
      flex: 1,
      lineHeight: 15,
    },
  });
