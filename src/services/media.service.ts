import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import type { DocumentPickerAsset } from "expo-document-picker";
import { apiRequest } from "@/services/api-client";
import { API_BASE_URL } from "@/config/api";

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

type ResolvedStorageUrl = {
  targetUrl: string;
  hostHeader?: string;
};

function resolveStorageUrl(url: string): ResolvedStorageUrl {
  try {
    const parsed = new URL(url);
    const originalHost = parsed.host; // e.g. "localhost:9000"
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      const parsedApi = new URL(API_BASE_URL);
      if (
        parsedApi.hostname &&
        parsedApi.hostname !== "localhost" &&
        parsedApi.hostname !== "127.0.0.1"
      ) {
        parsed.hostname = parsedApi.hostname;
        return { targetUrl: parsed.toString(), hostHeader: originalHost };
      }
    }
  } catch {}
  return { targetUrl: url };
}

async function uploadImageAsset(
  token: string,
  asset: LocalMediaAsset,
  purpose: "HORSE_PHOTO" | "INCIDENT_PHOTO",
  onProgress?: (percent: number) => void,
): Promise<string> {
  let normalizedMime = asset.mimeType?.toLowerCase().split(";")[0]?.trim();
  if (normalizedMime === "image/jpg") normalizedMime = "image/jpeg";
  const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";
  const inferredMime: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const mimeType =
    normalizedMime && IMAGE_TYPES.has(normalizedMime) ? normalizedMime : inferredMime[extension];
  if (!mimeType) throw new Error("Ảnh phải có định dạng JPEG, JPG, PNG hoặc WebP.");

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
        if (!byteSize) {
          const res = await fetch(asset.uri);
          const blob = await res.blob();
          byteSize = blob.size;
        }
      }
    } catch {}
  }

  if (!byteSize || byteSize < 1 || byteSize > MAX_IMAGE_BYTES) {
    throw new Error("Ảnh phải có dung lượng từ 1 byte đến 10 MB.");
  }
  const upload = await apiRequest<UploadRequestDto>("/media/upload-requests", {
    method: "POST",
    token,
    body: { purpose, fileName: asset.name, mimeType, byteSize },
  });
  const { targetUrl: targetUploadUrl, hostHeader } = resolveStorageUrl(upload.uploadUrl);
  const headers: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(upload.headers).filter(([key]) => key.toLowerCase() !== "content-length"),
    ),
    ...(hostHeader && Platform.OS !== "web" ? { Host: hostHeader } : {}),
  };

  if (Platform.OS === "web") {
    const blobRes = await fetch(asset.uri);
    const blob = await blobRes.blob();
    const putPromise = fetch(targetUploadUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": mimeType,
      },
      body: blob,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Quá thời gian tải ảnh lên (60s). Vui lòng thử lại.")),
        60000,
      ),
    );
    const putRes = await Promise.race([putPromise, timeoutPromise]);
    if (!putRes.ok) {
      throw new Error("Lưu trữ từ chối ảnh tải lên. Vui lòng thử lại.");
    }
  } else {
    const task = FileSystem.createUploadTask(
      targetUploadUrl,
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
        reject(new Error("Quá thời gian tải ảnh lên (60s). Vui lòng thử lại."));
      }, 60000),
    );
    const result = await Promise.race([task.uploadAsync(), timeoutPromise]);
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error("Kho lưu trữ từ chối ảnh. Vui lòng thử lại.");
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

    const { targetUrl: targetVideoUploadUrl, hostHeader } = resolveStorageUrl(upload.uploadUrl);
    const videoHeaders: Record<string, string> = {
      ...headers,
      ...(hostHeader && Platform.OS !== "web" ? { Host: hostHeader } : {}),
    };
    const task = FileSystem.createUploadTask(
      targetVideoUploadUrl,
      asset.uri,
      {
        httpMethod: upload.method,
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: videoHeaders,
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

  async downloadUrl(token: string, mediaId: string) {
    const res = await apiRequest<{ url: string }>(
      `/media/${encodeURIComponent(mediaId)}/download-url`,
      {
        token,
      },
    );
    return { url: resolveStorageUrl(res.url).targetUrl };
  },
};
