import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
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
import { useTheme } from "@/hooks/useTheme";
import { billingService, type DailyFeeDto } from "@/services/billing.service";
import { isDateOnly } from "@/features/stable-care/stable-care-validation";
import { clubDate } from "@/utils/horse-validation";
import { extractErrorMessage } from "@/utils/errorHandler";

const MAX_DAILY_FEE = 1_000_000_000;

export default function ManagerDailyFees() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { token, role } = useAuth();
  const today = clubDate();
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const load = useCallback(() => billingService.listDailyFees(token!), [token]);
  const resource = useApiResource(load, Boolean(token && role === "manager"));
  const fees = resource.data ?? [];
  const currentFee = fees
    .filter((fee) => fee.effectiveFrom <= today)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];

  const createFee = async () => {
    const dailyFee = Number(amount);
    if (
      !token ||
      !isDateOnly(effectiveFrom) ||
      effectiveFrom < today ||
      !/^\d+$/.test(amount.trim()) ||
      !Number.isSafeInteger(dailyFee) ||
      dailyFee < 0 ||
      dailyFee > MAX_DAILY_FEE
    ) {
      Alert.alert(
        "Check daily fee",
        `Choose a valid date from ${today} onward and enter a whole VND amount from 0 to ${MAX_DAILY_FEE.toLocaleString("en-US")}.`,
      );
      return;
    }
    setSaving(true);
    try {
      await billingService.createDailyFee(token, { effectiveFrom, dailyFee });
      setAmount("");
      await resource.refresh();
      Alert.alert("Daily fee saved", `The fee applies from ${effectiveFrom}.`);
    } catch (error) {
      Alert.alert("Could not save daily fee", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (fee: DailyFeeDto) => {
    Alert.alert(
      "Delete scheduled fee?",
      `Remove the ${money(fee.dailyFee)} per horse per day rate scheduled for ${fee.effectiveFrom}?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void deleteFee(fee),
        },
      ],
    );
  };

  const deleteFee = async (fee: DailyFeeDto) => {
    if (!token) return;
    setDeletingId(fee.id);
    try {
      await billingService.deleteDailyFee(token, fee.id);
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not delete daily fee", extractErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Screen
      role="manager"
      title="Daily boarding fees"
      subtitle="Set the club-wide VND rate per horse per day"
      back
      fallbackHref="/manager/operations"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      {role !== "manager" ? (
        <Panel>
          <Text>This role cannot manage club daily fees.</Text>
        </Panel>
      ) : (
        <>
          <Panel>
            <View style={{ gap: 14 }}>
              <SectionTitle>Schedule a rate</SectionTitle>
              <Field label="Effective date · YYYY-MM-DD">
                <NativeInput
                  value={effectiveFrom}
                  onChangeText={setEffectiveFrom}
                  placeholder={today}
                />
              </Field>
              <Field label="Daily fee · whole VND per horse">
                <NativeInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="number-pad"
                  placeholder="150000"
                />
              </Field>
              <Text style={ui.muted}>
                New rates start today or later. A date can have one rate. Applied rates cannot be
                deleted.
              </Text>
              <PrimaryButton
                label={saving ? "Saving…" : "Save daily fee"}
                icon="checkmark"
                disabled={saving}
                onPress={() => void createFee()}
              />
            </View>
          </Panel>
          <View style={ui.section}>
            <SectionTitle>Fee schedule</SectionTitle>
            <AsyncStateView
              isLoading={resource.isLoading}
              error={resource.error}
              onRetry={() => void resource.retry()}
              empty={Boolean(resource.data && fees.length === 0)}
              emptyLabel="No daily boarding rate has been configured."
            />
            {fees.map((fee) => {
              const isCurrent = fee.id === currentFee?.id;
              const isScheduled = fee.effectiveFrom > today;
              return (
                <Panel key={fee.id}>
                  <View style={ui.row}>
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text style={ui.value} numberOfLines={1}>
                        {money(fee.dailyFee)} / horse / day
                      </Text>
                      <Text style={ui.muted} numberOfLines={1}>
                        From {fee.effectiveFrom} ·{" "}
                        {isCurrent ? "Current" : isScheduled ? "Scheduled" : "Past rate"}
                      </Text>
                    </View>
                    {isScheduled ? (
                      <SecondaryButton
                        label={deletingId === fee.id ? "Deleting…" : "Delete"}
                        style={{ flexShrink: 0 }}
                        disabled={Boolean(deletingId)}
                        onPress={() => confirmDelete(fee)}
                      />
                    ) : null}
                  </View>
                </Panel>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

function money(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value) + " ₫";
}
