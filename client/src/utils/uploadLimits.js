export const UPLOAD_LIMITS = Object.freeze({
  image: 15 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  file: 25 * 1024 * 1024
});

export const UPLOAD_MIME_TYPES = Object.freeze([
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf", "application/zip", "application/x-zip-compressed", "audio/mpeg", "audio/wav", "audio/ogg", "text/plain",
  "application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

export function uploadKind(fileOrMime) {
  const mime = typeof fileOrMime === "string" ? fileOrMime : fileOrMime?.type || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

export function validateUploadFile(file) {
  if (!file || !UPLOAD_MIME_TYPES.includes(file.type) || file.name.toLowerCase().endsWith(".svg")) {
    return { ok: false, error: "Este tipo de arquivo não é compatível." };
  }
  const kind = uploadKind(file);
  if (file.size > UPLOAD_LIMITS[kind]) {
    return { ok: false, error: "Este arquivo ultrapassa o limite permitido." };
  }
  return { ok: true, kind, limit: UPLOAD_LIMITS[kind] };
}

export function formatUploadLimit(kind) {
  return `${Math.round(UPLOAD_LIMITS[kind] / (1024 * 1024))} MB`;
}
