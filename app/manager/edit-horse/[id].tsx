import { useCallback, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { safeBack } from "@/utils/navigation";
import { Alert, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { AsyncStateView, Screen } from "@/components/common";
import {
  Field,
  DatePickerField,
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
import { Ionicons } from "@expo/vector-icons";
import { radius, space } from "@/config/theme";
import type { StaffDto } from "@/adapters/staff.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import type { HorseDetailDto, HorseGenderDto, HorseListItemDto } from "@/adapters/horse.adapter";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import {
  clubDate,
  formatToDdMmYyyy,
  isValidIsoDate,
  normalizeVietnamese,
  parseToIsoDate,
  subtractYears,
  validateHorseIdentity,
} from "@/utils/horse-validation";

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
          key={`${horseId}-${resource.data.version}`}
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
          reloadHorse={() => resource.refresh()}
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
  reloadHorse,
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
  reloadHorse: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const [name, setName] = useState(horse.name);
  const [gender, setGender] = useState<HorseGenderDto>(
    isHorseGender(horse.gender) ? horse.gender : "MALE",
  );
  const [breed, setBreed] = useState(horse.breed ?? "");
  const [color, setColor] = useState(horse.color ?? "");
  const [microchipId, setMicrochipId] = useState(horse.microchipId ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(formatToDdMmYyyy(horse.dateOfBirth));
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

  const microchipError = useMemo(() => {
    const val = microchipId.trim();
    if (!val) return "";
    if (!/^\d+$/.test(val)) return t("Mã microchip chỉ được chứa các chữ số.");
    if (val.length !== 15)
      return `${t("Mã microchip phải gồm đúng 15 chữ số")} (${val.length}/15).`;
    return "";
  }, [microchipId, t]);

  const duplicateChipHorse = useMemo(() => {
    const chip = microchipId.trim();
    if (!chip || !horses) return null;
    return (
      horses.find(
        (h) =>
          h.id !== horseId && h.microchipId && h.microchipId.toLowerCase() === chip.toLowerCase(),
      ) ?? null
    );
  }, [microchipId, horses, horseId]);

  const dobError = useMemo(() => {
    const val = dateOfBirth.trim();
    if (!val) return "";
    const iso = parseToIsoDate(val);
    if (!iso || !isValidIsoDate(iso))
      return t("Date of birth must be a valid date in DD-MM-YYYY format.");
    const today = clubDate();
    const [year, month, day] = iso.split("-").map(Number);
    const birth = new Date(Date.UTC(year, month - 1, day));
    const [nowYear, nowMonth, nowDay] = today.split("-").map(Number);
    const now = new Date(Date.UTC(nowYear, nowMonth - 1, nowDay));
    const ageYears = (now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 1) return t("Ngựa phải từ 1 tuổi trở lên.");
    if (ageYears > 40) return t("Ngựa không được quá 40 tuổi.");
    return "";
  }, [dateOfBirth, t]);

  const nameError = useMemo(() => {
    const val = name.trim();
    if (!val) return "";
    if (val.length > 160) return t("Tên ngựa không được vượt quá 160 ký tự.");
    return "";
  }, [name, t]);
  const loadPhoto = useCallback(() => horseService.getPhotoUrl(token, horseId), [horseId, token]);
  const photoResource = useApiResource(loadPhoto, Boolean(horse.mediaId));
  const candidateSires = useMemo(() => {
    let list = horses.filter(
      (candidate) =>
        candidate.id !== horseId &&
        ["MALE", "GELDING"].includes(candidate.gender ?? "") &&
        !candidate.isDeleted &&
        matches(candidate, sireSearch),
    );
    const isoDob = parseToIsoDate(dateOfBirth);
    if (isoDob && isValidIsoDate(isoDob)) {
      const maxDob = subtractYears(isoDob, 2);
      list = list.filter((c) => !c.dateOfBirth || c.dateOfBirth <= maxDob);
    }
    return list;
  }, [horseId, horses, sireSearch, dateOfBirth]);

  const candidateDams = useMemo(() => {
    let list = horses.filter(
      (candidate) =>
        candidate.id !== horseId &&
        candidate.gender === "FEMALE" &&
        !candidate.isDeleted &&
        matches(candidate, damSearch),
    );
    const isoDob = parseToIsoDate(dateOfBirth);
    if (isoDob && isValidIsoDate(isoDob)) {
      const maxDob = subtractYears(isoDob, 2);
      list = list.filter((c) => !c.dateOfBirth || c.dateOfBirth <= maxDob);
    }
    return list;
  }, [damSearch, horseId, horses, dateOfBirth]);

  const save = async () => {
    const isoDob = parseToIsoDate(dateOfBirth);
    const validationError = validateHorseIdentity({
      name,
      breed,
      color,
      microchipId,
      dateOfBirth: isoDob,
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
        ...(microchipId.trim() ? { microchipId: microchipId.trim() } : {}),
        dateOfBirth: isoDob || null,
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
      const isConflict =
        (error as { status?: number })?.status === 409 ||
        message.toLowerCase().includes("version") ||
        message.toLowerCase().includes("xung đột") ||
        message.toLowerCase().includes("thay đổi");
      if (isConflict) {
        Alert.alert(
          t("Hồ sơ đã thay đổi"),
          t(
            "Dữ liệu hồ sơ ngựa đã có thay đổi mới từ phiên làm việc khác. Bạn có muốn tải lại để nhận phiên bản mới nhất?",
          ),
          [
            { text: t("Hủy"), style: "cancel" },
            {
              text: t("Tải lại hồ sơ"),
              onPress: () => {
                void reloadHorse();
              },
            },
          ],
        );
      } else {
        Alert.alert("Could not save profile", message);
      }
    } finally {
      savingRef.current = false;
      setUploadingPhoto(false);
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
      setRemoveExistingPhoto(false);
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Quyền máy ảnh", "Vui lòng cấp quyền truy cập máy ảnh để chụp ảnh ngựa.");
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
      setRemoveExistingPhoto(false);
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
        setRemoveExistingPhoto(false);
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
    <>
      {/* Group 1: Nhận dạng & Ngoại hình */}
      <Panel style={{ gap: space.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: space.sm,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              backgroundColor: colors.fitSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="finger-print-outline" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              1. Nhận dạng & Ngoại hình
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              Tên ngựa, mã vi mạch, giới tính, màu lông và ngày sinh
            </Text>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <Field label="Tên ngựa *">
            <NativeInput value={name} onChangeText={setName} />
            {nameError ? (
              <Text
                style={{ color: colors.destructive, fontSize: 12, marginTop: 4, fontWeight: "600" }}
              >
                {nameError}
              </Text>
            ) : null}
          </Field>

          <Field label="Giới tính *">
            <Chips
              options={["MALE", "FEMALE", "GELDING"]}
              value={gender}
              onChange={(value) => setGender(value as HorseGenderDto)}
            />
          </Field>

          <Field label="Giống ngựa">
            <NativeInput value={breed} onChangeText={setBreed} />
          </Field>

          <Field label="Màu lông">
            <NativeInput value={color} onChangeText={setColor} />
          </Field>

          <Field label="Mã vi mạch (Microchip ID)">
            <NativeInput
              value={microchipId}
              onChangeText={setMicrochipId}
              keyboardType="number-pad"
            />
            {duplicateChipHorse ? (
              <View style={[uiStyles.alert, { marginTop: 6, gap: 4 }]}>
                <Text style={{ color: colors.destructive, fontSize: 13, fontWeight: "600" }}>
                  {t("Microchip này đã được đăng ký cho")} {duplicateChipHorse.name} (
                  {t(duplicateChipHorse.lifecycleStatus)}).
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/manager/horse/${duplicateChipHorse.id}` as Href)}
                  style={{ alignSelf: "flex-start", marginTop: 2 }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 13,
                      fontWeight: "700",
                      textDecorationLine: "underline",
                    }}
                  >
                    {t("Xem hồ sơ")} →
                  </Text>
                </Pressable>
              </View>
            ) : microchipError ? (
              <Text
                style={{
                  color: colors.destructive,
                  fontSize: 12,
                  marginTop: 4,
                  fontWeight: "600",
                }}
              >
                {microchipError}
              </Text>
            ) : null}
          </Field>

          <Field label="Ngày sinh (DD-MM-YYYY)">
            <DatePickerField
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="DD-MM-YYYY (ví dụ: 20-05-2021)"
            />
            {dobError ? (
              <Text
                style={{ color: colors.destructive, fontSize: 12, marginTop: 4, fontWeight: "600" }}
              >
                {dobError}
              </Text>
            ) : null}
          </Field>

          {/* Photo Section inside Group 1 */}
          <View style={uiStyles.section}>
            <Text style={uiStyles.value}>Ảnh đại diện hồ sơ</Text>
            {photo ? (
              <View style={{ gap: 8, alignItems: "flex-start" }}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: "100%", height: 160, borderRadius: radius.md }}
                  resizeMode="cover"
                />
                <Text style={uiStyles.muted} numberOfLines={1} ellipsizeMode="middle">
                  {photo.name}
                </Text>
                <SecondaryButton
                  label="Xóa ảnh đã chọn"
                  icon="trash-outline"
                  onPress={() => {
                    setPhoto(null);
                    setUploadedPhotoId(null);
                  }}
                />
              </View>
            ) : horse.mediaId && !removeExistingPhoto ? (
              <View style={{ gap: 8, alignItems: "flex-start" }}>
                {photoResource.data?.url ? (
                  <Image
                    source={{ uri: photoResource.data.url }}
                    style={{ width: "100%", height: 160, borderRadius: radius.md }}
                    resizeMode="cover"
                  />
                ) : photoResource.error ? (
                  <Text style={uiStyles.muted}>Không thể tải bản xem trước ảnh hiện tại.</Text>
                ) : null}
                <SecondaryButton
                  label="Gỡ ảnh hiện tại"
                  icon="trash-outline"
                  onPress={() => setRemoveExistingPhoto(true)}
                  disabled={saving}
                />
              </View>
            ) : removeExistingPhoto ? (
              <View style={{ gap: 8, alignItems: "flex-start" }}>
                <Text style={uiStyles.muted}>Ảnh hiện tại sẽ bị gỡ bỏ khi bạn lưu hồ sơ.</Text>
                <SecondaryButton
                  label="Giữ lại ảnh hiện tại"
                  onPress={() => setRemoveExistingPhoto(false)}
                  disabled={saving}
                />
              </View>
            ) : null}

            {!photo ? (
              <SecondaryButton
                label="Chọn ảnh thay thế"
                icon="image-outline"
                onPress={() => void choosePhoto()}
                disabled={saving}
              />
            ) : null}
            <Text style={uiStyles.muted}>Hỗ trợ JPEG, PNG hoặc WebP · Tối đa 10 MB</Text>
          </View>
        </View>
      </Panel>

      {/* Group 2: Nguồn gốc & Phả hệ */}
      <Panel style={{ gap: space.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: space.sm,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              backgroundColor: colors.trainingSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="git-network-outline" size={18} color={colors.training} />
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              2. Nguồn gốc & Phả hệ
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              Liên kết hồ sơ ngựa cha (Sire) và ngựa mẹ (Dam)
            </Text>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <Field label="Ngựa Cha - Sire">
            <NativeInput
              value={sireSearch}
              onChangeText={setSireSearch}
              placeholder="Tìm theo tên hoặc mã ngựa cha"
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
                  if (value === "None") {
                    setSireId("");
                    setSireSearch("");
                  } else {
                    const matched = candidateSires.find((c) => horseLabel(c) === value);
                    setSireId(matched?.id ?? "");
                    setSireSearch(matched?.name ?? "");
                  }
                }}
              />
            ) : (
              <Text style={{ color: colors.mutedForeground }}>
                Không tìm thấy hồ sơ ngựa cha phù hợp.
              </Text>
            )}
          </Field>

          <Field label="Ngựa Mẹ - Dam">
            <NativeInput
              value={damSearch}
              onChangeText={setDamSearch}
              placeholder="Tìm theo tên hoặc mã ngựa mẹ"
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
                  if (value === "None") {
                    setDamId("");
                    setDamSearch("");
                  } else {
                    const matched = candidateDams.find((c) => horseLabel(c) === value);
                    setDamId(matched?.id ?? "");
                    setDamSearch(matched?.name ?? "");
                  }
                }}
              />
            ) : (
              <Text style={{ color: colors.mutedForeground }}>
                Không tìm thấy hồ sơ ngựa mẹ phù hợp.
              </Text>
            )}
          </Field>
        </View>
      </Panel>

      {/* Group 3: Chủ sở hữu */}
      <Panel style={{ gap: space.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: space.sm,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              3. Chủ sở hữu & Pháp trị
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              Chủ sở hữu hiện tại và thủ tục chuyển nhượng
            </Text>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <Field label="Chủ sở hữu chính">
            {horse.ownerId ? (
              <View
                style={[
                  uiStyles.alert,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>
                  {horse.owner?.fullName ?? "Đã chỉ định"}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  Quyền sở hữu được bảo vệ. Việc thay đổi chủ sở hữu được thực hiện qua quy trình
                  chuyển nhượng chính thức.
                </Text>
              </View>
            ) : ownersLoading || ownersError ? (
              <AsyncStateView isLoading={ownersLoading} error={ownersError} onRetry={retryOwners} />
            ) : owners.length ? (
              <Chips
                options={owners.map((owner) => owner.fullName)}
                value={owners.find((owner) => owner.id === ownerId)?.fullName ?? ""}
                onChange={(value) =>
                  setOwnerId(owners.find((owner) => owner.fullName === value)?.id ?? "")
                }
              />
            ) : (
              <Text style={{ color: colors.mutedForeground }}>
                Không tìm thấy chủ sở hữu nào đang hoạt động.
              </Text>
            )}
          </Field>
        </View>
      </Panel>

      {/* Group 4: Khu nuôi & Vòng đời */}
      <Panel style={{ gap: space.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: space.sm,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              backgroundColor: colors.fitSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="home-outline" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              4. Khu nuôi & Trạng thái chuồng
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              Khu chuồng và ô chuồng nuôi dưỡng hiện tại
            </Text>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Khu chuồng (Barn):</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
              {horse.location?.barn?.name ?? "Chưa chỉ định Barn"}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Ô chuồng (Stall):</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
              {horse.location?.stall?.code ? `Ô số ${horse.location.stall.code}` : "Chưa xếp ô"}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 4 }}>
            Để chuyển chuồng hoặc xếp ô mới, sử dụng tính năng Chuyển chuồng trong Quản lý Chuồng
            trại.
          </Text>
        </View>
      </Panel>

      {/* Prominent Action Bar */}
      <Panel
        style={{
          gap: space.sm,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        {formError ? (
          <View style={[uiStyles.alert, { marginBottom: 4 }]}>
            <Text style={{ color: colors.destructive, fontWeight: "700", fontSize: 13 }}>
              ⚠️ {formError}
            </Text>
          </View>
        ) : null}

        <PrimaryButton
          label={uploadingPhoto ? "Đang tải ảnh lên…" : saving ? "Đang lưu…" : "Lưu thay đổi hồ sơ"}
          icon="checkmark-circle"
          disabled={saving || Boolean(nameError || microchipError || dobError)}
          onPress={() => void save()}
        />

        <SecondaryButton
          label="Hủy và quay lại"
          icon="close-circle-outline"
          disabled={saving}
          onPress={() => safeBack(`/manager/horse/${horseId}` as Href)}
        />
      </Panel>
    </>
  );
}

function isHorseGender(value: string | null): value is HorseGenderDto {
  return value === "MALE" || value === "FEMALE" || value === "GELDING";
}

function matches(horse: HorseListItemDto, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const rawQuery = trimmed.toLowerCase();
  const normQuery = normalizeVietnamese(trimmed);
  const text = `${horse.name} ${horse.id}`;
  if (text.toLowerCase().includes(rawQuery)) return true;
  return normalizeVietnamese(text).includes(normQuery);
}

function horseLabel(horse: HorseListItemDto) {
  return `${horse.name} · ${horse.id.slice(0, 6)}`;
}

function selectedHorseLabel(horses: HorseListItemDto[], horseId: string) {
  return horses.find((horse) => horse.id === horseId)
    ? horseLabel(horses.find((horse) => horse.id === horseId)!)
    : "None";
}
