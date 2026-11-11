export type CloudinaryImageSignature = {
  cloudName: string;
  apiKey: string;
  signature: string;
  parameters: {
    folder?: string;
    asset_folder?: string;
    timestamp: string;
    public_id: string;
    overwrite: "false";
    allowed_formats: "jpg,png,webp";
    upload_preset?: string;
  };
};

export type CloudinaryImageSignatureResult = { ok: true; data: CloudinaryImageSignature } | { ok: false; error: string };
