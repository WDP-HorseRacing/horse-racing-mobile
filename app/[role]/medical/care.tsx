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
import { medicalService, type CareTaskTypeDto } from "@/services/medical.service";
import type { CareScheduleDto } from "@/adapters/medical.adapter";
import {
  clubDateTimeParts,
  isNotPastDateTime,
  isUuid,
  isValidRequiredText,
  toClubDateTime,
} from "@/features/medical/medical-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";

const careTypes: CareTaskTypeDto[] = ["VACCINATION", "DEWORMING", "FARRIER"];

export default function CareSchedules() {
  const { role: roleParam, horseId: horseParam } = useLocalSearchParams<{
    role: string;
    horseId?: string;
  }>();
  const role = isRole(roleParam) ? roleParam : null;
  const horseId = Array.isArray(horseParam) ? horseParam[0] : (horseParam ?? "");
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const [initialDueParts] = useState(() =>
    clubDateTimeParts(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [selectedHorseId, setSelectedHorseId] = useState(horseId);
  const [type, setType] = useState<CareTaskTypeDto>("VACCINATION");
  const [dueDate, setDueDate] = useState(initialDueParts.date);
  const [dueTime, setDueTime] = useState(initialDueParts.time);
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editAssigneeChanged, setEditAssigneeChanged] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [nextDueTime, setNextDueTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const canManage = role === "vet";
  const canView = role && ["vet", "manager", "trainer", "groom", "owner"].includes(role);
  const loadSchedule = useCallback(
    () => medicalService.listCareSchedules(token!, selectedHorseId),
    [selectedHorseId, token],
  );
  const resource = useApiResource(loadSchedule, Boolean(token && selectedHorseId && canView));
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
  const horsesResource = useApiResource(loadHorses, Boolean(token && !selectedHorseId && canView));
  const horse = horsesResource.data?.find((item) => item.id === selectedHorseId);
  const schedules = resource.data ?? [];
  const selected = schedules.find((item) => item.id === selectedScheduleId);

  if (!role) return <Redirect href="/" />;
  if (!canView) return <Redirect href={`/${role}` as Href} />;

  const createSchedule = async () => {
    const dueAt = toClubDateTime(dueDate, dueTime);
    if (!selectedHorseId || !dueAt || !isNotPastDateTime(dueAt)) {
      Alert.alert(
        "Schedule details required",
        "Choose a horse and a valid due date that is not in the past.",
      );
      return;
    }
    if (notes.trim().length > 2000) {
      Alert.alert("Care notes are too long", "Care notes are limited to 2,000 characters.");
      return;
    }
    if (assignedTo.trim() && !isUuid(assignedTo.trim())) {
      Alert.alert("Invalid assignee", "Enter a valid staff UUID or leave the schedule unassigned.");
      return;
    }
    setSaving(true);
    try {
      await medicalService.createCareSchedule(token!, selectedHorseId, {
        type,
        dueAt,
        ...(assignedTo.trim() ? { assignedTo: assignedTo.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setNotes("");
      setAssignedTo("");
      await resource.refresh();
      Alert.alert("Schedule created", "The new care schedule is available to assigned staff.");
    } catch (error) {
      Alert.alert("Could not create schedule", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = async () => {
    if (!selected || !token) return;
    const dueAt = editDate ? toClubDateTime(editDate, editTime || "09:00") : null;
    if (editDate && (!dueAt || !isNotPastDateTime(dueAt))) {
      Alert.alert("Invalid due date", "Choose a valid date and time that is not in the past.");
      return;
    }
    if (dueAt && !isValidRequiredText(editReason, 500)) {
      Alert.alert(
        "Reason required",
        "Enter a reason up to 500 characters when moving a scheduled care date.",
      );
      return;
    }
    if (editAssignee.trim() && !isUuid(editAssignee.trim())) {
      Alert.alert("Invalid assignee", "Enter a valid staff UUID, or leave it empty to unassign.");
      return;
    }
    setSaving(true);
    try {
      await medicalService.updateCareSchedule(token, selected.id, {
        ...(dueAt ? { dueAt, reason: editReason.trim() } : {}),
        ...(editAssigneeChanged ? { assignedTo: editAssignee.trim() || null } : {}),
        ...(editNotes !== (selected.notes ?? "") ? { notes: editNotes.trim() || null } : {}),
      });
      setSelectedScheduleId("");
      setEditDate("");
      setEditTime("09:00");
      setEditReason("");
      setEditAssignee("");
      setEditAssigneeChanged(false);
      setEditNotes("");
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not update schedule", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const completeSchedule = async (schedule: CareScheduleDto) => {
    const nextDueAt = nextDueDate ? toClubDateTime(nextDueDate, nextDueTime) : null;
    if (role === "vet" && nextDueDate && (!nextDueAt || !isNotPastDateTime(nextDueAt))) {
      Alert.alert("Invalid next date", "Choose a valid future date for the next schedule.");
      return;
    }
    setSaving(true);
    try {
      await medicalService.completeCareSchedule(
        token!,
        schedule.id,
        role === "vet" ? (nextDueAt ?? undefined) : undefined,
      );
      setNextDueDate("");
      setSelectedScheduleId("");
      await resource.refresh();
      Alert.alert(
        "Schedule completed",
        role === "vet" && nextDueAt
          ? "The next occurrence was created by the Backend."
          : "The schedule is marked complete.",
      );
    } catch (error) {
      Alert.alert("Could not complete schedule", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const cancelSchedule = (schedule: CareScheduleDto) =>
    Alert.alert("Cancel care schedule?", "This is a final schedule state.", [
      { text: "Keep schedule", style: "cancel" },
      {
        text: "Cancel schedule",
        style: "destructive",
        onPress: () => {
          if (!isValidRequiredText(cancelReason, 500)) {
            setSelectedScheduleId(schedule.id);
            Alert.alert(
              "Reason required",
              "Enter a cancellation reason up to 500 characters in the schedule details first.",
            );
            return;
          }
          setSaving(true);
          void medicalService
            .cancelCareSchedule(token!, schedule.id, cancelReason.trim())
            .then(async () => {
              setCancelReason("");
              setSelectedScheduleId("");
              await resource.refresh();
            })
            .catch((error) => Alert.alert("Could not cancel schedule", extractErrorMessage(error)))
            .finally(() => setSaving(false));
        },
      },
    ]);

  return (
    <Screen
      role={role}
      title="Care schedules"
      subtitle={
        selectedHorseId
          ? (horse?.name ?? "Horse care history")
          : "Select a horse to view care history"
      }
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading || horsesResource.isLoading}
        error={resource.error ?? horsesResource.error}
        onRetry={() => {
          void resource.retry();
          void horsesResource.retry();
        }}
      />
      {!selectedHorseId ? (
        <View style={uiStyles.section}>
          <SectionTitle>Choose an active horse</SectionTitle>
          <Panel>
            {(horsesResource.data ?? []).slice(0, 40).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedHorseId(item.id)}
                style={{ paddingVertical: 7 }}
              >
                <Text style={uiStyles.value}>
                  {item.name} · {item.location.barn?.name ?? "No barn"}
                </Text>
              </Pressable>
            ))}
          </Panel>
        </View>
      ) : (
        <>
          {canManage ? (
            <View style={uiStyles.section}>
              <SectionTitle>Create schedule</SectionTitle>
              <Chips
                options={careTypes}
                value={type}
                onChange={(value) => setType(value as CareTaskTypeDto)}
              />
              <Field label="Due date (YYYY-MM-DD)">
                <NativeInput value={dueDate} onChangeText={setDueDate} />
              </Field>
              <Field label="Due time (24-hour)">
                <NativeInput value={dueTime} onChangeText={setDueTime} />
              </Field>
              <Field label="Assigned staff UUID (optional)">
                <NativeInput
                  value={assignedTo}
                  onChangeText={setAssignedTo}
                  placeholder="Paste a VET or Groom user ID"
                />
              </Field>
              <Field label="Care notes">
                <NativeInput value={notes} onChangeText={setNotes} multiline />
              </Field>
              <PrimaryButton
                label={saving ? "Creating…" : "Create care schedule"}
                disabled={saving}
                onPress={() => void createSchedule()}
              />
            </View>
          ) : null}
          <View style={uiStyles.section}>
            <SectionTitle>Schedule history</SectionTitle>
            {schedules.map((schedule) => (
              <Panel key={schedule.id}>
                <View style={uiStyles.row}>
                  <Text style={uiStyles.value}>{schedule.type.replaceAll("_", " ")}</Text>
                  <Text style={uiStyles.label}>{schedule.status}</Text>
                </View>
                <Text style={uiStyles.muted}>
                  Due {formatDateTime(schedule.dueAt)} · assigned{" "}
                  {schedule.assignedTo ? schedule.assignedTo.slice(0, 8) : "nobody"}
                </Text>
                {schedule.notes ? <Text>{schedule.notes}</Text> : null}
                {schedule.completedAt ? (
                  <Text style={uiStyles.muted}>
                    Completed {formatDateTime(schedule.completedAt)}
                  </Text>
                ) : null}
                {schedule.cancelReason ? (
                  <Text style={uiStyles.muted}>Cancelled: {schedule.cancelReason}</Text>
                ) : null}
                {schedule.status === "SCHEDULED" ? (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {canManage ? (
                      <SecondaryButton
                        label="Reschedule or reassign"
                        onPress={() => {
                          setEditDate("");
                          setEditTime("09:00");
                          setEditReason("");
                          setEditAssignee(schedule.assignedTo ?? "");
                          setEditAssigneeChanged(false);
                          setEditNotes(schedule.notes ?? "");
                          setCancelReason("");
                          setSelectedScheduleId(
                            selectedScheduleId === schedule.id ? "" : schedule.id,
                          );
                        }}
                      />
                    ) : null}
                    {role === "vet" ||
                    (role === "groom" && schedule.assignedTo === user?.userId) ? (
                      <>
                        {role === "vet" && selectedScheduleId === schedule.id ? (
                          <>
                            <Field label="Next occurrence due date (optional)">
                              <NativeInput
                                value={nextDueDate}
                                onChangeText={setNextDueDate}
                                placeholder="YYYY-MM-DD"
                              />
                            </Field>
                            <Field label="Next occurrence time">
                              <NativeInput value={nextDueTime} onChangeText={setNextDueTime} />
                            </Field>
                          </>
                        ) : null}
                        <SecondaryButton
                          label={saving ? "Completing…" : "Mark completed"}
                          disabled={saving}
                          onPress={() =>
                            Alert.alert(
                              "Complete this schedule?",
                              role === "vet" && nextDueDate
                                ? "The Backend will create the next occurrence after completion."
                                : "This will mark the assigned care task complete.",
                              [
                                { text: "Back", style: "cancel" },
                                {
                                  text: "Complete",
                                  onPress: () => void completeSchedule(schedule),
                                },
                              ],
                            )
                          }
                        />
                      </>
                    ) : null}
                    {canManage ? (
                      <>
                        {selectedScheduleId === schedule.id ? (
                          <>
                            <Field label="New due date (leave empty to keep)">
                              <NativeInput
                                value={editDate}
                                onChangeText={setEditDate}
                                placeholder="YYYY-MM-DD"
                              />
                            </Field>
                            <Field label="New due time">
                              <NativeInput value={editTime} onChangeText={setEditTime} />
                            </Field>
                            {editDate ? (
                              <Field label="Reschedule reason">
                                <NativeInput
                                  value={editReason}
                                  onChangeText={setEditReason}
                                  multiline
                                />
                              </Field>
                            ) : null}
                            <Field label="New assignee UUID (empty removes assignment)">
                              <NativeInput
                                value={editAssignee}
                                onChangeText={(value) => {
                                  setEditAssignee(value);
                                  setEditAssigneeChanged(true);
                                }}
                              />
                            </Field>
                            <Field label="Care notes (empty clears notes)">
                              <NativeInput
                                value={editNotes}
                                onChangeText={setEditNotes}
                                multiline
                              />
                            </Field>
                            <PrimaryButton
                              label={saving ? "Saving…" : "Save changes"}
                              disabled={saving}
                              onPress={() => void updateSchedule()}
                            />
                            <Field label="Cancellation reason">
                              <NativeInput
                                value={cancelReason}
                                onChangeText={setCancelReason}
                                multiline
                              />
                            </Field>
                            <SecondaryButton
                              label="Cancel schedule"
                              disabled={saving || !isValidRequiredText(cancelReason, 500)}
                              onPress={() => cancelSchedule(schedule)}
                            />
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                ) : null}
              </Panel>
            ))}
            {resource.data && !schedules.length ? (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => undefined}
                empty
                emptyLabel="No care schedules for this horse."
              />
            ) : null}
          </View>
          <SecondaryButton
            label="Open horse medical record"
            onPress={() => router.push(`/${role}/horse/${selectedHorseId}` as Href)}
          />
        </>
      )}
      <Panel>
        <Text style={uiStyles.muted}>
          Only the veterinarian can manage schedules. Groom can complete their own assigned work.
          Recurrence is supported by supplying the next due date when completing an occurrence.
        </Text>
      </Panel>
    </Screen>
  );
}
