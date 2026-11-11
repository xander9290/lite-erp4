/** Public defaults shared by UI, uploader and server policy. Credentials never belong here. */
export const imageUploadDefaults = Object.freeze({
  maxSizeMB: 10,
  outputType: "image/webp" as const,
  quality: 0.85,
});
