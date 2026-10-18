import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Text } from "@/components/common/LocalizedText";
import { Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { mediaService } from "@/services/media.service";

type TrialVideoPickerProps = {
  token: string;
  value: string | null;
  onChange: (mediaId: string | null) => void;
  disabled?: boolean;
};

export function TrialVideoPicker({ token, value, onChange, disabled }: TrialVideoPickerProps) {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      const controller = abortRef.current;
      abortRef.current = null;
      controller?.abort();
    },
    [],
  );

  const chooseAndUpload = async () => {
    if (uploading || disabled) return;
    let controller: AbortController | null = null;
    try {
      const selected = await DocumentPicker.getDocumentAsync({
        type: ["video/mp4", "video/webm", "video/quicktime"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selected.canceled || !selected.assets[0]) return;

      const asset = selected.assets[0];
      controller = new AbortController();
      abortRef.current = controller;
      setFileName(asset.name);
      setProgress(0);
      setUploading(true);
      onChange(null);
      const mediaId = await mediaService.uploadTrialVideo(token, asset, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (!controller.signal.aborted) onChange(mediaId);
    } catch (error) {
      if (!controller?.signal.aborted) {
        Alert.alert(
          "Could not upload trial video",
          error instanceof Error ? error.message : "Please try again.",
        );
      }
    } finally {
      if (controller && abortRef.current === controller) {
        abortRef.current = null;
        setUploading(false);
      }
    }
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setUploading(false);
    setProgress(0);
    onChange(null);
  };

  return (
    <Panel style={{ gap: 8 }}>
      <Text style={ui.value}>Trial video (optional)</Text>
      {uploading ? (
        <>
          <Text style={ui.muted}>
            Uploading {fileName} · {progress}%
          </Text>
          <View
            style={{
              height: 5,
              overflow: "hidden",
              borderRadius: 4,
              backgroundColor: colors.border,
            }}
          >
            <View
              style={{
                width: `${progress}%`,
                height: 5,
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <SecondaryButton label="Cancel upload" icon="close" onPress={cancelUpload} />
        </>
      ) : value ? (
        <>
          <Text style={ui.muted}>{fileName || "Video uploaded and ready to attach."}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SecondaryButton
              label="Choose another video"
              icon="refresh-outline"
              style={{ flex: 1 }}
              disabled={disabled}
              onPress={() => void chooseAndUpload()}
            />
            <SecondaryButton
              label="Remove"
              icon="trash-outline"
              style={{ flex: 1 }}
              disabled={disabled}
              onPress={() => {
                onChange(null);
                setFileName("");
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={ui.muted}>MP4, WebM or QuickTime video, up to 200 MB.</Text>
          <PrimaryButton
            label="Choose video"
            icon="videocam-outline"
            disabled={disabled}
            onPress={() => void chooseAndUpload()}
          />
        </>
      )}
    </Panel>
  );
}
