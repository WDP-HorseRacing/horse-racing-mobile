import { type Href, router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Image, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
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
import { mediaService, type LocalMediaAsset } from "@/services/media.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import type { StaffDto } from "@/adapters/staff.adapter";
import type { CreateHorseInput, HorseGenderDto } from "@/adapters/horse.adapter";
import { validateHorseIdentity } from "@/utils/horse-validation";

import * as DocumentPicker from "expo-document-picker";

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
  const [photo, setPhoto] = useState<LocalMediaAsset | null>(null);
  const [uploadedPhotoId, setUploadedPhotoId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
    setPhoto(null);
    setUploadedPhotoId(null);
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
    try {
      let mediaId = uploadedPhotoId;
      if (photo && !mediaId) {
        setUploadingPhoto(true);
        mediaId = await mediaService.uploadHorsePhoto(token, photo);
        setUploadedPhotoId(mediaId);
        setUploadingPhoto(false);
      }
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
        ...(mediaId ? { mediaId } : {}),
      };
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
      setUploadingPhoto(false);
      savingRef.current = false;
      setSaving(false);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Quyền thư viện ảnh",
        "Vui lòng cấp quyền truy cập thư viện ảnh để tải ảnh ngựa.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const picked = result.assets[0];
      const name = picked.fileName || picked.uri.split("/").pop() || "horse-photo.jpg";
      setPhoto({
        name,
        uri: picked.uri,
        size: picked.fileSize,
        mimeType: picked.mimeType || "image/jpeg",
      });
      setUploadedPhotoId(null);
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Quyền máy ảnh",
        "Vui lòng cấp quyền truy cập máy ảnh để chụp ảnh ngựa.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const picked = result.assets[0];
      const name = picked.fileName || picked.uri.split("/").pop() || "horse-photo.jpg";
      setPhoto({
        name,
        uri: picked.uri,
        size: picked.fileSize,
        mimeType: picked.mimeType || "image/jpeg",
      });
      setUploadedPhotoId(null);
    }
  };

  const pickFromDocument = async () => {
    try {
      const docResult = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!docResult.canceled && docResult.assets[0]) {
        const picked = docResult.assets[0];
        const name = picked.name || "horse-photo.jpg";
        setPhoto({
          name,
          uri: picked.uri,
          size: picked.size,
          mimeType:
            picked.mimeType ||
            (name.toLowerCase().endsWith(".png")
              ? "image/png"
              : name.toLowerCase().endsWith(".webp")
                ? "image/webp"
                : "image/jpeg"),
        });
        setUploadedPhotoId(null);
      }
    } catch (err) {
      Alert.alert("Lỗi chọn tệp", extractErrorMessage(err));
    }
  };

  const choosePhoto = () => {
    Alert.alert("Tải ảnh ngựa", "Chọn nguồn ảnh tải lên:", [
      { text: "Thư viện ảnh", onPress: () => void pickFromLibrary() },
      { text: "Chụp ảnh mới", onPress: () => void pickFromCamera() },
      { text: "Chọn tệp (.jpg, .jpeg, .png...)", onPress: () => void pickFromDocument() },
      { text: "Hủy", style: "cancel" },
    ]);
  };

  return (
    <Screen
      role="manager"
      title="Register horse"
      subtitle="Identity, pedigree and initial barn"
      back
      fallbackHref="/manager/horses"
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
                    if (value === sireId) {
                      setSireId("");
                      setSireSearch("");
                    } else {
                      const selected = candidateSires.find((h) => h.id === value);
                      setSireId(value);
                      setSireSearch(selected?.name ?? "");
                    }
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
                    if (value === damId) {
                      setDamId("");
                      setDamSearch("");
                    } else {
                      const selected = candidateDams.find((h) => h.id === value);
                      setDamId(value);
                      setDamSearch(selected?.name ?? "");
                    }
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
                    if (value === ownerId) {
                      setOwnerId("");
                      setOwnerSearch("");
                    } else {
                      const selected = owners.find((o) => o.id === value);
                      setOwnerId(value);
                      setOwnerSearch(selected?.fullName ?? "");
                    }
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
              <View style={uiStyles.section}>
                <Text style={uiStyles.value}>Horse photo (optional)</Text>
                {photo ? (
                  <>
                    <Text style={uiStyles.muted} numberOfLines={1} ellipsizeMode="middle">
                      {photo.name}
                    </Text>
                    <Image
                      source={{ uri: photo.uri }}
                      style={{ width: 200, height: 150, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                    <SecondaryButton
                      label="Remove photo"
                      onPress={() => {
                        setPhoto(null);
                        setUploadedPhotoId(null);
                      }}
                    />
                  </>
                ) : null}
                <SecondaryButton
                  label="Choose photo"
                  onPress={() => void choosePhoto()}
                  disabled={saving || Boolean(photo)}
                />
                <Text style={uiStyles.muted}>JPEG, PNG, or WebP · up to 10 MB</Text>
              </View>
            </View>
          </Panel>
          {formError ? (
            <Panel style={uiStyles.alert}>
              <Text style={{ color: colors.destructive, fontWeight: "600", fontSize: 13 }}>
                {formError}
              </Text>
            </Panel>
          ) : null}
          <PrimaryButton
            label={
              uploadingPhoto ? "Uploading photo…" : saving ? "Saving…" : "Save and open profile"
            }
            icon="checkmark"
            disabled={saving}
            onPress={() => void submit("open")}
          />
          <SecondaryButton
            label={
              uploadingPhoto ? "Uploading photo…" : saving ? "Saving…" : "Save and add another"
            }
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
