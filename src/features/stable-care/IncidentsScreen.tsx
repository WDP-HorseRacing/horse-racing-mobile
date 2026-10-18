import { useCallback, useState } from "react";
import { Alert, Image, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
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
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const requestedId = Array.isArray(requestedHorseId) ? requestedHorseId[0] : requestedHorseId;
  const canReport = role === "groom";
  const canManage = role === "trainer";
  const load = useCallback(async () => {
    const [incidents, today] = await Promise.all([
      stableCareService.listIncidents(token!),
      canReport ? groomService.getToday(token!) : Promise.resolve(null),
    ]);
    return { incidents, today };
  }, [canReport, token]);
  const resource = useApiResource(load, Boolean(token));
  const horses = resource.data?.today?.horses ?? [];
  const [horseId, setHorseId] = useState(requestedId ?? "");
  const selectedHorse = horses.find((horse) => horse.horseId === horseId);
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [photo, setPhoto] = useState<LocalMediaAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const choosePhoto = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/webp"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
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
  const refer = (incident: IncidentDto, urgent = false) =>
    Alert.alert(
      urgent ? "Refer as urgent?" : "Refer incident for examination?",
      urgent
        ? "This creates an urgent exam request and alerts veterinarians."
        : "This creates one exam request linked to the incident.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: urgent ? "Refer urgently" : "Refer",
          onPress: () =>
            void stableCareService
              .referIncident(token!, incident.id, urgent)
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
  const incidents = resource.data?.incidents ?? [];

  return (
    <Screen
      role={role}
      title={canReport ? "Stable incidents" : "Incidents"}
      subtitle={
        canReport
          ? "Report a horse incident and review your reports"
          : "Review stable incidents and exam referrals"
      }
      back
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
          {horses.length ? (
            <Chips
              options={horses.map(
                (horse) =>
                  `${horse.horseName} · ${horse.stallCode ?? horse.barnName ?? "No stall"}`,
              )}
              value={
                selectedHorse
                  ? `${selectedHorse.horseName} · ${selectedHorse.stallCode ?? selectedHorse.barnName ?? "No stall"}`
                  : ""
              }
              onChange={(label) =>
                setHorseId(
                  horses.find(
                    (horse) =>
                      `${horse.horseName} · ${horse.stallCode ?? horse.barnName ?? "No stall"}` ===
                      label,
                  )?.horseId ?? "",
                )
              }
            />
          ) : (
            <Text style={ui.muted}>
              Only horses assigned to you in Groom Today can be reported.
            </Text>
          )}
          <Field label="What happened?">
            <NativeInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Describe what you observed"
            />
          </Field>
          <Chips
            options={["Normal", "Urgent"]}
            value={urgent ? "Urgent" : "Normal"}
            onChange={(value) => setUrgent(value === "Urgent")}
          />
          <Text style={ui.muted}>
            Urgent reports automatically create an urgent medical exam request.
          </Text>
          {photo ? (
            <View style={ui.row}>
              <Text style={ui.muted}>{photo.name}</Text>
              <SecondaryButton label="Remove photo" onPress={() => setPhoto(null)} />
            </View>
          ) : null}
          <SecondaryButton
            label="Attach one photo"
            onPress={() => void choosePhoto()}
            disabled={Boolean(photo)}
          />
          {photo?.uri ? (
            <Image
              source={{ uri: photo.uri }}
              style={{ width: 160, height: 120, borderRadius: 12 }}
              resizeMode="cover"
            />
          ) : null}
          <PrimaryButton
            label={uploading ? "Uploading photo…" : saving ? "Sending…" : "Send incident report"}
            onPress={() => void submit()}
            disabled={saving || !selectedHorse || !description.trim()}
          />
        </View>
      ) : null}
      <View style={ui.section}>
        <SectionTitle>{canReport ? "My incident reports" : "Incident history"}</SectionTitle>
        {!incidents.length && !resource.isLoading && !resource.error ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => void resource.refresh()}
            empty
            emptyLabel="No incidents are recorded."
          />
        ) : null}
        {incidents.map((incident) => (
          <Panel key={incident.id}>
            <Text style={ui.value}>
              {incident.horseName} · {incident.status}
              {incident.urgent ? " · URGENT" : ""}
            </Text>
            <Text style={ui.muted}>
              {formatDateTime(incident.createdAt)} · Reported by {incident.reporter.fullName}
            </Text>
            <Text>{incident.description}</Text>
            {incident.photoUrl ? (
              <Image
                source={{ uri: incident.photoUrl }}
                style={{ width: 200, height: 150, borderRadius: 12, marginTop: 8 }}
                resizeMode="cover"
              />
            ) : null}
            {incident.examRequest ? (
              <Text style={ui.muted}>
                Exam request: {incident.examRequest.status}
                {incident.examRequest.urgent ? " · urgent" : ""}
              </Text>
            ) : (
              <Text style={ui.muted}>No exam request linked</Text>
            )}
            {incident.resolution ? (
              <Text style={ui.muted}>
                Resolution: {incident.resolution}
                {incident.resolver ? ` · ${incident.resolver.fullName}` : ""}
              </Text>
            ) : null}
            {canManage && incident.status === "OPEN" && !incident.examRequest ? (
              <View style={ui.row}>
                <PrimaryButton label="Refer to veterinarian" onPress={() => refer(incident)} />
                <SecondaryButton label="Refer urgently" onPress={() => refer(incident, true)} />
              </View>
            ) : null}
            {canManage &&
            incident.status === "OPEN" &&
            incident.examRequest?.status !== "PENDING" ? (
              <SecondaryButton
                label={resolveId === incident.id ? "Cancel resolution" : "Resolve incident"}
                onPress={() => {
                  setResolveId(resolveId === incident.id ? null : incident.id);
                  setResolution("");
                }}
              />
            ) : null}
            {canManage &&
            incident.status === "OPEN" &&
            incident.examRequest?.status === "PENDING" ? (
              <Text style={ui.muted}>
                Resolve the linked exam request before closing this incident.
              </Text>
            ) : null}
            {canManage && resolveId === incident.id ? (
              <>
                <Field label="Resolution">
                  <NativeInput
                    value={resolution}
                    onChangeText={setResolution}
                    multiline
                    placeholder="Describe how this was handled"
                  />
                </Field>
                <PrimaryButton
                  label="Close incident"
                  onPress={() => void resolve()}
                  disabled={!resolution.trim()}
                />
              </>
            ) : null}
          </Panel>
        ))}
      </View>
    </Screen>
  );
}
