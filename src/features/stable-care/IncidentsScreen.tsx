import { useCallback, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  BottomSheetModal,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { isRole } from "@/features/auth/roles";
import { stableCareService, type IncidentDto } from "@/services/stable-care.service";
import { groomService } from "@/services/groom.service";
import { mediaService, type LocalMediaAsset } from "@/services/media.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";

export default function IncidentsScreen() {
  const { role: roleParam, horseId: requestedHorseId } = useLocalSearchParams<{
    role: string;
    horseId?: string;
  }>();
  const role = isRole(roleParam) ? roleParam : "groom";
  const { token } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const requestedId = Array.isArray(requestedHorseId) ? requestedHorseId[0] : requestedHorseId;
  const canReport = role === "groom";
  const canManage = role === "trainer";
  const isVet = role === "vet";

  const load = useCallback(async () => {
    const [incidents, today] = await Promise.all([
      stableCareService.listIncidents(token!),
      canReport ? groomService.getToday(token!) : Promise.resolve(null),
    ]);
    return { incidents, today };
  }, [canReport, token]);

  const resource = useApiResource(load, Boolean(token));
  useRefreshOnFocus(resource.revalidate);
  const horses = useMemo(() => resource.data?.today?.horses ?? [], [resource.data?.today?.horses]);
  const incidents = useMemo(() => resource.data?.incidents ?? [], [resource.data?.incidents]);
  const [horseId, setHorseId] = useState(requestedId ?? "");
  const selectedHorse = horses.find((horse) => horse.horseId === horseId);
  const [horsePickerOpen, setHorsePickerOpen] = useState(false);
  const [horseSearch, setHorseSearch] = useState("");
  const [description, setDescription] = useState("");
  const [selectedQuickOptions, setSelectedQuickOptions] = useState<string[]>([]);
  const [urgent, setUrgent] = useState(false);
  const [photo, setPhoto] = useState<LocalMediaAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<"ALL" | "OPEN" | "RESOLVED">(
    "ALL",
  );
  const [expandedIncidentIds, setExpandedIncidentIds] = useState<Record<string, boolean>>({});
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);

  const QUICK_INCIDENT_OPTIONS = useMemo(
    () => [
      "Fever",
      "Colic",
      "Loss of appetite",
      "Hoof scratch",
      "Limping",
      "Fatigue",
      "Damaged stall",
      "Equipment failure",
      "Sanitation issue",
      "Other issue",
    ],
    [],
  );

  const toggleQuickOption = (option: string) => {
    const label = t(option);
    const isSelected = selectedQuickOptions.includes(option);
    if (isSelected) {
      setSelectedQuickOptions((prev) => prev.filter((o) => o !== option));
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|\\s*·\\s*|\\s*,\\s*)${escaped}(\\s*·\\s*|\\s*,\\s*|$)`, "g");
      const next = description
        .replace(regex, (match, p1, p2) => {
          if (
            p1 &&
            p2 &&
            (p1.includes("·") || p1.includes(",")) &&
            (p2.includes("·") || p2.includes(","))
          ) {
            return " · ";
          }
          return "";
        })
        .trim();
      setDescription(next);
    } else {
      setSelectedQuickOptions((prev) => [...prev, option]);
      const next = description.trim() ? `${description.trim()} · ${label}` : label;
      setDescription(next);
    }
  };

  const toggleExpandIncident = (id: string) => {
    setExpandedIncidentIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredHorses = useMemo(() => {
    if (!horseSearch.trim()) return horses;
    const query = horseSearch.toLowerCase().trim();
    return horses.filter(
      (h) =>
        h.horseName.toLowerCase().includes(query) ||
        (h.stallCode && h.stallCode.toLowerCase().includes(query)) ||
        (h.barnName && h.barnName.toLowerCase().includes(query)),
    );
  }, [horses, horseSearch]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      if (incidentStatusFilter === "ALL") return true;
      return incident.status === incidentStatusFilter;
    });
  }, [incidents, incidentStatusFilter]);

  const choosePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t("Permission required"),
          t("Permission to access the photo library is required to attach photos."),
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let size = asset.fileSize;
        if (!size && asset.uri) {
          try {
            const info = await FileSystem.getInfoAsync(asset.uri);
            if (info.exists && !info.isDirectory) size = info.size;
          } catch {}
        }
        const fileName = asset.fileName || `incident-${Date.now()}.jpg`;
        setPhoto({
          name: fileName,
          uri: asset.uri,
          size,
          mimeType: asset.mimeType ?? "image/jpeg",
        });
      }
    } catch (err) {
      Alert.alert(t("Could not choose photo"), extractErrorMessage(err));
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t("Permission required"),
          t("Permission to access the camera is required to take photos."),
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let size = asset.fileSize;
        if (!size && asset.uri) {
          try {
            const info = await FileSystem.getInfoAsync(asset.uri);
            if (info.exists && !info.isDirectory) size = info.size;
          } catch {}
        }
        const fileName = asset.fileName || `incident-camera-${Date.now()}.jpg`;
        setPhoto({
          name: fileName,
          uri: asset.uri,
          size,
          mimeType: asset.mimeType ?? "image/jpeg",
        });
      }
    } catch (err) {
      Alert.alert(t("Could not take photo"), extractErrorMessage(err));
    }
  };

  const pickFromDocument = async () => {
    try {
      const docResult = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!docResult.canceled && docResult.assets[0]) {
        const picked = docResult.assets[0];
        const name = picked.name || `incident-${Date.now()}.jpg`;
        setPhoto({
          name,
          uri: picked.uri,
          size: picked.size,
          mimeType:
            picked.mimeType ||
            (name.toLowerCase().endsWith(".png")
              ? "image/png"
              : name.toLowerCase().endsWith(".webp")
                ? "image/webp"
                : "image/jpeg"),
        });
      }
    } catch (err) {
      Alert.alert(t("Could not choose photo"), extractErrorMessage(err));
    }
  };

  const promptPhotoOptions = () => {
    Alert.alert(t("Attach photo"), t("Choose photo source"), [
      { text: t("Take photo"), onPress: () => void takePhoto() },
      { text: t("Choose from library"), onPress: () => void choosePhoto() },
      { text: t("Select image file (.jpg, .png...)"), onPress: () => void pickFromDocument() },
      { text: t("Cancel"), style: "cancel" },
    ]);
  };

  const submit = async () => {
    if (
      !token ||
      !selectedHorse ||
      !description.trim() ||
      description.trim().length > 2000 ||
      saving
    ) {
      Alert.alert(
        "Check incident details",
        "Select one of your assigned horses and enter a description of up to 2,000 characters.",
      );
      return;
    }
    setSaving(true);
    try {
      let photoMediaId: string | undefined;
      if (photo) {
        setUploading(true);
        photoMediaId = await mediaService.uploadIncidentPhoto(token, photo);
        setUploading(false);
      }
      await stableCareService.reportIncident(token, {
        horseId,
        description: description.trim(),
        urgent,
        ...(photoMediaId ? { photoMediaId } : {}),
      });
      setDescription("");
      setSelectedQuickOptions([]);
      setUrgent(false);
      setPhoto(null);
      Alert.alert(
        "Incident recorded",
        urgent
          ? "An urgent exam request was created automatically."
          : "The Head Trainer can review and refer this incident if needed.",
      );
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not report incident", extractErrorMessage(error));
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const refer = (incident: IncidentDto, isUrgent = false) =>
    Alert.alert(
      isUrgent ? "Refer as urgent?" : "Refer incident for examination?",
      isUrgent
        ? "This creates an urgent exam request and alerts veterinarians."
        : "This creates one exam request linked to the incident.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isUrgent ? "Refer urgently" : "Refer",
          onPress: () =>
            void stableCareService
              .referIncident(token!, incident.id, isUrgent)
              .then(() => resource.refresh())
              .catch((error) =>
                Alert.alert("Could not refer incident", extractErrorMessage(error)),
              ),
        },
      ],
    );

  const resolve = async () => {
    if (!resolveId || !resolution.trim() || resolution.trim().length > 1000) {
      Alert.alert("Check the resolution", "Add a resolution of up to 1,000 characters.");
      return;
    }
    try {
      await stableCareService.resolveIncident(token!, resolveId, resolution.trim());
      setResolveId(null);
      setResolution("");
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not close incident", extractErrorMessage(error));
    }
  };

  return (
    <Screen
      role={role}
      title={canReport ? "Stable incidents" : "Incidents"}
      subtitle={
        canReport
          ? "Report a horse incident and review your reports"
          : isVet
            ? "Examine and manage horse incidents"
            : "Review stable incidents and exam referrals"
      }
      back={role !== "groom"}
      fallbackHref={`/${role}` as any}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {canReport ? (
        <View style={ui.section}>
          <SectionTitle>Report an incident</SectionTitle>

          {/* Horse Selector Trigger */}
          {horses.length ? (
            <>
              {selectedHorse ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setHorsePickerOpen(true)}
                  style={styles.selectedHorseCard}
                >
                  <View style={styles.horseCardAvatar}>
                    <Ionicons name="paw" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[ui.value, { fontWeight: "700" }]} numberOfLines={1}>
                      {selectedHorse.horseName}
                    </Text>
                    <Text style={ui.muted} numberOfLines={1}>
                      {selectedHorse.stallCode
                        ? `Stall ${selectedHorse.stallCode}`
                        : (selectedHorse.barnName ?? "No stall assigned")}
                    </Text>
                  </View>
                  <View style={styles.changeBadge}>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                      Change
                    </Text>
                    <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setHorsePickerOpen(true)}
                  style={styles.selectHorseTrigger}
                >
                  <Ionicons name="paw-outline" size={20} color={colors.mutedForeground} />
                  <Text style={[ui.muted, { flex: 1, fontSize: 15 }]}>
                    Select horse to report incident
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
                </Pressable>
              )}
            </>
          ) : (
            <Text style={ui.muted}>
              Only horses assigned to you in Groom Today can be reported.
            </Text>
          )}

          {/* Horse Picker Modal */}
          <Modal
            visible={horsePickerOpen}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setHorsePickerOpen(false)}
          >
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select horse</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setHorsePickerOpen(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={colors.foreground} />
                </Pressable>
              </View>

              <View style={styles.modalSearchBox}>
                <NativeInput
                  value={horseSearch}
                  onChangeText={setHorseSearch}
                  placeholder="Search horse by name or stall"
                />
              </View>

              <ScrollView contentContainerStyle={styles.horseListContent}>
                {filteredHorses.map((horse) => {
                  const isCurrent = horse.horseId === horseId;
                  return (
                    <Pressable
                      key={horse.horseId}
                      accessibilityRole="button"
                      onPress={() => {
                        setHorseId(horse.horseId);
                        setHorsePickerOpen(false);
                        setHorseSearch("");
                      }}
                      style={[
                        styles.horsePickerItem,
                        isCurrent && {
                          borderColor: colors.primary,
                          backgroundColor: colors.fitSoft,
                          borderWidth: 1.5,
                        },
                      ]}
                    >
                      <View style={styles.horseCardAvatar}>
                        <Ionicons
                          name="paw"
                          size={18}
                          color={isCurrent ? colors.primary : colors.mutedForeground}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[ui.value, { fontWeight: "700" }]} numberOfLines={1}>
                          {horse.horseName}
                        </Text>
                        <Text style={ui.muted} numberOfLines={1}>
                          {horse.stallCode
                            ? `Stall ${horse.stallCode}`
                            : (horse.barnName ?? "No stall assigned")}
                        </Text>
                      </View>
                      {isCurrent ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                      )}
                    </Pressable>
                  );
                })}
                {!filteredHorses.length ? (
                  <Text style={[ui.muted, { textAlign: "center", marginTop: 24 }]}>
                    No horses found matching this search.
                  </Text>
                ) : null}
              </ScrollView>
            </View>
          </Modal>

          {/* Quick Incident Options */}
          <View style={{ gap: space.xs }}>
            <Text style={[ui.label, { fontSize: 13 }]}>{t("Quick incident options")}</Text>
            <Text style={[ui.muted, { fontSize: 12, marginTop: -2 }]}>
              {t("Select common issues or type below")}
            </Text>
            <View style={styles.quickOptionsWrap}>
              {QUICK_INCIDENT_OPTIONS.map((opt) => {
                const active = selectedQuickOptions.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => toggleQuickOption(opt)}
                    style={[styles.quickOptionChip, active && styles.quickOptionChipActive]}
                  >
                    <Ionicons
                      name={active ? "checkmark-circle" : "add-circle-outline"}
                      size={15}
                      color={active ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.quickOptionChipText,
                        active && styles.quickOptionChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {t(opt)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field label="What happened?">
            <NativeInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Describe what you observed"
            />
          </Field>

          {/* Normal vs Urgent 2-card selector */}
          <View style={styles.urgencyContainer}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setUrgent(false)}
              style={[styles.urgencyCard, !urgent && styles.urgencyCardActiveNormal]}
            >
              <View style={styles.urgencyHeaderRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={22}
                  color={!urgent ? colors.primary : colors.mutedForeground}
                />
                {!urgent ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.urgencyCardTitle,
                  !urgent && { color: colors.primary, fontWeight: "700" },
                ]}
              >
                Normal
              </Text>
              <Text style={styles.urgencyCardHint} numberOfLines={2}>
                Routine stable care observation
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setUrgent(true)}
              style={[styles.urgencyCard, urgent && styles.urgencyCardActiveUrgent]}
            >
              <View style={styles.urgencyHeaderRow}>
                <Ionicons
                  name="alert-circle"
                  size={22}
                  color={urgent ? colors.destructive : colors.destructive}
                />
                {urgent ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.destructive} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.urgencyCardTitle,
                  urgent && { color: colors.destructive, fontWeight: "800" },
                ]}
              >
                Urgent
              </Text>
              <Text
                style={[styles.urgencyCardHint, urgent && { color: colors.destructive }]}
                numberOfLines={2}
              >
                Requires immediate vet attention
              </Text>
            </Pressable>
          </View>

          {urgent ? (
            <View style={styles.urgentAlertBox}>
              <Ionicons name="warning" size={18} color={colors.destructive} />
              <Text
                style={[
                  ui.muted,
                  { color: colors.destructive, flex: 1, fontWeight: "600", fontSize: 13 },
                ]}
              >
                Urgent reports automatically create an urgent medical exam request.
              </Text>
            </View>
          ) : null}

          {/* Photo attachment with camera / photo library */}
          {photo ? (
            <View style={styles.photoPreviewCard}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} resizeMode="cover" />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={[ui.value, { fontSize: 14 }]} numberOfLines={1} ellipsizeMode="middle">
                  {photo.name}
                </Text>
                <Text style={ui.muted}>
                  {photo.size ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB` : "Attached photo"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPhoto(null)}
                  style={styles.removePhotoBtn}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.destructive} />
                  <Text style={{ color: colors.destructive, fontSize: 13, fontWeight: "600" }}>
                    Remove photo
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <SecondaryButton
              label="Attach photo"
              icon="camera-outline"
              onPress={promptPhotoOptions}
            />
          )}

          <PrimaryButton
            label={uploading ? "Uploading photo…" : saving ? "Sending…" : "Send incident report"}
            icon="paper-plane-outline"
            onPress={() => void submit()}
            disabled={saving || !selectedHorse || !description.trim()}
          />
        </View>
      ) : null}

      {/* Incident List */}
      <View style={ui.section}>
        <SectionTitle>{canReport ? "My incident reports" : "Incident history"}</SectionTitle>

        {/* Status Filter Tabs */}
        <View style={styles.statusFilterRow}>
          {(["ALL", "OPEN", "RESOLVED"] as const).map((filter) => {
            const active = incidentStatusFilter === filter;
            const count =
              filter === "ALL"
                ? incidents.length
                : incidents.filter((i) => i.status === filter).length;
            const label =
              filter === "ALL" ? t("All reports") : filter === "OPEN" ? t("Open") : t("Resolved");
            return (
              <Pressable
                key={filter}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setIncidentStatusFilter(filter)}
                style={[styles.statusFilterBtn, active && styles.statusFilterBtnActive]}
              >
                <Text
                  style={[styles.statusFilterBtnText, active && styles.statusFilterBtnTextActive]}
                >
                  {label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!filteredIncidents.length && !resource.isLoading && !resource.error ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => void resource.refresh()}
            empty
            emptyLabel={
              incidentStatusFilter === "ALL"
                ? "No incidents are recorded."
                : t("No incidents in this status.")
            }
          />
        ) : null}

        {filteredIncidents.map((incident) => {
          const isUrgent = incident.urgent;
          const isResolved = incident.status === "RESOLVED";
          const isExpanded = Boolean(expandedIncidentIds[incident.id]);
          const isLongDescription = incident.description.length > 130;

          return (
            <Panel
              key={incident.id}
              style={[
                styles.incidentCard,
                {
                  borderLeftWidth: 4,
                  borderLeftColor: isResolved
                    ? colors.primary
                    : isUrgent
                      ? colors.destructive
                      : colors.monitor,
                },
              ]}
            >
              {/* Incident Header */}
              <View style={styles.incidentHeaderRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.incidentHorseName} numberOfLines={1}>
                    {incident.horseName}
                  </Text>
                  <Text style={styles.incidentMetaText} numberOfLines={1}>
                    {formatDateTime(incident.createdAt)} · {incident.reporter.fullName}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {isUrgent ? (
                    <View style={styles.urgentBadge}>
                      <Ionicons name="flame" size={12} color="#FFFFFF" />
                      <Text style={styles.urgentBadgeText}>URGENT</Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.statusBadgeWrap,
                      {
                        backgroundColor: isResolved
                          ? colors.fitSoft
                          : isUrgent
                            ? colors.injuredSoft
                            : colors.monitorSoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color: isResolved
                            ? colors.primary
                            : isUrgent
                              ? colors.destructive
                              : colors.monitor,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {isResolved ? t("Resolved") : t("Open")}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Description Body */}
              <View style={styles.incidentDescriptionBox}>
                <Text
                  style={styles.incidentDescriptionText}
                  numberOfLines={isExpanded ? undefined : 3}
                >
                  {incident.description}
                </Text>
                {isLongDescription ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => toggleExpandIncident(incident.id)}
                    style={{ marginTop: 4, alignSelf: "flex-start" }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                      {isExpanded ? t("Show less") : t("Show more")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Attached Photo with zoom */}
              {incident.photoUrl ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEnlargedPhotoUrl(incident.photoUrl)}
                  style={styles.incidentPhotoContainer}
                >
                  <Image
                    source={{ uri: incident.photoUrl }}
                    style={styles.incidentPhoto}
                    resizeMode="cover"
                  />
                  <View style={styles.enlargePhotoBadge}>
                    <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                  </View>
                </Pressable>
              ) : null}

              {/* Linked Exam Request */}
              {incident.examRequest ? (
                <View style={styles.examRequestBox}>
                  <Ionicons name="medkit-outline" size={16} color={colors.primary} />
                  <Text style={[ui.muted, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                    Exam request: {incident.examRequest.status}
                    {incident.examRequest.urgent ? " · urgent" : ""}
                  </Text>
                </View>
              ) : null}

              {/* Resolution Note */}
              {incident.resolution ? (
                <View style={styles.resolutionBox}>
                  <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[ui.value, { fontSize: 13, fontWeight: "600" }]}>
                      Resolution: {incident.resolution}
                    </Text>
                    {incident.resolver ? (
                      <Text style={ui.muted}>Resolved by {incident.resolver.fullName}</Text>
                    ) : null}
                    {incident.resolutionSource ? (
                      <Text style={ui.muted}>
                        {incident.resolutionSource === "EXAM"
                          ? "Closed automatically after the vet handled the request"
                          : incident.resolutionSource === "LIFECYCLE"
                            ? "Closed automatically after a lifecycle change"
                            : "Closed by the Head Trainer"}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Vet Actions: Directly examine horse or view medical record */}
              {isVet ? (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: 4 }}
                >
                  {!incident.examRequest || incident.examRequest.status === "PENDING" ? (
                    <PrimaryButton
                      label="Record examination"
                      icon="medkit-outline"
                      style={{ flexGrow: 1 }}
                      onPress={() =>
                        router.push(
                          `/vet/medical/visit?horseId=${incident.horseId}&requestId=${incident.examRequest?.id ?? ""}&kind=${incident.examRequest ? "REQUEST" : "ROUTINE"}` as Href,
                        )
                      }
                    />
                  ) : null}
                  <SecondaryButton
                    label="Medical records"
                    icon="document-text-outline"
                    style={{ flexGrow: 1 }}
                    onPress={() =>
                      router.push(`/vet/horse/${incident.horseId}?tab=Medical` as Href)
                    }
                  />
                </View>
              ) : null}

              {/* Trainer Actions */}
              {canManage && incident.status === "OPEN" && !incident.examRequest ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  <PrimaryButton
                    label="Refer to veterinarian"
                    style={{ flexGrow: 1 }}
                    onPress={() => refer(incident)}
                  />
                  <SecondaryButton
                    label="Refer urgently"
                    style={{ flexGrow: 1 }}
                    onPress={() => refer(incident, true)}
                  />
                </View>
              ) : null}

              {canManage &&
              incident.status === "OPEN" &&
              !incident.examRequest ? (
                <SecondaryButton
                  label="Resolve incident"
                  onPress={() => {
                    setResolveId(incident.id);
                    setResolution("");
                  }}
                />
              ) : null}

              {canManage &&
              incident.status === "OPEN" &&
              incident.examRequest?.status === "PENDING" ? (
                <Text style={ui.muted}>
                  This incident stays open while the linked exam request is pending.
                </Text>
              ) : null}

              {canManage &&
              incident.status === "OPEN" &&
              Boolean(incident.examRequest && incident.examRequest.status !== "PENDING") ? (
                <Text style={ui.muted}>
                  The vet handled the linked request. This incident will close automatically.
                </Text>
              ) : null}
            </Panel>
          );
        })}
      </View>

      <BottomSheetModal
        visible={Boolean(resolveId)}
        title="Resolve incident"
        saveLabel="Save"
        cancelLabel="Cancel"
        onSave={() => void resolve()}
        onClose={() => {
          setResolveId(null);
          setResolution("");
        }}
      >
        <Field label="Resolution">
          <NativeInput
            value={resolution}
            onChangeText={setResolution}
            multiline
            placeholder="Describe how this was handled"
          />
        </Field>
      </BottomSheetModal>

      {/* Enlarged Photo Modal */}
      <Modal
        visible={Boolean(enlargedPhotoUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setEnlargedPhotoUrl(null)}
      >
        <View style={styles.enlargedModalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Close")}
            onPress={() => setEnlargedPhotoUrl(null)}
            style={styles.enlargedModalCloseBtn}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          {enlargedPhotoUrl ? (
            <Image
              source={{ uri: enlargedPhotoUrl }}
              style={styles.enlargedModalImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    selectedHorseCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectHorseTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
    },
    horseCardAvatar: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    changeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      flexShrink: 0,
    },
    modalContainer: {
      flex: 1,
      padding: space.lg,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
    },
    modalCloseBtn: {
      padding: space.xs,
    },
    modalSearchBox: {
      paddingVertical: space.md,
    },
    horseListContent: {
      gap: space.sm,
      paddingBottom: space.xxl,
    },
    horsePickerItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    urgencyContainer: {
      flexDirection: "row",
      gap: space.sm,
    },
    urgencyCard: {
      flex: 1,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    urgencyCardActiveNormal: {
      borderColor: colors.primary,
      backgroundColor: colors.fitSoft,
      borderWidth: 2,
    },
    urgencyCardActiveUrgent: {
      borderColor: colors.destructive,
      backgroundColor: colors.injuredSoft,
      borderWidth: 2,
    },
    urgencyHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    urgencyCardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    urgencyCardHint: {
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 16,
    },
    urgentAlertBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.injuredSoft,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    photoPreviewCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    photoThumbnail: {
      width: 64,
      height: 64,
      borderRadius: radius.sm,
    },
    removePhotoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      paddingVertical: 2,
    },
    incidentCard: {
      gap: space.md,
    },
    incidentHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    incidentHorseName: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
    },
    incidentMetaText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    urgentBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.destructive,
    },
    urgentBadgeText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    incidentDescriptionBox: {
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    incidentDescriptionText: {
      fontSize: 14,
      color: colors.foreground,
      lineHeight: 20,
    },
    incidentPhoto: {
      width: "100%",
      height: 180,
      borderRadius: radius.md,
    },
    examRequestBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.accent,
    },
    resolutionBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
    },
    statusBadgeWrap: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      flexShrink: 0,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    quickOptionsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.xs,
      marginTop: space.xs,
    },
    quickOptionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: space.sm,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    quickOptionChipActive: {
      backgroundColor: colors.fitSoft,
      borderColor: colors.primary,
    },
    quickOptionChipText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.foreground,
    },
    quickOptionChipTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    statusFilterRow: {
      flexDirection: "row",
      gap: space.xs,
      marginBottom: space.sm,
    },
    statusFilterBtn: {
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusFilterBtnActive: {
      backgroundColor: colors.fitSoft,
      borderColor: colors.primary,
    },
    statusFilterBtnText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.mutedForeground,
    },
    statusFilterBtnTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    incidentPhotoContainer: {
      position: "relative",
      borderRadius: radius.md,
      overflow: "hidden",
    },
    enlargePhotoBadge: {
      position: "absolute",
      right: space.xs,
      bottom: space.xs,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: radius.sm,
      padding: 4,
    },
    enlargedModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.9)",
      justifyContent: "center",
      alignItems: "center",
      padding: space.md,
    },
    enlargedModalCloseBtn: {
      position: "absolute",
      top: 50,
      right: 20,
      zIndex: 10,
      padding: 8,
      borderRadius: radius.pill,
      backgroundColor: "rgba(255,255,255,0.2)",
    },
    enlargedModalImage: {
      width: "100%",
      height: "80%",
    },
  });
