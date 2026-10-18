import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { Chips, Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { Screen } from "@/components/common";
import { trainingService } from "@/services/training.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { useTheme } from "@/hooks/useTheme";
import { safeBack } from "@/utils/navigation";

const scoreOptions = Array.from({ length: 10 }, (_, index) => String(index + 1));

export default function SessionEvaluation() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { id, horse, session } = useLocalSearchParams<{ id: string; horse?: string; session?: string }>();
  const participantId = Array.isArray(id) ? id[0] : id;
  const horseName = Array.isArray(horse) ? horse[0] : horse;
  const sessionTitle = Array.isArray(session) ? session[0] : session;
  const { token } = useAuth();
  const [score, setScore] = useState("8");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!token || !participantId) return;
    setSaving(true);
    try {
      await trainingService.createEvaluation(token, participantId, { score: Number(score), ...(comment.trim() ? { comment: comment.trim() } : {}) });
      Alert.alert("Evaluation saved", "Training session evaluation has been recorded.", [{ text: "OK", onPress: () => safeBack("/trainer/training") }]);
    } catch (error) {
      Alert.alert("Could not save evaluation", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen role="trainer" title="Session evaluation" subtitle={horseName ?? "Score the horse’s performance"} back fallbackHref="/trainer/training">
      {sessionTitle ? <Panel><Text style={uiStyles.value}>{sessionTitle}</Text><Text style={uiStyles.muted}>{horseName ?? ""}</Text></Panel> : null}
      <Panel><Text style={uiStyles.muted}>Score is from 1 to 10. The evaluation is attached to this session participant.</Text></Panel>
      <View style={{ gap: 18 }}>
        <Field label="Performance score"><Chips options={scoreOptions} value={score} onChange={setScore} /></Field>
        <Field label="Trainer notes"><NativeInput value={comment} onChangeText={setComment} multiline placeholder="Stride, breathing, temperament, next adjustment…" /></Field>
      </View>
      <PrimaryButton label={saving ? "Saving…" : "Save evaluation"} icon="checkmark" onPress={() => void save()} disabled={saving} />
    </Screen>
  );
}
