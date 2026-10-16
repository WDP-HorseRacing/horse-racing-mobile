import { type Href, router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { AsyncStateView, Screen } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useApiResource } from "@/hooks/useApiResource";
import { usersService } from "@/services/users.service";
import { horseService } from "@/services/horse.service";
import { stableService } from "@/services/stable.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import type { StaffDto } from "@/adapters/staff.adapter";
import type { CreateHorseInput, HorseGenderDto } from "@/adapters/horse.adapter";
import { validateHorseIdentity } from "@/utils/horse-validation";

type SaveMode = "open" | "another";

export default function RegisterHorse() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token, role, isLoading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<HorseGenderDto>("MALE");
  const [microchipId, setMicrochipId] = useState("");
  const [breed, setBreed] = useState("");
  const [color, setColor] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [sireId, setSireId] = useState("");
  const [damId, setDamId] = useState("");
  const [barnId, setBarnId] = useState("");
  const [sireSearch, setSireSearch] = useState("");
  const [damSearch, setDamSearch] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [barnSearch, setBarnSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const savingRef = useRef(false);

  const loadOwners = useCallback(() => usersService.list(token!), [token]);
  const ownersResource = useApiResource(loadOwners, Boolean(token && role === "manager"));
  const owners = useMemo(
    () =>
      (ownersResource.data ?? []).filter(
        (user: StaffDto) => user.role === "HORSE_OWNER" && user.status === "ACTIVE",
      ),
    [ownersResource.data],
  );
  const loadHorses = useCallback(() => horseService.list(token!), [token]);
  const horsesResource = useApiResource(loadHorses, Boolean(token && role === "manager"));
  const loadBarns = useCallback(() => stableService.listBarns(token!), [token]);
  const barnsResource = useApiResource(loadBarns, Boolean(token && role === "manager"));
  const candidateSires = (horsesResource.data ?? []).filter(
    (horse) => ["MALE", "GELDING"].includes(horse.gender ?? "") && !horse.isDeleted,
  );
  const candidateDams = (horsesResource.data ?? []).filter(
    (horse) => horse.gender === "FEMALE" && !horse.isDeleted,
  );
  const availableBarns = (barnsResource.data ?? []).filter(
    (barn) => barn.status === "ACTIVE" && barn.hasActiveHeadTrainer && barn.availableStallCount > 0,
  );
  const filterByQuery = <T extends { id: string; name?: string; fullName?: string }>(
    items: T[],
    query: string,
  ) => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? items.filter((item) =>
          `${item.name ?? item.fullName ?? ""} ${item.id}`.toLowerCase().includes(normalized),
        )
      : items;
  };

  const resetForm = () => {
    setName("");
    setGender("MALE");
    setMicrochipId("");
    setBreed("");
    setColor("");
    setDateOfBirth("");
    setOwnerId("");
    setSireId("");
    setDamId("");
    setBarnId("");
    setSireSearch("");
    setDamSearch("");
    setOwnerSearch("");
    setBarnSearch("");
    setFormError("");
  };

  const submit = async (mode: SaveMode) => {
    if (!token || role !== "manager" || savingRef.current) return;
    const validationError = validateHorseIdentity({
      name,
      breed,
      color,
      microchipId,
      dateOfBirth,
      gender,
      sireId,
      damId,
      horses: horsesResource.data ?? [],
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError("");
    const input: CreateHorseInput = {
      name: name.trim(),
      gender,
      ...(microchipId.trim() ? { microchipId: microchipId.trim() } : {}),
      ...(breed.trim() ? { breed: breed.trim() } : {}),
      ...(color.trim() ? { color: color.trim() } : {}),
      ...(dateOfBirth.trim() ? { dateOfBirth: dateOfBirth.trim() } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(sireId ? { sireId } : {}),
      ...(damId ? { damId } : {}),
      ...(barnId ? { barnId } : {}),
    };
    try {
      const created = await horseService.create(token, input);
      if (mode === "another") {
        Alert.alert(
          "Horse registered",
          `${created.name} is saved. You can register another horse.`,
        );
        resetForm();
      } else {
        router.replace(`/manager/horse/${created.id}` as Href);
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      setFormError(message);
      Alert.alert("Could not register horse", message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen
      role="manager"
      title="Register horse"
      subtitle="Identity, pedigree and initial barn"
      back
      refreshing={
        ownersResource.isRefreshing || horsesResource.isRefreshing || barnsResource.isRefreshing
      }
      onRefresh={() =>
        void Promise.all([
          ownersResource.refresh(),
          horsesResource.refresh(),
          barnsResource.refresh(),
        ])
      }
    >
      {authLoading ? (
        <AsyncStateView isLoading error={null} onRetry={() => undefined} />
      ) : role !== "manager" ? (
        <Panel>
          <Text>This role cannot register horse profiles.</Text>
        </Panel>
      ) : (
        <>
          <Panel>
            <View style={{ gap: 18 }}>
              <Field label="Horse name">
                <NativeInput value={name} onChangeText={setName} placeholder="Horse name" />
              </Field>
              <Field label="Gender">
                <Chips
                  options={["MALE", "FEMALE", "GELDING"]}
                  value={gender}
                  onChange={(value) => setGender(value as HorseGenderDto)}
                />
              </Field>
              <Field label="Microchip ID">
                <NativeInput
                  value={microchipId}
                  onChangeText={setMicrochipId}
                  placeholder="15 digits (optional)"
                  keyboardType="number-pad"
                />
              </Field>
              <Field label="Breed">
                <NativeInput value={breed} onChangeText={setBreed} placeholder="Breed (optional)" />
              </Field>
              <Field label="Color">
                <NativeInput
                  value={color}
                  onChangeText={setColor}
                  placeholder="Coat color (optional)"
                />
              </Field>
              <Field label="Date of birth (YYYY-MM-DD)">
                <NativeInput
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="2021-05-20"
                />
              </Field>
              <Field label="Sire (optional)">
                <NativeInput
                  value={sireSearch}
                  onChangeText={setSireSearch}
                  placeholder="Search by name or Horse ID"
                />
                <SelectionChips
                  loading={horsesResource.isLoading}
                  error={horsesResource.error}
                  onRetry={() => void horsesResource.retry()}
                  options={filterByQuery(candidateSires, sireSearch).map((horse) => ({
                    id: horse.id,
                    label: `${horse.name} · ${horse.id.slice(0, 6)}`,
                  }))}
                  value={sireId}
                  onChange={(value) => {
                    setSireId(value);
                    setSireSearch("");
                  }}
                  emptyLabel="No sire profiles are available."
                />
              </Field>
              <Field label="Dam (optional)">
                <NativeInput
                  value={damSearch}
                  onChangeText={setDamSearch}
                  placeholder="Search by name or Horse ID"
                />
                <SelectionChips
                  loading={horsesResource.isLoading}
                  error={horsesResource.error}
                  onRetry={() => void horsesResource.retry()}
                  options={filterByQuery(candidateDams, damSearch).map((horse) => ({
                    id: horse.id,
                    label: `${horse.name} · ${horse.id.slice(0, 6)}`,
                  }))}
                  value={damId}
                  onChange={(value) => {
                    setDamId(value);
                    setDamSearch("");
                  }}
                  emptyLabel="No dam profiles are available."
                />
              </Field>
              <Field label="Primary owner (optional)">
                <NativeInput
                  value={ownerSearch}
                  onChangeText={setOwnerSearch}
                  placeholder="Search active horse owners"
                />
                <SelectionChips
                  loading={ownersResource.isLoading}
                  error={ownersResource.error}
                  onRetry={() => void ownersResource.retry()}
                  options={filterByQuery(owners, ownerSearch).map((owner) => ({
                    id: owner.id,
                    label: `${owner.fullName} · ${owner.id.slice(0, 6)}`,
                  }))}
                  value={ownerId}
                  onChange={(value) => {
                    setOwnerId(value);
                    setOwnerSearch("");
                  }}
                  emptyLabel="No active horse owners found. The horse can be assigned later."
                />
              </Field>
              <Field label="Initial barn (optional)">
                <NativeInput
                  value={barnSearch}
                  onChangeText={setBarnSearch}
                  placeholder="Search active barns"
                />
                <SelectionChips
                  loading={barnsResource.isLoading}
                  error={barnsResource.error}
                  onRetry={() => void barnsResource.retry()}
                  options={filterByQuery(availableBarns, barnSearch).map((barn) => ({
                    id: barn.id,
                    label: `${barn.name} · ${barn.availableStallCount} available`,
                  }))}
                  value={barnId}
                  onChange={(value) => {
                    setBarnId(value);
                    setBarnSearch("");
                  }}
                  emptyLabel="No active barn with an available stall and Head Trainer. Horse will remain pending barn assignment."
                />
              </Field>
              <Panel>
                <Text style={uiStyles.muted}>
                  Photo upload is currently unavailable in this mobile build. You can create the
                  profile without a photo.
                </Text>
              </Panel>
            </View>
          </Panel>
          {formError ? (
            <Panel style={uiStyles.alert}>
              <Text style={{ color: colors.destructive, fontWeight: "600", fontSize: 13 }}>{formError}</Text>
            </Panel>
          ) : null}
          <PrimaryButton
            label={saving ? "Saving…" : "Save and open profile"}
            icon="checkmark"
            disabled={saving}
            onPress={() => void submit("open")}
          />
          <SecondaryButton
            label={saving ? "Saving…" : "Save and add another"}
            icon="add"
            disabled={saving}
            onPress={() => void submit("another")}
          />
        </>
      )}
    </Screen>
  );
}

function SelectionChips({
  loading,
  error,
  onRetry,
  options,
  value,
  onChange,
  emptyLabel,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  emptyLabel: string;
}) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  if (loading || error)
    return <AsyncStateView isLoading={loading} error={error} onRetry={onRetry} />;
  if (!options.length) return <Text style={uiStyles.muted}>{emptyLabel}</Text>;
  const selected = options.find((option) => option.id === value);
  return (
    <Chips
      options={["None", ...options.map((option) => option.label)]}
      value={selected?.label ?? "None"}
      onChange={(label) =>
        onChange(
          label === "None" ? "" : (options.find((option) => option.label === label)?.id ?? ""),
        )
      }
    />
  );
}
