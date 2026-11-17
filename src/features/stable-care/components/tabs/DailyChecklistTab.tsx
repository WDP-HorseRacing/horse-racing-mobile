import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, SectionTitle } from "@/components/common";
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
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { stableCareService } from "@/services/stable-care.service";
import { mediaService, type LocalMediaAsset } from "@/services/media.service";
import {
  ChecklistEvidenceLink,
  ChecklistEvidenceSheet,
} from "@/features/stable-care/ChecklistEvidenceSheet";
import { extractErrorMessage } from "@/utils/errorHandler";
import {
  isDateOnly,
  isValidChecklistRange,
} from "@/features/stable-care/stable-care-validation";
import { formatDate, formatTime } from "@/utils/formatters";
import {
  CHECKLIST_RANGE_PRESETS,
  todayDate,
  daysAgoDate,
  getCareStyles,
} from "./stableCareHelpers";

export function DailyChecklistTab({ role, horseId }: { role: string; horseId: string }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const [from, setFrom] = useState(daysAgoDate(6));
  const [to, setTo] = useState(todayDate());
  const [range, setRange] = useState({ from: daysAgoDate(6), to: todayDate() });
  const [regenerating, setRegenerating] = useState(false);
  const [evidenceItemId, setEvidenceItemId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const load = useCallback(
    () => stableCareService.listChecklists(token!, horseId, range.from, range.to),
    [horseId, range.from, range.to, token],
  );
  const resource = useApiResource(load, Boolean(token && horseId));

  const handleRegenerateChecklists = async () => {
    if (!token) return;
    setRegenerating(true);
    try {
      const res = await stableCareService.regenerateChecklistsToday(token);
      await resource.refresh();
      if (res.failures.length === 0) {
        Alert.alert(
          t("Sinh checklist thành công"),
          `${t("Đã sinh")} ${res.generated} ${t("checklist cho các ngựa có Groom còn thiếu.")}`,
        );
      } else {
        Alert.alert(
          t("Sinh checklist hôm nay"),
          `${t("Đã sinh")} ${res.generated} ${t("checklist.")}\n${t("Còn")} ${res.failures.length} ${t("ngựa lỗi:")} ${res.failures.map((f) => f.horseName).join(", ")}`,
        );
      }
    } catch (error) {
      Alert.alert(t("Could not regenerate checklists"), extractErrorMessage(error));
    } finally {
      setRegenerating(false);
    }
  };

  const toggle = async (
    itemId: string,
    done: boolean,
    evidencePhoto?: LocalMediaAsset | null,
  ): Promise<boolean> => {
    setSavingItemId(itemId);
    try {
      const evidenceMediaId = evidencePhoto
        ? await mediaService.uploadChecklistEvidence(token!, evidencePhoto)
        : null;
      const input = evidenceMediaId ? { evidenceMediaId } : { done };
      await stableCareService.tickChecklistItem(token!, itemId, input);
      await resource.refresh();
      return true;
    } catch (error) {
      Alert.alert(t("Could not update checklist"), extractErrorMessage(error));
      return false;
    } finally {
      setSavingItemId(null);
    }
  };
  const handlePresetRange = (days: number) => {
    const start = daysAgoDate(days - 1);
    const end = todayDate();
    setFrom(start);
    setTo(end);
    setRange({ from: start, to: end });
  };
  const refreshRange = () => {
    if (!isValidChecklistRange(from, to)) {
      Alert.alert(
        t("Check date range"),
        t("Choose valid dates with an inclusive range of no more than 31 days."),
      );
      return;
    }
    setRange({ from, to });
  };
  const today = todayDate();

  return (
    <View style={ui.section}>
      <SectionTitle>Daily checklist history</SectionTitle>

      {role === "manager" ? (
        <View style={{ marginBottom: space.sm }}>
          <PrimaryButton
            label={regenerating ? t("Đang sinh checklist…") : t("Sinh lại checklist hôm nay")}
            icon="refresh"
            disabled={regenerating}
            onPress={() => void handleRegenerateChecklists()}
          />
        </View>
      ) : null}

      {/* Preset range chips */}
      <View style={careStyles.quickChipsRow}>
        <Text style={ui.muted}>{t("Range")}:</Text>
        {CHECKLIST_RANGE_PRESETS.map((d) => (
          <Pressable
            key={d}
            accessibilityRole="button"
            onPress={() => handlePresetRange(d)}
            style={careStyles.quickQtyChip}
          >
            <Text style={careStyles.quickQtyChipText}>
              {d} {t("days")}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field label="From · YYYY-MM-DD">
        <NativeInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="To · YYYY-MM-DD">
        <NativeInput value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
      </Field>
      <SecondaryButton label="Load up to 31 days" icon="refresh-outline" onPress={refreshRange} />

      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && (resource.data?.length ?? 0) === 0}
        emptyLabel="No checklists exist in this date range."
      />

      {(resource.data ?? []).map((checklist) => {
        const totalItems = checklist.items.length;
        const doneItems = checklist.items.filter((item) => item.done).length;
        const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
        const isCompleted = checklist.status === "COMPLETED";
        const isCancelled = checklist.status === "CANCELLED";

        return (
          <View key={checklist.id} style={careStyles.checklistCard}>
            <View style={ui.row}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="checkbox-outline" size={17} color={colors.primary} />
                  <Text style={[careStyles.planHorseName, { fontSize: 16 }]}>
                    {checklist.checklistDate}
                  </Text>
                </View>
                <Text style={ui.muted}>
                  {t("Groom")}: {checklist.groom.fullName}
                  {checklist.completedAt
                    ? ` · ${t("Completed")} ${formatTime(checklist.completedAt)}`
                    : ""}
                </Text>
              </View>
              <View
                style={[
                  careStyles.statusBadge,
                  {
                    backgroundColor: isCancelled
                      ? colors.injuredSoft
                      : isCompleted
                        ? colors.fitSoft
                        : colors.monitorSoft,
                  },
                ]}
              >
                <Ionicons
                  name={
                    isCancelled ? "close-circle" : isCompleted ? "checkmark-circle" : "time-outline"
                  }
                  size={13}
                  color={
                    isCancelled ? colors.destructive : isCompleted ? colors.primary : colors.monitor
                  }
                />
                <Text
                  style={[
                    careStyles.statusBadgeText,
                    {
                      color: isCancelled
                        ? colors.destructive
                        : isCompleted
                          ? colors.primary
                          : colors.monitor,
                    },
                  ]}
                >
                  {isCancelled
                    ? t("Cancelled")
                    : totalItems === 0
                      ? t(isCompleted ? "Completed" : "No tasks assigned")
                      : `${doneItems}/${totalItems} (${progressPct}%)`}
                </Text>
              </View>
            </View>

            {/* Checklist Items */}
            <View style={{ gap: space.xs, marginTop: space.xs }}>
              {totalItems === 0 ? <Text style={ui.muted}>{t("No tasks assigned")}</Text> : null}
              {checklist.items.map((item) => (
                <View key={item.id} style={careStyles.checklistItemRow}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons
                        name={item.done ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={item.done ? colors.primary : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          ui.value,
                          item.done && { color: colors.foreground },
                          { fontSize: 14 },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <Text style={ui.muted} numberOfLines={1}>
                      {item.doer
                        ? `${item.doer.fullName}${item.doneAt ? ` · ${formatTime(item.doneAt)}` : ""}`
                        : t("Not completed")}
                      {item.note ? ` · ${item.note}` : ""}
                    </Text>
                    <ChecklistEvidenceLink
                      token={token}
                      mediaId={item.evidenceMediaId}
                      photoUrl={item.evidencePhotoUrl}
                      style={{ marginTop: 4 }}
                    />
                  </View>
                  {role === "groom" &&
                  checklist.checklistDate === today &&
                  checklist.status !== "INCOMPLETE" &&
                  checklist.status !== "CANCELLED" ? (
                    <SecondaryButton
                      label={item.done ? "Undo" : "Done"}
                      style={{ flexShrink: 0 }}
                      disabled={savingItemId === item.id}
                      onPress={() =>
                        item.done ? void toggle(item.id, false) : setEvidenceItemId(item.id)
                      }
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {role === "groom" ? (
        <Text style={ui.muted}>
          {t(
            "Only today’s checklist can be changed. Older or incomplete checklists are read-only.",
          )}
        </Text>
      ) : null}
      <ChecklistEvidenceSheet
        visible={Boolean(evidenceItemId)}
        saving={Boolean(evidenceItemId && savingItemId === evidenceItemId)}
        onClose={() => setEvidenceItemId(null)}
        onComplete={async (photo) => {
          if (!evidenceItemId) return;
          const completed = await toggle(evidenceItemId, true, photo);
          if (completed) setEvidenceItemId(null);
        }}
      />
    </View>
  );
}

