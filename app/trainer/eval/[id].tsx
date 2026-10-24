import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { Chips, Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { AsyncStateView, Screen } from "@/components/common";
import { useApiResource } from "@/hooks/useApiResource";
import { trainingService } from "@/services/training.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { useTheme } from "@/hooks/useTheme";
import { safeBack } from "@/utils/navigation";

const scoreOptions = Array.from({ length: 10 }, (_, index) => String(index + 1));

export default function SessionEvaluation() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { id, horse, session, edit: editParam } = useLocalSearchParams<{
    id: string;
    horse?: string;
    session?: string;
    edit?: string;
  }>();
  const participantId = Array.isArray(id) ? id[0] : id;
  const horseName = Array.isArray(horse) ? horse[0] : horse;
  const sessionTitle = Array.isArray(session) ? session[0] : session;
  const editMode = (Array.isArray(editParam) ? editParam[0] : editParam) === "1";
  const { token } = useAuth();
  const [score, setScore] = useState("8");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(
    () => (editMode ? trainingService.getEvaluation(token!, participantId) : Promise.resolve(null)),
    [editMode, participantId, token],
  );
  const resource = useApiResource(load, Boolean(token && participantId && editMode));
  useEffect(() => {
    if (!resource.data) return;
    setScore(String(resource.data.score));
    setComment(resource.data.comment ?? "");
  }, [resource.data]);

  const save = async () => {
    if (!token || !participantId) return;
    if (editMode && !reason.trim()) {
      Alert.alert("Reason required", "Enter why this evaluation is being corrected (up to 500 characters).");
      return;
    }
    setSaving(true);
    try {
      if (editMode && resource.data) {
        const update: { score?: number; comment?: string | null; reason: string } = {
          reason: reason.trim(),
        };
        const nextScore = Number(score);
        if (nextScore !== resource.data.score) update.score = nextScore;
        const nextComment = comment.trim();
        if (nextComment !== (resource.data.comment ?? "")) update.comment = nextComment || null;
        if (update.score === undefined && update.comment === undefined) {
          Alert.alert("No changes", "Change the score or comment before saving.");
          return;
        }
        await trainingService.updateEvaluation(token, participantId, update);
      } else {
        await trainingService.createEvaluation(token, participantId, {
          score: Number(score),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        });
      }
      Alert.alert("Evaluation saved", editMode ? "The correction was recorded with its reason." : "Training session evaluation has been recorded.", [
        { text: "OK", onPress: () => safeBack("/trainer/training") },
      ]);
    } catch (error) {
      Alert.alert("Could not save evaluation", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role="trainer"
      title={editMode ? "Edit session evaluation" : "Session evaluation"}
      subtitle={horseName ?? "Score the horse’s performance"}
      back
      fallbackHref="/trainer/training"
    >
      {sessionTitle ? (
        <Panel>
          <Text style={uiStyles.value}>{sessionTitle}</Text>
          <Text style={uiStyles.muted}>{horseName ?? ""}</Text>
        </Panel>
      ) : null}
      {editMode ? (
        <AsyncStateView
          isLoading={resource.isLoading}
          error={resource.error}
          onRetry={() => void resource.retry()}
        />
      ) : null}
      <Panel>
        <Text style={uiStyles.muted}>
          Score is from 1 to 10. The evaluation is attached to this session participant.
        </Text>
      </Panel>
      <View style={{ gap: 18 }}>
        <Field label="Performance score">
          <Chips options={scoreOptions} value={score} onChange={setScore} />
        </Field>
        <Field label="Trainer notes">
          <NativeInput
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="Stride, breathing, temperament, next adjustment…"
          />
        </Field>
        {editMode ? (
          <Field label="Reason for correction · required">
            <NativeInput
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={500}
              placeholder="Explain why this evaluation is being corrected"
            />
          </Field>
        ) : null}
      </View>
      <PrimaryButton
        label={saving ? "Saving…" : editMode ? "Save correction" : "Save evaluation"}
        icon="checkmark"
        onPress={() => void save()}
        disabled={saving || (editMode && (!resource.data || !reason.trim()))}
      />
    </Screen>
  );
}
