import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, SectionTitle } from "@/components/common";
import {
  BottomSheetModal,
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
import {
  stableCareService,
  type HorseSurchargeDto,
} from "@/services/stable-care.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { isDateOnly } from "@/features/stable-care/stable-care-validation";
import { formatDate } from "@/utils/formatters";
import { formatVnd, todayDate, getCareStyles } from "./stableCareHelpers";

export function HorseSurchargesTab({ role, horseId }: { role: string; horseId: string }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const canCreate = role === "manager";
  const canApply = role === "trainer";
  const load = useCallback(
    () => stableCareService.listSurcharges(token!, horseId),
    [horseId, token],
  );
  const resource = useApiResource(load, Boolean(token && horseId));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(todayDate());
  const [endDate, setEndDate] = useState(todayDate());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const amountError = useMemo(() => {
    if (!amount.trim()) return "";
    const num = Number(amount);
    if (!Number.isInteger(num) || num < 1 || num > 1_000_000_000) {
      return t("Số tiền phải là số nguyên dương từ 1 đến 1.000.000.000 đ/ngày.");
    }
    return "";
  }, [amount, t]);

  const descError = useMemo(() => {
    if (!description.trim()) return "";
    if (description.trim().length > 500) {
      return t("Mô tả không được vượt quá 500 ký tự.");
    }
    return "";
  }, [description, t]);

  const dateError = useMemo(() => {
    if (startDate && !isDateOnly(startDate))
      return t("Ngày bắt đầu không đúng định dạng YYYY-MM-DD.");
    if (startDate && startDate < todayDate()) return t("Ngày bắt đầu không được ở quá khứ.");
    if (endDate && !isDateOnly(endDate)) return t("Ngày kết thúc không đúng định dạng YYYY-MM-DD.");
    if (startDate && endDate && endDate < startDate)
      return t("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
    return "";
  }, [startDate, endDate, t]);
  const create = async () => {
    const dailyAmount = Number(amount);
    if (
      !token ||
      !description.trim() ||
      description.trim().length > 500 ||
      !Number.isInteger(dailyAmount) ||
      dailyAmount < 1 ||
      dailyAmount > 1_000_000_000 ||
      !isDateOnly(startDate) ||
      !isDateOnly(endDate) ||
      startDate < todayDate() ||
      endDate < startDate
    ) {
      Alert.alert(
        t("Check surcharge details"),
        t(
          "Enter a description, a positive whole VND amount up to 1 billion, and valid dates starting today or later.",
        ),
      );
      return;
    }
    try {
      await stableCareService.createSurcharge(token, horseId, {
        description: description.trim(),
        dailyAmount,
        startDate,
        endDate,
      });
      setDescription("");
      setAmount("");
      setShowCreateModal(false);
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not create surcharge"), extractErrorMessage(error));
    }
  };
  const end = (surcharge: HorseSurchargeDto) =>
    Alert.alert(
      t("End surcharge today?"),
      t("This applies only to a surcharge that has started and is still active."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("End today"),
          onPress: () =>
            void stableCareService
              .endSurcharge(token!, surcharge.id)
              .then(() => resource.refresh())
              .catch((error) =>
                Alert.alert(t("Could not end surcharge"), extractErrorMessage(error)),
              ),
        },
      ],
    );
  const remove = (surcharge: HorseSurchargeDto) =>
    Alert.alert(
      t("Delete upcoming surcharge?"),
      t("Only a surcharge that has not started can be deleted."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: () =>
            void stableCareService
              .deleteSurcharge(token!, surcharge.id)
              .then(() => resource.refresh())
              .catch((error) =>
                Alert.alert(t("Could not delete surcharge"), extractErrorMessage(error)),
              ),
        },
      ],
    );
  const today = todayDate();
  const surcharges = resource.data ?? [];
  const activeDailyTotal = surcharges
    .filter((s) => s.appliedBy && s.startDate <= today && s.endDate >= today)
    .reduce((sum, s) => sum + (s.dailyAmount || 0), 0);
  const pendingCount = surcharges.filter((s) => !s.appliedBy && s.endDate >= today).length;

  return (
    <View style={ui.section}>
      <SectionTitle>Care surcharges</SectionTitle>
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && (resource.data?.length ?? 0) === 0}
        emptyLabel="No surcharges are recorded for this horse."
      />
      {surcharges.length > 0 ? (
        <View style={careStyles.surchargeSummaryCard}>
          <View style={careStyles.surchargeSummaryRow}>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Số khoản phụ phí")}</Text>
              <Text style={careStyles.surchargeSummaryValue}>
                {surcharges.length} {t("khoản")}
              </Text>
            </View>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Tổng phát sinh / ngày")}</Text>
              <Text style={[careStyles.surchargeSummaryValue, { color: colors.primary }]}>
                {formatVnd(activeDailyTotal)}
              </Text>
            </View>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Chờ duyệt")}</Text>
              <Text
                style={[
                  careStyles.surchargeSummaryValue,
                  { color: pendingCount > 0 ? colors.monitor : colors.mutedForeground },
                ]}
              >
                {pendingCount}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
      {(resource.data ?? []).map((surcharge) => (
        <View key={surcharge.id} style={careStyles.taskCard}>
          <View style={ui.row}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={careStyles.planHorseName}>{surcharge.description}</Text>
              <Text style={[ui.value, { color: colors.primary, fontSize: 16 }]}>
                {formatVnd(surcharge.dailyAmount)} / {t("day")}
              </Text>
            </View>
            <View style={careStyles.dateRangeBadge}>
              <Ionicons name="calendar-outline" size={13} color={colors.primary} />
              <Text style={careStyles.dateRangeText}>
                {surcharge.startDate} → {surcharge.endDate}
              </Text>
            </View>
          </View>
          {surcharge.appliedByName ? (
            <Text style={ui.muted}>
              {t("Applied by")} {surcharge.appliedByName}
              {surcharge.appliedAt ? ` · ${formatDate(surcharge.appliedAt)}` : ""}
            </Text>
          ) : (
            <View
              style={[
                careStyles.statusBadge,
                { backgroundColor: colors.monitorSoft, alignSelf: "flex-start" },
              ]}
            >
              <Ionicons name="time-outline" size={12} color={colors.monitor} />
              <Text style={[careStyles.statusBadgeText, { color: colors.monitor }]}>
                {t("Awaiting Head Trainer")}
              </Text>
            </View>
          )}
          {canApply && !surcharge.appliedBy && surcharge.endDate >= today ? (
            <PrimaryButton
              label="Apply surcharge"
              icon="checkmark-outline"
              onPress={() =>
                void stableCareService
                  .applySurcharge(token!, surcharge.id)
                  .then(() => resource.refresh())
                  .catch((error) =>
                    Alert.alert(t("Could not apply surcharge"), extractErrorMessage(error)),
                  )
              }
            />
          ) : null}
          {canCreate && !surcharge.appliedBy && surcharge.startDate > today ? (
            <SecondaryButton
              label="Delete"
              icon="trash-outline"
              onPress={() => remove(surcharge)}
            />
          ) : null}
          {canCreate && surcharge.startDate <= today && surcharge.endDate >= today ? (
            <SecondaryButton label="End today" onPress={() => end(surcharge)} />
          ) : null}
        </View>
      ))}
      {canCreate ? (
        <>
          <PrimaryButton
            label="Create surcharge"
            icon="add"
            onPress={() => setShowCreateModal(true)}
          />
          <BottomSheetModal
            visible={showCreateModal}
            title="Create surcharge"
            saveLabel="Save"
            cancelLabel="Cancel"
            onSave={() => void create()}
            onClose={() => setShowCreateModal(false)}
          >
            <Field label="Description">
              <NativeInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder={t("Reason for additional care cost")}
              />
              {descError ? (
                <Text
                  style={{
                    color: colors.destructive,
                    fontSize: 12,
                    marginTop: 4,
                    fontWeight: "600",
                  }}
                >
                  {descError}
                </Text>
              ) : null}
            </Field>
            <Field label="Daily amount · VND">
              <NativeInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder="e.g. 250000"
              />
              {amountError ? (
                <Text
                  style={{
                    color: colors.destructive,
                    fontSize: 12,
                    marginTop: 4,
                    fontWeight: "600",
                  }}
                >
                  {amountError}
                </Text>
              ) : amount.trim() && Number(amount) > 0 ? (
                <Text
                  style={{ color: colors.primary, fontSize: 13, marginTop: 4, fontWeight: "600" }}
                >
                  {formatVnd(Number(amount))} / {t("day")}
                </Text>
              ) : null}
            </Field>
            <Field label="Start date · YYYY-MM-DD">
              <NativeInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="End date · YYYY-MM-DD">
              <NativeInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
              {dateError ? (
                <Text
                  style={{
                    color: colors.destructive,
                    fontSize: 12,
                    marginTop: 4,
                    fontWeight: "600",
                  }}
                >
                  {dateError}
                </Text>
              ) : null}
            </Field>
          </BottomSheetModal>
        </>
      ) : null}
    </View>
  );
}
