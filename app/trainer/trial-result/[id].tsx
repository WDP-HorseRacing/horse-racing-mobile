import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen } from "@/components/common";
import {
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { safeBack } from "@/utils/navigation";
import { useTheme } from "@/hooks/useTheme";
import { trainingService } from "@/services/training.service";
import { formatDurationMs } from "@/utils/formatters";
import { parseTrialDurationMs } from "@/features/training/training-utils";
import { extractErrorMessage } from "@/utils/errorHandler";
import { TrialVideoPicker } from "@/features/training/TrialVideoPicker";

export default function TrialResultEntry() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const {
    id,
    sessionId,
    horse,
    attemptNo: attemptParam,
    videoOnly: videoOnlyParam,
    editResult: editResultParam,
  } = useLocalSearchParams<{
    id: string;
    sessionId: string;
    horse?: string;
    attemptNo?: string;
    videoOnly?: string;
    editResult?: string;
  }>();
  const participantId = Array.isArray(id) ? id[0] : id;
  const sessionKey = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const horseName = Array.isArray(horse) ? horse[0] : horse;
  const rawAttemptNo = Array.isArray(attemptParam) ? attemptParam[0] : attemptParam;
  const videoOnly = (Array.isArray(videoOnlyParam) ? videoOnlyParam[0] : videoOnlyParam) === "1";
  const editResult = (Array.isArray(editResultParam) ? editResultParam[0] : editResultParam) === "1";
  const editingAttemptNo = Number(rawAttemptNo);
  const { token } = useAuth();
  const [attemptNo, setAttemptNo] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [notes, setNotes] = useState("");
  const [videoMediaId, setVideoMediaId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [initializedEdit, setInitializedEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const [session, results, participants] = await Promise.all([
      trainingService.getSession(token!, sessionKey),
      trainingService.listTrialResults(token!, participantId),
      trainingService.listSessionParticipants(token!, sessionKey),
    ]);
    const participant = participants.find((item) => item.id === participantId);
    if (!participant) throw new Error("This training participant is no longer available.");
    return { session, results, participant };
  }, [token, sessionKey, participantId]);
  const resource = useApiResource(load, Boolean(token && sessionKey && participantId));

  const suggestedAttemptNo = String(
    Math.max(0, ...(resource.data?.results ?? []).map((result) => result.attemptNo)) + 1,
  );
  const existingResult = resource.data?.results.find(
    (result) => result.attemptNo === editingAttemptNo,
  );
  const canWriteResult = Boolean(
    resource.data &&
      ["IN_PROGRESS", "COMPLETED"].includes(resource.data.session.status) &&
      ["ONGOING", "COMPLETED", "STOPPED"].includes(resource.data.participant.status),
  );

  useEffect(() => {
    if (!editResult || !existingResult || initializedEdit) return;
    setAttemptNo(String(existingResult.attemptNo));
    setElapsed(formatDurationMs(existingResult.elapsedMs));
    setNotes(existingResult.notes ?? "");
    setVideoMediaId(existingResult.videoMediaId);
    setInitializedEdit(true);
  }, [editResult, existingResult, initializedEdit]);

  const save = async () => {
    if (!token || !resource.data) return;
    if (editResult) {
      if (!existingResult) return;
      const elapsedMs = parseTrialDurationMs(elapsed);
      if (!elapsedMs) {
        return Alert.alert("Check the result", "Enter a time as mm:ss.t, for example 01:24.5.");
      }
      const update: {
        elapsedMs?: number;
        notes?: string | null;
        videoMediaId?: string | null;
        reason?: string;
      } = {};
      if (elapsedMs !== existingResult.elapsedMs) update.elapsedMs = elapsedMs;
      const nextNotes = notes.trim();
      if (nextNotes !== (existingResult.notes ?? "")) update.notes = nextNotes || null;
      if (videoMediaId !== existingResult.videoMediaId) update.videoMediaId = videoMediaId;
      const changesCoreFields = update.elapsedMs !== undefined || update.notes !== undefined;
      if (changesCoreFields && !reason.trim()) {
        return Alert.alert("Reason required", "Enter why the time or notes are being corrected.");
      }
      if (changesCoreFields) update.reason = reason.trim();
      if (!Object.keys(update).length) {
        return Alert.alert("No changes", "Change a value before saving.");
      }
      setSaving(true);
      try {
        await trainingService.updateTrialResult(
          token,
          participantId,
          editingAttemptNo,
          update,
        );
        Alert.alert("Trial result updated", "The correction was saved with its audit reason.", [
          { text: "OK", onPress: () => safeBack("/trainer/training") },
        ]);
      } catch (error) {
        Alert.alert("Could not update trial result", extractErrorMessage(error));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (videoOnly) {
      if (!Number.isInteger(editingAttemptNo) || editingAttemptNo < 1 || !videoMediaId) {
        return Alert.alert("Choose a video", "Upload a video before attaching it to this result.");
      }
      setSaving(true);
      try {
        await trainingService.updateTrialVideo(
          token,
          participantId,
          editingAttemptNo,
          videoMediaId,
        );
        Alert.alert("Video attached", "The trial result video has been updated.", [
          { text: "OK", onPress: () => safeBack("/trainer/training") },
        ]);
      } catch (error) {
        Alert.alert("Could not attach video", extractErrorMessage(error));
      } finally {
        setSaving(false);
      }
      return;
    }
    const elapsedMs = parseTrialDurationMs(elapsed);
    const attempt = Number(attemptNo || suggestedAttemptNo);
    if (!elapsedMs || !Number.isInteger(attempt) || attempt < 1 || attempt > 2_147_483_647)
      return Alert.alert(
        "Check the result",
        "Enter a time as mm:ss.t (for example 01:24.5) and an attempt number from 1 to 2,147,483,647.",
      );
    setSaving(true);
    try {
      await trainingService.createTrialResult(token, participantId, {
        attemptNo: attempt,
        elapsedMs,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(videoMediaId ? { videoMediaId } : {}),
      });
      Alert.alert("Result saved", `Attempt ${attempt}: ${formatDurationMs(elapsedMs)}`, [
        {
          text: "OK",
          onPress: () => safeBack("/trainer/training"),
        },
      ]);
    } catch (error) {
      Alert.alert("Could not save trial result", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const removeVideo = () => {
    if (!token || !existingResult?.videoMediaId) return;
    Alert.alert("Remove trial video?", "The recorded time and notes will stay unchanged.", [
      { text: "Keep video", style: "cancel" },
      {
        text: "Remove video",
        style: "destructive",
        onPress: () =>
          void (async () => {
            setSaving(true);
            try {
              await trainingService.updateTrialVideo(token, participantId, editingAttemptNo, null);
              await resource.refresh();
            } catch (error) {
              Alert.alert("Could not remove video", extractErrorMessage(error));
            } finally {
              setSaving(false);
            }
          })(),
      },
    ]);
  };

  return (
    <Screen
      role="trainer"
      title={videoOnly ? "Manage trial video" : editResult ? "Edit trial result" : "Record trial result"}
      subtitle={horseName ?? "Time trial"}
      back
      fallbackHref="/trainer/training"
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data ? (
        <>
          <Panel style={{ gap: 6 }}>
            <Text style={ui.value}>{resource.data.session.name}</Text>
            <Text style={ui.muted}>
              {resource.data.session.status.replaceAll("_", " ")} · {resource.data.results.length}{" "}
              recorded attempts
            </Text>
            {videoOnly && existingResult ? (
              <Text style={ui.label}>
                Attempt {existingResult.attemptNo} · {formatDurationMs(existingResult.elapsedMs)}
                {existingResult.videoMediaId ? " · video attached" : " · no video"}
              </Text>
            ) : null}
            {!videoOnly && !canWriteResult ? (
              <Text style={{ ...ui.muted, color: colors.destructive }}>
                Results can be recorded or corrected while the session is in progress or completed and the horse has an active, completed, or stopped run.
              </Text>
            ) : null}
          </Panel>
          {!videoOnly ? (
            <View style={{ gap: 12 }}>
              <Field label="Attempt number">
                <NativeInput
                  value={attemptNo || suggestedAttemptNo}
                  onChangeText={setAttemptNo}
                  keyboardType="number-pad"
                  editable={!editResult}
                />
              </Field>
              <Field label="Elapsed time (mm:ss.t)">
                <NativeInput value={elapsed} onChangeText={setElapsed} placeholder="01:24.5" />
              </Field>
              <Field label="Result notes (optional)">
                <NativeInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Conditions, pace, track notes"
                />
              </Field>
              {editResult ? (
                <Field label="Reason for correction · required for time or notes">
                  <NativeInput
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    maxLength={500}
                    placeholder="Explain why this trial result is being corrected"
                  />
                </Field>
              ) : null}
              <TrialVideoPicker
                token={token!}
                value={videoMediaId}
                onChange={setVideoMediaId}
                disabled={saving}
              />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {existingResult?.videoUrl ? (
                <Text style={ui.muted}>
                  A video is already attached. Upload a replacement or remove it.
                </Text>
              ) : (
                <Text style={ui.muted}>
                  Attach a video uploaded by your account. Backend availability rules apply.
                </Text>
              )}
              <TrialVideoPicker
                token={token!}
                value={videoMediaId}
                onChange={setVideoMediaId}
                disabled={saving}
              />
              {existingResult?.videoMediaId ? (
                <SecondaryButton
                  label="Remove current video"
                  icon="trash-outline"
                  disabled={saving}
                  onPress={removeVideo}
                />
              ) : null}
            </View>
          )}
          {resource.data.results.length ? (
            <View style={ui.section}>
              <Text style={ui.label}>Recorded in this session</Text>
              {resource.data.results.map((result) => (
                <Panel key={result.id}>
                  <Text style={ui.value}>
                    Attempt {result.attemptNo} · {formatDurationMs(result.elapsedMs)}
                  </Text>
                  <Text style={ui.muted}>{result.notes ?? "No notes"}</Text>
                </Panel>
              ))}
            </View>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              gap: 10,
              width: "100%",
              marginTop: 8,
            }}
          >
            <SecondaryButton
              label="Cancel"
              icon="close"
              style={{ flex: 1, minHeight: 48 }}
              onPress={() => safeBack("/trainer/training")}
            />
            <PrimaryButton
              label={saving ? "Saving…" : videoOnly ? "Save video" : editResult ? "Save correction" : "Save trial result"}
              icon="checkmark"
              style={{ flex: 1, minHeight: 48 }}
              disabled={
                saving ||
                (videoOnly
                  ? !videoMediaId || !existingResult
                  : editResult
                    ? !canWriteResult || !existingResult || !elapsed.trim()
                    : !canWriteResult)
              }
              onPress={() => void save()}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}
