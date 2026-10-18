import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { groomService } from "@/services/groom.service";
import { orderedMeals, stableCareService } from "@/services/stable-care.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime, formatTime } from "@/utils/formatters";

export default function GroomTasks() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const loadToday = useCallback(() => groomService.getToday(token!), [token]);
  const resource = useApiResource(loadToday, Boolean(token));
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const horses = resource.data?.horses ?? [];
  const tracked = horses.flatMap((horse) => horse.checklist?.items ?? []);
  const done = tracked.filter((item) => item.done).length;
  const progress = tracked.length ? Math.round((done / tracked.length) * 100) : 0;

  const updateChecklist = async (itemId: string, nextDone: boolean, itemNote?: string | null) => {
    if (!token) return;
    setBusyId(itemId);
    try {
      await stableCareService.tickChecklistItem(token, itemId, {
        done: nextDone,
        ...(itemNote !== undefined ? { note: itemNote } : {}),
      });
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not update checklist", extractErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };
  const actOnRun = async (participantId: string, action: "check-in" | "ready") => {
    setBusyId(participantId);
    try {
      if (action === "check-in") await groomService.checkIn(token!, participantId);
      else await groomService.markReady(token!, participantId);
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not update training run", extractErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };
  const completeCare = async (scheduleId: string) => {
    setBusyId(scheduleId);
    try {
      await groomService.completeCareSchedule(token!, scheduleId);
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not complete care schedule", extractErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen
      role="groom"
      title="Groom Today"
      subtitle={
        resource.data
          ? `${resource.data.date} · ${done} of ${tracked.length} checklist items complete`
          : "Assigned horses and today's work"
      }
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && horses.length === 0}
        emptyLabel="No horses are assigned to you today."
      />
      {resource.data && horses.length ? (
        <>
          <Panel>
            <View style={ui.row}>
              <Text style={ui.value}>Checklist progress</Text>
              <Text style={ui.value}>{progress}%</Text>
            </View>
            <View style={{ height: 10 }} />
            <ProgressBar value={progress} />
          </Panel>
          {horses.map((horse) => (
            <View key={horse.horseId} style={ui.section}>
              <SectionTitle>{horse.horseName}</SectionTitle>
              <Panel>
                <Text style={ui.value}>
                  {[horse.barnName, horse.stallCode].filter(Boolean).join(" · ") ||
                    "No barn or stall assigned"}
                </Text>
                <SecondaryButton
                  label="Report incident"
                  icon="camera-outline"
                  onPress={() =>
                    router.push(`/groom/report?horseId=${encodeURIComponent(horse.horseId)}`)
                  }
                />
              </Panel>

              <Text style={ui.value}>Feeding plan</Text>
              {horse.feedingPlan ? (
                <Panel>
                  <Text style={ui.muted}>
                    {horse.feedingPlan.status}
                    {horse.feedingPlan.note ? ` · ${horse.feedingPlan.note}` : ""}
                  </Text>
                  {orderedMeals(horse.feedingPlan.meals).map((meal) => (
                    <View key={meal.meal} style={{ marginTop: 8 }}>
                      <Text style={ui.value}>{mealLabel(meal.meal)}</Text>
                      {meal.items.map((item, index) => (
                        <Text key={`${meal.meal}-${item.supplyItemId}-${index}`} style={ui.muted}>
                          • {item.name} · {item.quantity} {item.unit}
                          {item.note ? ` · ${item.note}` : ""}
                        </Text>
                      ))}
                    </View>
                  ))}
                </Panel>
              ) : (
                <Text style={ui.muted}>No active feeding plan.</Text>
              )}

              <Text style={ui.value}>
                Daily checklist{horse.checklist ? ` · ${horse.checklist.status}` : ""}
              </Text>
              {horse.checklist ? (
                <Panel>
                  {horse.checklist.items.map((item) => (
                    <View key={item.id} style={{ paddingVertical: 8, gap: 6 }}>
                      <View style={ui.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={ui.value}>
                            {item.name} · {item.done ? "Done" : "Open"}
                          </Text>
                          <Text style={ui.muted}>
                            {item.doer?.fullName ?? "Not completed"}
                            {item.doneAt ? ` · ${formatTime(item.doneAt)}` : ""}
                            {item.note ? ` · ${item.note}` : ""}
                          </Text>
                        </View>
                        <SecondaryButton
                          label={busyId === item.id ? "Saving…" : item.done ? "Undo" : "Done"}
                          onPress={() => void updateChecklist(item.id, !item.done)}
                          disabled={busyId === item.id || horse.checklist?.status === "INCOMPLETE"}
                        />
                      </View>
                      {noteItemId === item.id ? (
                        <>
                          <Field label="Checklist note">
                            <NativeInput
                              value={note}
                              onChangeText={setNote}
                              placeholder="Optional note"
                            />
                          </Field>
                          <View style={ui.row}>
                            <SecondaryButton label="Cancel" onPress={() => setNoteItemId(null)} />
                            <PrimaryButton
                              label="Save note"
                              onPress={() =>
                                void updateChecklist(item.id, item.done, note.trim() || null).then(
                                  () => setNoteItemId(null),
                                )
                              }
                              disabled={busyId === item.id}
                            />
                          </View>
                        </>
                      ) : (
                        <SecondaryButton
                          label="Add or edit note"
                          onPress={() => {
                            setNoteItemId(item.id);
                            setNote(item.note ?? "");
                          }}
                        />
                      )}
                    </View>
                  ))}
                </Panel>
              ) : (
                <Text style={ui.muted}>No checklist has been generated for today.</Text>
              )}

              <Text style={ui.value}>Training runs</Text>
              {horse.trainingRuns.length ? (
                horse.trainingRuns.map((run) => (
                  <Panel key={run.participantId}>
                    <Text style={ui.value}>{run.sessionName}</Text>
                    <Text style={ui.muted}>
                      {formatTime(run.scheduledStartAt)}–{formatTime(run.scheduledEndAt)} ·{" "}
                      {run.status}
                    </Text>
                    {run.status === "PLANNED" ? (
                      <PrimaryButton
                        label="Check in"
                        onPress={() => void actOnRun(run.participantId, "check-in")}
                        disabled={busyId === run.participantId}
                      />
                    ) : null}
                    {run.status === "PRESENT" ? (
                      <PrimaryButton
                        label="Mark ready"
                        onPress={() => void actOnRun(run.participantId, "ready")}
                        disabled={busyId === run.participantId}
                      />
                    ) : null}
                  </Panel>
                ))
              ) : (
                <Text style={ui.muted}>No training runs assigned today.</Text>
              )}

              <Text style={ui.value}>Care schedules</Text>
              {horse.careSchedules.length ? (
                horse.careSchedules.map((schedule) => (
                  <Panel key={schedule.id}>
                    <Text style={ui.value}>
                      {schedule.type.replaceAll("_", " ")}
                      {schedule.overdue ? " · OVERDUE" : ""}
                    </Text>
                    <Text style={ui.muted}>
                      {formatDateTime(schedule.dueAt)}
                      {schedule.notes ? ` · ${schedule.notes}` : ""}
                    </Text>
                    <PrimaryButton
                      label={busyId === schedule.id ? "Saving…" : "Complete care"}
                      onPress={() => void completeCare(schedule.id)}
                      disabled={busyId === schedule.id}
                    />
                  </Panel>
                ))
              ) : (
                <Text style={ui.muted}>No care schedules are due.</Text>
              )}
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function mealLabel(meal: string): string {
  switch (meal) {
    case "EARLY_MORNING":
      return "Early morning";
    case "NOON":
      return "Noon";
    case "AFTERNOON":
      return "Afternoon";
    default:
      return "Evening";
  }
}
