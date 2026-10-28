import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  DatePickerField,
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
import { trainingService } from "@/services/training.service";
import { safeBack } from "@/utils/navigation";
import {
  addDaysToClubDate,
  clubDateTimeToIso,
  defaultClubDateTime,
} from "@/features/training/training-utils";
import { extractErrorMessage } from "@/utils/errorHandler";
import { radius, space } from "@/config/theme";

export default function CreateTrainingClass() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(defaultClubDateTime().date);
  const [planId, setPlanId] = useState("");
  const [raceAptitude, setRaceAptitude] = useState("");
  const [maxHorses, setMaxHorses] = useState("10");
  const [saving, setSaving] = useState(false);
  const loadPlans = useCallback(() => trainingService.listPlans(token!), [token]);
  const plansResource = useApiResource(loadPlans, Boolean(token));
  const selectedPlan = useMemo(
    () => plansResource.data?.find((plan) => plan.id === planId),
    [planId, plansResource.data],
  );
  const endDate = selectedPlan
    ? addDaysToClubDate(startDate, selectedPlan.totalWeeks * 7 - 1)
    : null;

  const save = async () => {
    if (!token) return;
    if (
      !code.trim() ||
      code.trim().length > 32 ||
      !name.trim() ||
      name.trim().length > 160 ||
      !planId ||
      !clubDateTimeToIso(startDate, "12:00")
    ) {
      return Alert.alert(
        t("Check the class details"),
        t("Vui lòng nhập mã lớp (tối đa 32 ký tự), tên lớp, ngày bắt đầu và chọn giáo án."),
      );
    }
    const capacity = Number(maxHorses);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 2_147_483_647)
      return Alert.alert(
        t("Check capacity"),
        t("Sĩ số tối đa phải là số nguyên từ 1 đến 2,147,483,647."),
      );
    setSaving(true);
    try {
      const created = await trainingService.createClass(token, {
        code: code.trim(),
        name: name.trim(),
        planId,
        startDate,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(raceAptitude ? { raceAptitude: raceAptitude as "SPRINTER" | "MILER" | "STAYER" } : {}),
        maxHorses: capacity,
      });
      router.replace(`/trainer/plan/${created.id}`);
    } catch (error) {
      Alert.alert(t("Could not create class"), extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role="trainer"
      title="Tạo lớp huấn luyện"
      subtitle="Lớp bắt đầu ở trạng thái hoạt động; sau khi tạo có thể xếp lịch các buổi tập"
      back
      fallbackHref="/trainer/training"
    >
      <AsyncStateView
        isLoading={plansResource.isLoading}
        error={plansResource.error}
        onRetry={() => void plansResource.retry()}
      />
      <Panel style={{ gap: space.sm }}>
        <Field label={t("Class code")}>
          <NativeInput value={code} onChangeText={setCode} placeholder="e.g. HT-2026-01" />
        </Field>
        <Field label={t("Class name")}>
          <NativeInput value={name} onChangeText={setName} placeholder={t("Name this class")} />
        </Field>
        <Field label={t("Description")}>
          <NativeInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder={t("Optional class notes")}
          />
        </Field>
        <Field label={t("Ngày bắt đầu lớp (theo lịch CLB)")}>
          <DatePickerField
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            outputFormat="YYYY-MM-DD"
            title={t("Chọn ngày bắt đầu lớp")}
          />
        </Field>
        <Field label={t("Sĩ số tối đa (ngựa)")}>
          <NativeInput value={maxHorses} onChangeText={setMaxHorses} keyboardType="number-pad" />
        </Field>

        {/* Wrapped Race Aptitude Options - Never Cut Off */}
        <Field label={t("Sở trường cự ly (tùy chọn)")}>
          <View style={styles.aptitudeGrid}>
            {[
              { id: "", label: t("Tất cả cự ly") },
              { id: "SPRINTER", label: t("Cự ly ngắn") },
              { id: "MILER", label: t("Cự ly trung bình") },
              { id: "STAYER", label: t("Cự ly dài") },
            ].map((item) => {
              const isSelected = (raceAptitude || "") === item.id;
              return (
                <Pressable
                  key={item.id || "all"}
                  onPress={() => setRaceAptitude(item.id)}
                  style={[
                    styles.aptitudePill,
                    isSelected && styles.aptitudePillActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.aptitudePillText,
                      isSelected && styles.aptitudePillTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </Panel>

      <View style={ui.section}>
        <SectionTitle>{t("Choose one of your plans")}</SectionTitle>
        {plansResource.data?.length
          ? plansResource.data.map((plan) => {
              const isSelected = planId === plan.id;
              return (
                <Pressable key={plan.id} onPress={() => setPlanId(plan.id)}>
                  <Panel
                    style={{
                      gap: 4,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.fitSoft : colors.surface,
                      borderWidth: isSelected ? 1.5 : 1,
                    }}
                  >
                    <View style={ui.row}>
                      <Text
                        style={[
                          ui.value,
                          { flex: 1, fontWeight: "700" },
                          isSelected && { color: colors.primary },
                        ]}
                      >
                        {plan.name}
                      </Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      ) : null}
                    </View>
                    <Text style={ui.muted}>
                      {plan.totalWeeks} {t("tuần")} · {plan.phases.length} {t("giai đoạn")} ·{" "}
                      {plan.minTotalMinutes} {t("phút tối thiểu")}
                    </Text>
                  </Panel>
                </Pressable>
              );
            })
          : null}
        {selectedPlan && endDate ? (
          <Panel style={{ gap: 4, backgroundColor: colors.accent }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={{ ...ui.value, fontSize: 13, fontWeight: "700", color: colors.primary }}>
                {t("Thời gian diễn ra lớp:")}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
              {startDate} → {endDate}
            </Text>
            <Text style={ui.muted}>
              {t("Sau khi tạo lớp, HLV có thể xếp lịch các buổi tập theo giáo án đã chọn.")}
            </Text>
          </Panel>
        ) : null}
        {plansResource.data && plansResource.data.length === 0 ? (
          <Panel style={{ gap: space.sm, alignItems: "center" }}>
            <Ionicons name="reader-outline" size={32} color={colors.mutedForeground} />
            <Text style={ui.muted}>{t("Create a training plan before creating a class.")}</Text>
            <SecondaryButton
              label={t("Quản lý giáo án")}
              icon="reader-outline"
              onPress={() => router.push("/trainer/plans")}
            />
          </Panel>
        ) : null}
      </View>

      {/* Prominent Bottom CTA Bar */}
      <View style={styles.bottomCtaBar}>
        <SecondaryButton
          label={t("Cancel")}
          icon="close"
          style={{ minWidth: 90, minHeight: 48, paddingHorizontal: 16 }}
          onPress={() => safeBack("/trainer/training")}
        />
        <PrimaryButton
          label={saving ? t("Creating…") : t("Tạo lớp huấn luyện")}
          icon="checkmark"
          style={{ flex: 1, minHeight: 48 }}
          disabled={saving || !plansResource.data?.length || !planId}
          onPress={() => void save()}
        />
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    aptitudeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 2,
    },
    aptitudePill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    aptitudePillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    aptitudePillText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    aptitudePillTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    bottomCtaBar: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 10,
      width: "100%",
      marginTop: space.sm,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
