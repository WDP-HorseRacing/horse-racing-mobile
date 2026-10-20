import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
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
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { isRole } from "@/features/auth/roles";
import { horseService } from "@/services/horse.service";
import { medicalService } from "@/services/medical.service";
import type { ExamRequestDto } from "@/adapters/medical.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";
import { isValidRequiredText } from "@/features/medical/medical-validation";

const statuses = ["PENDING", "EXAMINED", "DISMISSED"] as const;

export default function ExaminationRequests() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const { token } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const [status, setStatus] = useState<(typeof statuses)[number]>("PENDING");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ExamRequestDto | null>(null);
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [horseQuery, setHorseQuery] = useState("");
  const [horseId, setHorseId] = useState("");
  const [urgencyReason, setUrgencyReason] = useState("");
  const [dismissReason, setDismissReason] = useState("");
  const [saving, setSaving] = useState(false);
  const canCreate = role === "vet" || role === "manager" || role === "trainer";
  const isVet = role === "vet";
  const load = useCallback(
    () => medicalService.listExamRequests(token!, { page, limit: 20, status }),
    [page, status, token],
  );
  const resource = useApiResource(
    load,
    Boolean(token && role && ["vet", "manager", "trainer", "groom"].includes(role)),
  );
  useRefreshOnFocus(resource.revalidate);
  const loadHorses = useCallback(
    () =>
      horseService.list(token!, "", {
        lifecycleStatus: "ACTIVE",
        includeDeleted: false,
        myBarns: role === "trainer",
      }),
    [role, token],
  );
  const horsesResource = useApiResource(loadHorses, Boolean(token && role && canCreate));
  const visibleHorses = (horsesResource.data ?? [])
    .filter((horse) => horse.name.toLowerCase().includes(horseQuery.trim().toLowerCase()))
    .slice(0, 12);
  const hasMore = (resource.data?.meta.totalPages ?? page) > page;
  const hasPrevious = (resource.data?.meta.page ?? page) > 1;

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer", "groom"].includes(role))
    return <Redirect href={`/${role}` as Href} />;

  const runMutation = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try {
      await action();
      setSelected(null);
      setUrgencyReason("");
      setDismissReason("");
      await resource.refresh();
      Alert.alert("Updated", success);
    } catch (error) {
      Alert.alert("Could not update request", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!token || !horseId || !isValidRequiredText(description, 2000)) {
      Alert.alert(
        "Request details required",
        "Choose a horse and enter a description up to 2,000 characters.",
      );
      return;
    }
    setSaving(true);
    try {
      await medicalService.createExamRequest(token, horseId, {
        description: description.trim(),
        urgent,
      });
      setDescription("");
      setUrgent(false);
      setHorseId("");
      if (status === "PENDING" && page === 1) await resource.refresh();
      else {
        setStatus("PENDING");
        setPage(1);
      }
      Alert.alert("Request sent", "The request is now in the examination queue.");
    } catch (error) {
      Alert.alert("Could not create request", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role={role}
      title="Examination requests"
      subtitle={
        role === "groom"
          ? "Requests for horses assigned to you"
          : "Urgent requests are returned first"
      }
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      <Chips
        options={[...statuses]}
        value={status}
        onChange={(next) => {
          setStatus(next as (typeof statuses)[number]);
          setPage(1);
          setSelected(null);
        }}
      />

      {canCreate ? (
        <View style={uiStyles.section}>
          <SectionTitle>Create examination request</SectionTitle>
          <AsyncStateView
            isLoading={horsesResource.isLoading}
            error={horsesResource.error}
            onRetry={() => void horsesResource.retry()}
          />
          <Field label="Find horse">
            <NativeInput
              value={horseQuery}
              onChangeText={setHorseQuery}
              placeholder="Search active horses"
            />
          </Field>
          <Panel>
            {visibleHorses.map((horse) => (
              <Pressable
                key={horse.id}
                onPress={() => setHorseId(horse.id)}
                style={{ paddingVertical: 7 }}
              >
                <Text
                  style={{
                    ...uiStyles.value,
                    color: horseId === horse.id ? colors.primary : colors.foreground,
                  }}
                >
                  {horse.name} · {horse.location.barn?.name ?? "No barn"}
                </Text>
              </Pressable>
            ))}
            {!visibleHorses.length ? (
              <Text style={uiStyles.muted}>
                {horsesResource.isLoading ? "Loading horses…" : "No active horses match."}
              </Text>
            ) : null}
          </Panel>
          <Field label="Request details">
            <NativeInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Describe the signs that need examination"
            />
          </Field>
          <Chips
            options={["Standard", "Urgent"]}
            value={urgent ? "Urgent" : "Standard"}
            onChange={(value) => setUrgent(value === "Urgent")}
          />
          <PrimaryButton
            label={saving ? "Sending…" : "Send request"}
            icon="paper-plane-outline"
            disabled={saving || !horseId || !description.trim()}
            onPress={() => void create()}
          />
        </View>
      ) : null}

      <View style={uiStyles.section}>
        <SectionTitle>
          {status === "PENDING"
            ? "Waiting for examination"
            : status === "EXAMINED"
              ? "Examined"
              : "Dismissed"}
        </SectionTitle>
        {(resource.data?.items ?? []).map((request) => (
          <Panel key={request.id}>
            <Pressable
              onPress={() => {
                setSelected(selected?.id === request.id ? null : request);
                setUrgencyReason("");
                setDismissReason("");
              }}
            >
              <View style={uiStyles.row}>
                <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                  {request.horseName}
                </Text>
                <Text
                  style={{
                    ...uiStyles.label,
                    flexShrink: 0,
                    color:
                      request.status === "PENDING" && request.urgent
                        ? colors.destructive
                        : colors.monitor,
                  }}
                >
                  {request.status === "PENDING" && request.urgent ? "Urgent" : request.status}
                </Text>
              </View>
              <Text style={uiStyles.muted}>{request.description}</Text>
              <Text style={uiStyles.label}>
                {formatDateTime(request.createdAt)} · {request.source.replaceAll("_", " ")}
              </Text>
              <Text style={uiStyles.muted}>
                Requested by{" "}
                {request.requestedBy ? `staff ${request.requestedBy.slice(0, 8)}` : "system"}
              </Text>
              {request.dismissReason ? (
                <Text style={uiStyles.muted}>Reason: {request.dismissReason}</Text>
              ) : null}
            </Pressable>
            {selected?.id === request.id && request.status === "PENDING" ? (
              <View style={{ gap: 10, marginTop: 12 }}>
                {isVet ? (
                  <>
                    <PrimaryButton
                      label="Start examination"
                      icon="medkit-outline"
                      onPress={() =>
                        router.push(
                          `/${role}/medical/visit?horseId=${request.horseId}&requestId=${request.id}` as Href,
                        )
                      }
                    />
                    <Field
                      label={
                        request.urgent
                          ? "Reason to remove urgent priority"
                          : "Reason to mark urgent"
                      }
                    >
                      <NativeInput
                        value={urgencyReason}
                        onChangeText={setUrgencyReason}
                        multiline
                      />
                    </Field>
                    <SecondaryButton
                      label={request.urgent ? "Remove urgent priority" : "Mark urgent"}
                      disabled={saving || !isValidRequiredText(urgencyReason, 500)}
                      onPress={() =>
                        void runMutation(
                          () =>
                            medicalService.changeExamRequestUrgency(token!, request.id, {
                              urgent: !request.urgent,
                              reason: urgencyReason.trim(),
                            }),
                          "Urgency updated.",
                        )
                      }
                    />
                    <Field label="Dismiss reason">
                      <NativeInput
                        value={dismissReason}
                        onChangeText={setDismissReason}
                        multiline
                      />
                    </Field>
                    <SecondaryButton
                      label="Dismiss request"
                      disabled={saving || !isValidRequiredText(dismissReason, 500)}
                      onPress={() =>
                        Alert.alert(
                          "Dismiss request?",
                          "This request will leave the pending queue.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Dismiss",
                              style: "destructive",
                              onPress: () =>
                                void runMutation(
                                  () =>
                                    medicalService.dismissExamRequest(
                                      token!,
                                      request.id,
                                      dismissReason.trim(),
                                    ),
                                  "Request dismissed.",
                                ),
                            },
                          ],
                        )
                      }
                    />
                  </>
                ) : null}
                {role === "manager" || role === "trainer" ? (
                  <SecondaryButton
                    label="Open horse profile"
                    onPress={() => router.push(`/${role}/horse/${request.horseId}` as Href)}
                  />
                ) : null}
              </View>
            ) : null}
            {request.medicalRecordId ? (
              <SecondaryButton
                label="Open examination record"
                onPress={() =>
                  router.push(`/${role}/medical/visits/${request.medicalRecordId}` as Href)
                }
              />
            ) : null}
          </Panel>
        ))}
        {resource.data && !resource.data.items.length ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel="No requests in this status."
          />
        ) : null}
        <View style={uiStyles.row}>
          {hasPrevious ? (
            <SecondaryButton
              label="Previous page"
              style={{ flex: 1 }}
              onPress={() => {
                setSelected(null);
                setPage((current) => Math.max(1, current - 1));
              }}
            />
          ) : null}
          {hasMore ? (
            <SecondaryButton
              label="Next page"
              style={{ flex: 1 }}
              onPress={() => {
                setSelected(null);
                setPage((current) => current + 1);
              }}
            />
          ) : null}
        </View>
        {resource.data?.meta.totalPages ? (
          <Text style={uiStyles.muted}>
            Page {resource.data.meta.page ?? page} of {resource.data.meta.totalPages}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
