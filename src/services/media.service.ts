import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import type { DocumentPickerAsset } from "expo-document-picker";
import { apiRequest } from "@/services/api-client";

const MAX_TRIAL_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TRIAL_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

type UploadRequestDto = {
  assetId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
};

export type LocalMediaAsset = Pick<DocumentPickerAsset, "name" | "uri" | "size" | "mimeType">;
export type TrialVideoAsset = LocalMediaAsset;

async function uploadImageAsset(
  token: string,
  asset: LocalMediaAsset,
  purpose: "HORSE_PHOTO" | "INCIDENT_PHOTO",
  onProgress?: (percent: number) => void,
): Promise<string> {
  const declaredMime = asset.mimeType?.toLowerCase().split(";")[0];
  const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";
  const inferredMime: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const mimeType =
    declaredMime && IMAGE_TYPES.has(declaredMime) ? declaredMime : inferredMime[extension];
  if (!mimeType) throw new Error("Photo must be JPEG, PNG, or WebP.");

  let byteSize = asset.size;
  if (!byteSize) {
    try {
      if (Platform.OS === "web") {
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        byteSize = blob.size;
      } else {
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        byteSize = fileInfo.exists && !fileInfo.isDirectory ? fileInfo.size : undefined;
      }
    } catch {}
  }

  if (!byteSize || byteSize < 1 || byteSize > MAX_IMAGE_BYTES) {
    throw new Error("Photo must be between 1 byte and 10 MB.");
  }
  const upload = await apiRequest<UploadRequestDto>("/media/upload-requests", {
    method: "POST",
    token,
    body: { purpose, fileName: asset.name, mimeType, byteSize },
  });
  const headers = Object.fromEntries(
    Object.entries(upload.headers).filter(([key]) => key.toLowerCase() !== "content-length"),
  );

  if (Platform.OS === "web") {
    const blobRes = await fetch(asset.uri);
    const blob = await blobRes.blob();
    const putPromise = fetch(upload.uploadUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": mimeType,
      },
      body: blob,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Quá thời gian tải ảnh lên (25s). Vui lòng thử lại.")),
        25000,
      ),
    );
    const putRes = await Promise.race([putPromise, timeoutPromise]);
    if (!putRes.ok) {
      throw new Error("Lưu trữ từ chối ảnh tải lên. Vui lòng thử lại.");
    }
  } else {
    const task = FileSystem.createUploadTask(
      upload.uploadUrl,
      asset.uri,
      {
        httpMethod: upload.method,
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers,
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (totalBytesExpectedToSend > 0) {
          onProgress?.(Math.min(99, Math.round((totalBytesSent / totalBytesExpectedToSend) * 100)));
        }
      },
    );
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        task.cancelAsync().catch(() => {});
        reject(new Error("Quá thời gian tải ảnh lên (25s). Vui lòng thử lại."));
      }, 25000),
    );
    const result = await Promise.race([task.uploadAsync(), timeoutPromise]);
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error("Storage rejected the photo. Please try again.");
    }
  }

  await apiRequest(`/media/${encodeURIComponent(upload.assetId)}/complete`, {
    method: "POST",
    token,
  });
  onProgress?.(100);
  return upload.assetId;
}

function trialVideoMimeType(asset: TrialVideoAsset): string {
  const declared = asset.mimeType?.toLowerCase().split(";")[0];
  if (declared && TRIAL_VIDEO_TYPES.has(declared)) return declared;
  const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";
  const inferred = MIME_BY_EXTENSION[extension];
  if (inferred) return inferred;
  throw new Error("Video chạy thử phải là MP4, WebM hoặc QuickTime.");
}

export const mediaService = {
  uploadHorsePhoto(token: string, asset: LocalMediaAsset, onProgress?: (percent: number) => void) {
    return uploadImageAsset(token, asset, "HORSE_PHOTO", onProgress);
  },

  async uploadTrialVideo(
    token: string,
    asset: TrialVideoAsset,
    options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {},
  ): Promise<string> {
    const mimeType = trialVideoMimeType(asset);
    const fileInfo = await FileSystem.getInfoAsync(asset.uri);
    const byteSize =
      asset.size ?? (fileInfo.exists && !fileInfo.isDirectory ? fileInfo.size : undefined);
    if (!byteSize || byteSize < 1 || byteSize > MAX_TRIAL_VIDEO_BYTES) {
      throw new Error("Video phải có dung lượng từ 1 byte đến 200 MB.");
    }
    if (options.signal?.aborted) throw new Error("Đã hủy tải video.");

    const upload = await apiRequest<UploadRequestDto>("/media/upload-requests", {
      method: "POST",
      token,
      body: {
        purpose: "TRIAL_VIDEO",
        fileName: asset.name,
        mimeType,
        byteSize,
      },
    });
    if (options.signal?.aborted) throw new Error("Đã hủy tải video.");

    // The native uploader sets Content-Length from the local file body. Passing
    // it as a custom header is blocked by some platform networking stacks.
    const headers = Object.fromEntries(
      Object.entries(upload.headers).filter(([key]) => key.toLowerCase() !== "content-length"),
    );

    const task = FileSystem.createUploadTask(
      upload.uploadUrl,
      asset.uri,
      {
        httpMethod: upload.method,
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers,
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (totalBytesExpectedToSend > 0) {
          options.onProgress?.(
            Math.min(99, Math.round((totalBytesSent / totalBytesExpectedToSend) * 100)),
          );
        }
      },
    );
    const cancelUpload = () => void task.cancelAsync();
    options.signal?.addEventListener("abort", cancelUpload, { once: true });
    try {
      const result = await task.uploadAsync();
      if (options.signal?.aborted) throw new Error("Đã hủy tải video.");
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error("Kho lưu trữ từ chối video. Vui lòng thử lại.");
      }
      await apiRequest(`/media/${encodeURIComponent(upload.assetId)}/complete`, {
        method: "POST",
        token,
      });
      options.onProgress?.(100);
      return upload.assetId;
    } finally {
      options.signal?.removeEventListener("abort", cancelUpload);
    }
  },

  async uploadIncidentPhoto(
    token: string,
    asset: LocalMediaAsset,
    onProgress?: (percent: number) => void,
  ): Promise<string> {
    return uploadImageAsset(token, asset, "INCIDENT_PHOTO", onProgress);
  },

  downloadUrl(token: string, mediaId: string) {
    return apiRequest<{ url: string }>(`/media/${encodeURIComponent(mediaId)}/download-url`, {
      token,
    });
  },
};
