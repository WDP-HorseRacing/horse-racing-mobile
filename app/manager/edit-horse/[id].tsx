import { useCallback, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { safeBack } from "@/utils/navigation";
import { Alert, Image, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { AsyncStateView, Screen } from "@/components/common";
import {
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  Chips,
  getUiStyles,
} from "@/components/ui";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { mediaService, type LocalMediaAsset } from "@/services/media.service";
import { usersService } from "@/services/users.service";
import type { StaffDto } from "@/adapters/staff.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import type { HorseDetailDto, HorseGenderDto, HorseListItemDto } from "@/adapters/horse.adapter";
import { useTheme } from "@/hooks/useTheme";
import { validateHorseIdentity } from "@/utils/horse-validation";

export default function EditHorse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const horseId = Array.isArray(id) ? id[0] : id;
  const { token } = useAuth();
  const loadHorse = useCallback(() => horseService.get(token!, horseId), [token, horseId]);
  const resource = useApiResource(loadHorse, Boolean(token && horseId));
  const loadPermissions = useCallback(
    () => horseService.getPermissions(token!, horseId),
    [token, horseId],
  );
  const permissionsResource = useApiResource(loadPermissions, Boolean(token && horseId));
  const loadOwners = useCallback(() => usersService.list(token!), [token]);
  const ownersResource = useApiResource(
    loadOwners,
    Boolean(token && permissionsResource.data?.canEditProfile),
  );
  const loadHorses = useCallback(
    () => horseService.list(token!, "", { includeDeleted: true }),
    [token],
  );
  const horsesResource = useApiResource(
    loadHorses,
    Boolean(token && permissionsResource.data?.canEditProfile),
  );
  const owners = useMemo(
    () =>
      (ownersResource.data ?? []).filter(
        (user: StaffDto) => user.role === "HORSE_OWNER" && user.status === "ACTIVE",
      ),
    [ownersResource.data],
  );
  return (
    <Screen
      role="manager"
      title="Edit horse profile"
      subtitle={resource.data?.name ?? ""}
      back
      fallbackHref={`/manager/horse/${horseId}` as Href}
      refreshing={
        resource.isRefreshing ||
        ownersResource.isRefreshing ||
        horsesResource.isRefreshing ||
        permissionsResource.isRefreshing
      }
      onRefresh={() => {
        void resource.refresh();
        void ownersResource.refresh();
        void horsesResource.refresh();
        void permissionsResource.refresh();
      }}
    >
      <AsyncStateView
        isLoading={resource.isLoading || permissionsResource.isLoading}
        error={resource.error ?? permissionsResource.error}
        onRetry={() => void Promise.all([resource.retry(), permissionsResource.retry()])}
      />
      {resource.data && permissionsResource.data?.canEditProfile && !resource.data.isDeleted ? (
        <EditHorseForm
          key={horseId}
          horse={resource.data}
          horseId={horseId}
          token={token!}
          owners={owners}
          ownersLoading={ownersResource.isLoading}
          ownersError={ownersResource.error}
          retryOwners={() => void ownersResource.retry()}
          horses={horsesResource.data ?? []}
          horsesLoading={horsesResource.isLoading}
          horsesError={horsesResource.error}
          retryHorses={() => void horsesResource.retry()}
        />
      ) : null}
      {resource.data && permissionsResource.data && !permissionsResource.data.canEditProfile ? (
        <Panel>
          <Text>This role cannot edit the horse profile.</Text>
        </Panel>
      ) : null}
      {resource.data?.isDeleted ? (
        <Panel>
          <Text>Deleted profiles must be restored before editing.</Text>
        </Panel>
      ) : null}
    </Screen>
  );
}

function EditHorseForm({
  horse,
  horseId,
  token,
  owners,
  ownersLoading,
  ownersError,
  retryOwners,
  horses,
  horsesLoading,
  horsesError,
  retryHorses,
}: {
  horse: HorseDetailDto;
  horseId: string;
  token: string;
  owners: StaffDto[];
  ownersLoading: boolean;
  ownersError: unknown;
  retryOwners: () => void;
  horses: HorseListItemDto[];
  horsesLoading: boolean;
  horsesError: unknown;
  retryHorses: () => void;
}) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const [name, setName] = useState(horse.name);
  const [gender, setGender] = useState<HorseGenderDto>(
    isHorseGender(horse.gender) ? horse.gender : "MALE",
  );
  const [breed, setBreed] = useState(horse.breed ?? "");
  const [color, setColor] = useState(horse.color ?? "");
  const [microchipId, setMicrochipId] = useState(horse.microchipId ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(horse.dateOfBirth ?? "");
  const [photo, setPhoto] = useState<LocalMediaAsset | null>(null);
  const [uploadedPhotoId, setUploadedPhotoId] = useState<string | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [ownerId, setOwnerId] = useState(horse.ownerId ?? "");
  const [sireId, setSireId] = useState(horse.sireId ?? "");
  const [damId, setDamId] = useState(horse.damId ?? "");
  const [sireSearch, setSireSearch] = useState("");
  const [damSearch, setDamSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const savingRef = useRef(false);
  const loadPhoto = useCallback(() => horseService.getPhotoUrl(token, horseId), [horseId, token]);
  const photoResource = useApiResource(loadPhoto, Boolean(horse.mediaId));
  const candidateSires = useMemo(
    () =>
      horses.filter(
        (candidate) =>
          candidate.id !== horseId &&
          ["MALE", "GELDING"].includes(candidate.gender ?? "") &&
          !candidate.isDeleted &&
          matches(candidate, sireSearch),
      ),
    [horseId, horses, sireSearch],
  );
  const candidateDams = useMemo(
    () =>
      horses.filter(
        (candidate) =>
          candidate.id !== horseId &&
          candidate.gender === "FEMALE" &&
          !candidate.isDeleted &&
          matches(candidate, damSearch),
      ),
    [damSearch, horseId, horses],
  );

  const save = async () => {
    if (savingRef.current) return;
    const validationError = validateHorseIdentity({
      name,
      breed,
      color,
      microchipId,
      dateOfBirth,
      gender,
      horseId,
      sireId,
      damId,
      horses,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError("");
    savingRef.current = true;
    setSaving(true);
    try {
      let mediaId = uploadedPhotoId;
      if (photo && !mediaId) {
        setUploadingPhoto(true);
        mediaId = await mediaService.uploadHorsePhoto(token, photo);
        setUploadedPhotoId(mediaId);
        setUploadingPhoto(false);
      }
      const updated = await horseService.update(token, horseId, {
        version: horse.version,
        name: name.trim(),
        gender,
        breed: breed.trim() || null,
        color: color.trim() || null,
        microchipId: microchipId.trim() || null,
        dateOfBirth: dateOfBirth.trim() || null,
        sireId: sireId || null,
        damId: damId || null,
        ...(!horse.ownerId && ownerId ? { ownerId } : {}),
        ...(mediaId ? { mediaId } : removeExistingPhoto ? { mediaId: null } : {}),
      });
      Alert.alert("Profile saved", updated.name);
      safeBack(`/manager/horse/${horseId}` as Href);
    } catch (error) {
      const message = extractErrorMessage(error);
      setFormError(message);
      Alert.alert("Could not save profile", message);
    } finally {
      savingRef.current = false;
      setUploadingPhoto(false);
      setSaving(false);
    }
  };

  const choosePhoto = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/webp"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0]);
      setUploadedPhotoId(null);
      setRemoveExistingPhoto(false);
    }
  };

  return (
    <>
      <Panel>
        <View style={{ gap: 18 }}>
          <Field label="Horse name">
            <NativeInput value={name} onChangeText={setName} />
          </Field>
          <Field label="Gender">
            <Chips
              options={["MALE", "FEMALE", "GELDING"]}
              value={gender}
              onChange={(value) => setGender(value as HorseGenderDto)}
            />
          </Field>
          <Field label="Breed">
            <NativeInput value={breed} onChangeText={setBreed} />
          </Field>
          <Field label="Color">
            <NativeInput value={color} onChangeText={setColor} />
          </Field>
          <Field label="Microchip ID">
            <NativeInput
              value={microchipId}
              onChangeText={setMicrochipId}
              keyboardType="number-pad"
            />
          </Field>
          <Field label="Date of birth (YYYY-MM-DD)">
            <NativeInput value={dateOfBirth} onChangeText={setDateOfBirth} />
          </Field>
          <Field label="Sire">
            <NativeInput
              value={sireSearch}
              onChangeText={setSireSearch}
              placeholder="Search by name or Horse ID"
            />
            {horsesLoading || horsesError ? (
              <AsyncStateView isLoading={horsesLoading} error={horsesError} onRetry={retryHorses} />
            ) : candidateSires.length ? (
              <Chips
                options={[
                  "None",
                  ...candidateSires.map(
                    (candidate) => `${candidate.name} · ${candidate.id.slice(0, 6)}`,
                  ),
                ]}
                value={selectedHorseLabel(candidateSires, sireId)}
                onChange={(value) => {
                  setSireId(
                    value === "None"
                      ? ""
                      : (candidateSires.find((candidate) => horseLabel(candidate) === value)?.id ??
                          ""),
                  );
                  setSireSearch("");
                }}
              />
            ) : (
              <Text>No sire profiles found.</Text>
            )}
          </Field>
          <Field label="Dam">
            <NativeInput
              value={damSearch}
              onChangeText={setDamSearch}
              placeholder="Search by name or Horse ID"
            />
            {horsesLoading || horsesError ? (
              <AsyncStateView isLoading={horsesLoading} error={horsesError} onRetry={retryHorses} />
            ) : candidateDams.length ? (
              <Chips
                options={[
                  "None",
                  ...candidateDams.map(
                    (candidate) => `${candidate.name} · ${candidate.id.slice(0, 6)}`,
                  ),
                ]}
                value={selectedHorseLabel(candidateDams, damId)}
                onChange={(value) => {
                  setDamId(
                    value === "None"
                      ? ""
                      : (candidateDams.find((candidate) => horseLabel(candidate) === value)?.id ??
                          ""),
                  );
                  setDamSearch("");
                }}
              />
            ) : (
              <Text>No dam profiles found.</Text>
            )}
          </Field>
          <Field label="Primary owner">
            {horse.ownerId ? (
              <Text style={{ color: colors.mutedForeground }}>
                {horse.owner?.fullName ?? "Assigned"} · ownership changes use the transfer workflow.
              </Text>
            ) : ownersLoading || ownersError ? (
              <AsyncStateView isLoading={ownersLoading} error={ownersError} onRetry={retryOwners} />
            ) : owners.length ? (
              <Chips
                options={owners.map((owner) => `${owner.fullName} · ${owner.id.slice(0, 6)}`)}
                value={
                  owners.find((owner) => owner.id === ownerId)
                    ? `${owners.find((owner) => owner.id === ownerId)!.fullName} · ${ownerId.slice(0, 6)}`
                    : ""
                }
                onChange={(value) =>
                  setOwnerId(
                    owners.find((owner) => `${owner.fullName} · ${owner.id.slice(0, 6)}` === value)
                      ?.id ?? "",
                  )
                }
              />
            ) : (
              <Text style={{ color: colors.mutedForeground }}>No active horse owners found.</Text>
            )}
          </Field>
        </View>
      </Panel>
      {formError ? (
        <Panel style={uiStyles.alert}>
          <Text style={{ color: colors.destructive, fontWeight: "600", fontSize: 13 }}>
            {formError}
          </Text>
        </Panel>
      ) : null}
      <Panel>
        <View style={{ gap: 12 }}>
          <Text style={uiStyles.value}>Horse photo</Text>
          {photo ? (
            <>
              <Text style={uiStyles.muted}>{photo.name}</Text>
              <Image
                source={{ uri: photo.uri }}
                style={{ width: 200, height: 150, borderRadius: 12 }}
                resizeMode="cover"
              />
              <SecondaryButton
                label="Remove selected photo"
                onPress={() => {
                  setPhoto(null);
                  setUploadedPhotoId(null);
                }}
              />
            </>
          ) : horse.mediaId && !removeExistingPhoto ? (
            <>
              {photoResource.data?.url ? (
                <Image
                  source={{ uri: photoResource.data.url }}
                  style={{ width: 200, height: 150, borderRadius: 12 }}
                  resizeMode="cover"
                />
              ) : photoResource.error ? (
                <Text style={uiStyles.muted}>Could not load the current photo preview.</Text>
              ) : null}
              <SecondaryButton
                label="Remove current photo"
                onPress={() => setRemoveExistingPhoto(true)}
                disabled={saving}
              />
            </>
          ) : removeExistingPhoto ? (
            <Text style={uiStyles.muted}>Current photo will be removed when you save.</Text>
          ) : null}
          {removeExistingPhoto ? (
            <SecondaryButton
              label="Keep current photo"
              onPress={() => setRemoveExistingPhoto(false)}
              disabled={saving}
            />
          ) : null}
          {!photo ? (
            <SecondaryButton
              label="Choose replacement photo"
              onPress={() => void choosePhoto()}
              disabled={saving}
            />
          ) : null}
          <Text style={uiStyles.muted}>JPEG, PNG, or WebP · up to 10 MB</Text>
        </View>
      </Panel>
      <PrimaryButton
        label={uploadingPhoto ? "Uploading photo…" : saving ? "Saving…" : "Save profile"}
        icon="checkmark"
        disabled={saving}
        onPress={() => void save()}
      />
    </>
  );
}

function isHorseGender(value: string | null): value is HorseGenderDto {
  return value === "MALE" || value === "FEMALE" || value === "GELDING";
}

function matches(horse: HorseListItemDto, query: string) {
  return (
    !query.trim() || `${horse.name} ${horse.id}`.toLowerCase().includes(query.trim().toLowerCase())
  );
}

function horseLabel(horse: HorseListItemDto) {
  return `${horse.name} · ${horse.id.slice(0, 6)}`;
}

function selectedHorseLabel(horses: HorseListItemDto[], horseId: string) {
  return horses.find((horse) => horse.id === horseId)
    ? horseLabel(horses.find((horse) => horse.id === horseId)!)
    : "None";
}
