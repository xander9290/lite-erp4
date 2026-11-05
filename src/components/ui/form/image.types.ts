export type ImageUploadOptions = {
  signal: AbortSignal;
  onProgress: (percentage: number) => void;
};

export type ImageUploader = (file: File, options: ImageUploadOptions) => Promise<string>;
export type ImageOutputType = "image/webp" | "image/jpeg" | "image/png";
export type ImageSelection = { unit: "%"; x: number; y: number; width: number; height: number };
export type ImageSize = { width: number; height: number };
