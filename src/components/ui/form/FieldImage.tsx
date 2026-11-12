"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, type HTMLAttributes } from "react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import ReactCrop from "react-image-crop";
import { Camera, ImagePlus, Trash2, Upload, UserRound, X } from "lucide-react";
import { useModelField } from "./modelFields";
import type { BaseFieldProps } from "./field.types";
import type { ImageOutputType, ImageSelection, ImageSize, ImageUploader } from "./image.types";
import { IMAGE_ACCEPT, MAX_IMAGE_DIMENSION, exportImage, fitImageSize, imageCropPixels, initialImageCrop, loadImage, publicImageUrl, validateImageFile, validateImageSize } from "./imageProcessing";
import { fieldDirectionClassName, fieldInputClassName, fieldLabelClassName } from "./field.styles";
import { useFormFieldValidation } from "./formValidation";
import ImageEditorModal from "./ImageEditorModal";
import "react-image-crop/dist/ReactCrop.css";
import { imageUploadDefaults } from "@/lib/uploads/config";

export type { ImageUploader, ImageUploadOptions } from "./image.types";
export type FieldImageProps<TFieldValues extends FieldValues = FieldValues> = BaseFieldProps<TFieldValues, string | null> &
  Omit<HTMLAttributes<HTMLDivElement>, keyof BaseFieldProps<TFieldValues, string | null> | "children" | "defaultValue"> & {
    upload?: ImageUploader;
    widget?: "image" | "avatar";
    shape?: "rounded" | "squared";
    maxSizeMB?: number;
    aspectRatio?: number;
    outputType?: ImageOutputType;
    quality?: number;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
  };

type Draft = ImageSize & { url: string; file: File };
type Phase = "idle" | "loading" | "editing" | "uploading";

const cropLabels = {
  cropArea: "Área de recorte: usa las flechas para moverla",
  nwDragHandle: "Esquina superior izquierda", nDragHandle: "Borde superior", neDragHandle: "Esquina superior derecha",
  eDragHandle: "Borde derecho", seDragHandle: "Esquina inferior derecha", sDragHandle: "Borde inferior",
  swDragHandle: "Esquina inferior izquierda", wDragHandle: "Borde izquierdo",
};

export default function FieldImage<TFieldValues extends FieldValues = FieldValues>(props: FieldImageProps<TFieldValues>) {
  const {
  name, label, direction = "block", widget = "image", shape, upload, onChange, onBlur, onFocus,
  maxSizeMB = imageUploadDefaults.maxSizeMB, aspectRatio, outputType = imageUploadDefaults.outputType, quality = imageUploadDefaults.quality,
  disabled, readOnly, required, id, className = "", "aria-label": ariaLabel,
  "aria-describedby": describedBy, ...containerProps
} = useModelField(props, "image");
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const modalId = `${inputId}-editor-modal`;
  const isAvatar = widget === "avatar";
  const rounded = shape === "rounded" || (shape === undefined && isAvatar);
  const avatarShape = rounded ? "rounded-full" : "rounded-none";
  const imageShape = shape === "squared" ? "rounded-none" : "rounded-box";
  const cropAspectRatio = aspectRatio ?? (isAvatar ? 1 : undefined);
  const labelId = `${inputId}-label`, hintId = `${inputId}-hint`, errorId = `${inputId}-error`;
  const { control, getFieldState, setError, clearErrors, trigger, watch } = useFormContext<TFieldValues>();
  const { field, fieldState } = useController({ name, control, disabled });
  const { value, ref: fieldRef, onChange: updateField, onBlur: blurField, disabled: fieldDisabled } = field;
  const fileInput = useRef<HTMLInputElement>(null);
  const selectButton = useRef<HTMLButtonElement>(null);
  const operation = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [crop, setCrop] = useState<ImageSelection>({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
  const [size, setSize] = useState<ImageSize>({ width: 1, height: 1 });
  const [aspect, setAspect] = useState(cropAspectRatio);
  const [type, setType] = useState<ImageOutputType>(outputType);
  const [exportQuality, setExportQuality] = useState(quality);
  const [progress, setProgress] = useState(0);
  const locked = fieldDisabled || readOnly;
  const busy = phase === "loading" || phase === "uploading";
  const fieldLabel = label?.trim();
  const accessibleLabel = ariaLabel || fieldLabel || name;
  let currentUrl: string | null = null;
  try { if (value) currentUrl = publicImageUrl(value); } catch { /* Invalid defaults are handled by validation, never rendered as image URLs. */ }

  const validate = useCallback((current: unknown) => {
    if (fieldDisabled || readOnly) return null;
    if (phase !== "idle") return "Confirma o cancela la edición de la imagen antes de enviar el formulario.";
    if (!current) return required ? "Selecciona y sube una imagen." : null;
    try { publicImageUrl(current); return null; } catch { return "La imagen debe tener una URL pública HTTPS válida."; }
  }, [fieldDisabled, readOnly, phase, required]);
  useFormFieldValidation(name, validate, "fieldImage");

  const cancel = useCallback((clear = true) => {
    operation.current?.abort(); operation.current = null;
    setDraft(null); setPhase("idle"); setProgress(0);
    if (clear && getFieldState(name).error?.type === "fieldImage") clearErrors(name);
  }, [clearErrors, getFieldState, name]);

  // watch's values subscription identifies whole-form resets, including reset(null) while the current URL is already null.
  useEffect(() => {
    const subscription = watch((_values, metadata) => { if (!metadata.name || metadata.name === name) cancel(false); });
    return () => subscription.unsubscribe();
  }, [watch, name, cancel]);
  useEffect(() => () => cancel(false), [cancel, fieldDisabled, readOnly, widget]);
  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);

  const restoreFocus = useCallback(() => selectButton.current?.focus(), []);

  function report(error: unknown) {
    setError(name, { type: "fieldImage", message: error instanceof Error ? error.message : "No se pudo procesar o subir la imagen." });
  }

  async function select(file?: File) {
    if (!file || locked || busy) return;
    try { validateImageFile(file, maxSizeMB); } catch (error) { report(error); return; }
    operation.current?.abort();
    const controller = new AbortController(); operation.current = controller;
    setPhase("loading");
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url, controller.signal);
      if (controller.signal.aborted) { URL.revokeObjectURL(url); return; }
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      validateImageSize(dimensions);
      const selection = initialImageCrop(dimensions, cropAspectRatio);
      setDraft({ ...dimensions, url, file }); setCrop(selection);
      setSize(fitImageSize(imageCropPixels(selection, dimensions)));
      setAspect(cropAspectRatio); setType(outputType); setExportQuality(quality); setPhase("editing");
    } catch (error) {
      URL.revokeObjectURL(url);
      if (!controller.signal.aborted) { setPhase(draft ? "editing" : "idle"); report(error); }
    }
  }

  function finishCrop(selection: ImageSelection) {
    if (!draft) return;
    try { setSize(fitImageSize(imageCropPixels(selection, draft))); } catch (error) { report(error); }
  }

  function resize(axis: "width" | "height", text: string) {
    if (!draft) return;
    const pixels = imageCropPixels(crop, draft);
    const amount = Number(text);
    const ratio = pixels.width / pixels.height;
    setSize(axis === "width" ? { width: amount, height: Math.round(amount / ratio) } : { height: amount, width: Math.round(amount * ratio) });
  }

  async function confirmUpload() {
    if (!draft || locked || busy) return;
    operation.current?.abort();
    const controller = new AbortController(); operation.current = controller;
    setPhase("uploading"); setProgress(0);
    let url: string;
    try {
      const file = await exportImage({ source: draft.url, crop, size, type, quality: exportQuality, filename: draft.file.name, signal: controller.signal });
      validateImageFile(file, maxSizeMB);
      if (!upload) throw new Error("Este campo necesita un proveedor de imágenes autorizado.");
      url = publicImageUrl(await upload(file, { signal: controller.signal, onProgress: (amount) => { if (!controller.signal.aborted) setProgress(Math.max(0, Math.min(100, amount))); } }));
      if (controller.signal.aborted || operation.current !== controller) return;
    } catch (error) {
      if (!controller.signal.aborted) { setPhase("editing"); report(error); }
      return;
    }
    operation.current = null; setPhase("idle"); setDraft(null); setProgress(0);
    if (getFieldState(name).error?.type === "fieldImage") clearErrors(name);
    updateField(url); blurField(); onChange?.(url); void trigger(name);
  }

  function remove() {
    if (locked || busy) return;
    cancel(); updateField(null); blurField(); onChange?.(null); void trigger(name);
    if (isAvatar) selectButton.current?.focus();
  }

  function editor() {
    return draft && (
          <div role="group" aria-label={`Editor de ${accessibleLabel}`} className={`min-w-0 rounded-box border border-base-300 bg-base-100 p-3 ${isAvatar ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "space-y-4"}`}>
            <div className="col-span-full flex min-w-0 flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 break-all text-sm font-medium">{draft.file.name} <span className="text-xs font-normal text-base-content/60">({draft.width} × {draft.height} px)</span></p>
              <button type="button" disabled={locked} onClick={() => cancel()} className="btn btn-ghost btn-sm">{busy ? "Cancelar subida" : "Cancelar edición"}</button>
            </div>
            <div className="flex min-w-0 items-center justify-center overflow-hidden rounded-lg bg-base-200 p-2">
              <ReactCrop crop={crop} aspect={aspect} circularCrop={isAvatar && rounded} keepSelection disabled={locked || busy} ruleOfThirds ariaLabels={cropLabels} onChange={(_pixels, percent) => setCrop(percent)} onComplete={(_pixels, percent) => finishCrop(percent)}>
                <Image unoptimized loading="eager" src={draft.url} width={draft.width} height={draft.height} alt="Imagen para recortar" draggable={false} className="block h-auto w-auto max-w-full" style={{ maxHeight: isAvatar ? "min(30dvh, 16rem)" : "20rem" }} />
              </ReactCrop>
            </div>
            <fieldset disabled={locked || busy} className="grid min-w-0 grid-cols-1 gap-3 @xs/form:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1 text-sm">Proporción
                <select autoComplete="off" className="select select-bordered w-full min-w-0" value={aspect ?? "free"} disabled={cropAspectRatio !== undefined || locked || busy} onChange={(event) => { const next = event.currentTarget.value === "free" ? undefined : Number(event.currentTarget.value); const selection = initialImageCrop(draft, next); setAspect(next); setCrop(selection); finishCrop(selection); }}>
                  <option value="free">Libre</option><option value={1}>Cuadrada 1:1</option><option value={4 / 3}>4:3</option><option value={16 / 9}>16:9</option>
                  {cropAspectRatio !== undefined && ![1, 4 / 3, 16 / 9].includes(cropAspectRatio) && <option value={cropAspectRatio}>Fija ({cropAspectRatio})</option>}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">Formato
                <select autoComplete="off" className="select select-bordered w-full min-w-0" value={type} onChange={(event) => setType(event.currentTarget.value as ImageOutputType)}><option value="image/webp">WebP</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option></select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">Ancho de salida (px)<input autoComplete="off" type="number" min={1} max={MAX_IMAGE_DIMENSION} step={1} value={size.width || ""} className={`${fieldInputClassName} px-1 text-right`} onChange={(event) => resize("width", event.currentTarget.value)} /></label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">Alto de salida (px)<input autoComplete="off" type="number" min={1} max={MAX_IMAGE_DIMENSION} step={1} value={size.height || ""} className={`${fieldInputClassName} px-1 text-right`} onChange={(event) => resize("height", event.currentTarget.value)} /></label>
              <label className="col-span-full flex min-w-0 flex-col gap-2 text-sm">Calidad: {Math.round(exportQuality * 100)}%<input autoComplete="off" type="range" min={10} max={100} step={1} value={Math.round(exportQuality * 100)} disabled={type === "image/png"} className="range range-primary range-xs w-full" onChange={(event) => setExportQuality(Number(event.currentTarget.value) / 100)} /></label>
            </fieldset>
            <p className="col-span-full text-xs text-base-content/60">El ancho y alto conservan la proporción del recorte. Máximo 4096 px por lado, sin ampliar el original. JPEG usa fondo blanco; PNG conserva su calidad.</p>
            {phase === "uploading" && <div role="status" className="col-span-full space-y-1 text-sm"><p>Procesando y subiendo imagen… {progress}%</p><progress className="progress progress-primary w-full" value={progress} max={100} aria-label="Progreso de subida" /></div>}
            {fieldState.error?.type === "fieldImage" && <p role="alert" className="alert alert-error alert-soft col-span-full text-sm">{fieldState.error.message}</p>}
            <button type="button" className="btn btn-primary col-span-full w-full" disabled={locked || busy} onClick={() => void confirmUpload()}>{busy && <span className="loading loading-spinner loading-xs" />}{phase === "uploading" ? "Subiendo…" : "Aplicar y subir imagen"}</button>
          </div>
    );
  }

  const description = [describedBy, hintId, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ");
  const reading = phase === "loading" && <div className="space-y-2"><p role="status" className="flex items-center gap-2 text-sm"><span className="loading loading-spinner loading-xs" />Leyendo imagen…</p>{!draft && <button type="button" className="btn btn-ghost btn-sm" disabled={locked} onClick={() => cancel()}>Cancelar lectura</button>}</div>;
  return (
    <div data-form-field={name} className={fieldDirectionClassName(direction, fieldLabel)}>
      {fieldLabel && <label id={labelId} htmlFor={inputId} className={fieldLabelClassName(direction)}>{fieldLabel}</label>}
      <div
        {...containerProps}
        role="group" aria-label={ariaLabel || (!fieldLabel ? name : undefined)} aria-labelledby={!ariaLabel && fieldLabel ? labelId : undefined}
        aria-describedby={description} data-invalid={fieldState.invalid} data-image-shape={shape ?? "rounded"} aria-busy={busy} aria-disabled={fieldDisabled}
        className={`min-w-0 ${isAvatar ? "" : "space-y-3"} ${className}`}
        onFocus={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onFocus?.(event); }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !document.getElementById(modalId)?.contains(event.relatedTarget)) { blurField(); onBlur?.(event); } }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); if (locked || busy) return; if (event.dataTransfer.files.length > 1) report(new Error("Selecciona una sola imagen.")); else void select(event.dataTransfer.files[0]); }}
      >
        <input ref={fileInput} type="file" accept={IMAGE_ACCEPT} autoComplete="off" hidden disabled={locked || busy} aria-label={`Archivo para ${accessibleLabel}`} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void select(file); }} />
        {isAvatar ? (
          <div className="relative w-fit max-w-full p-1">
            <div className={`avatar ${currentUrl ? "" : "avatar-placeholder"}`}>
              <div className={`size-24 ${avatarShape} bg-base-200 text-base-content/50 ring-2 ring-base-content/15 ring-offset-2 ring-offset-base-100 transition-shadow hover:ring-primary/50 focus-within:ring-primary focus-within:ring-offset-4`}>
                <button
                  ref={node => { fieldRef(node); selectButton.current = node; }}
                  id={inputId} type="button" disabled={locked || busy}
                  aria-label={`${currentUrl ? "Cambiar" : "Seleccionar"} ${accessibleLabel}`}
                  aria-describedby={description} title={currentUrl ? "Cambiar avatar" : "Seleccionar avatar"}
                  className={`group/avatar relative flex size-full cursor-pointer items-center justify-center overflow-hidden ${avatarShape} outline-none disabled:cursor-not-allowed disabled:opacity-45`}
                  onClick={() => fileInput.current?.click()}
                >
                  {currentUrl ? <Image unoptimized loading="eager" src={currentUrl} width={256} height={256} alt="" /> : <UserRound aria-hidden="true" className="size-10" />}
                  <span aria-hidden="true" className={`pointer-events-none absolute inset-0 flex items-center justify-center ${avatarShape} bg-base-content/50 text-base-100 opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100 group-disabled/avatar:hidden motion-reduce:transition-none`}><Camera size={24} /></span>
                </button>
              </div>
            </div>
            {currentUrl && (
              <button type="button" disabled={locked || busy} aria-label="Quitar avatar" title="Quitar avatar"
                className="btn btn-circle btn-sm absolute right-0 bottom-0 border-base-300 bg-base-100 text-base-content/65 shadow-sm hover:border-error/30 hover:bg-error/10 hover:text-error"
                onClick={remove}
              ><Trash2 size={16} aria-hidden="true" /></button>
            )}
            <p id={hintId} className="sr-only">Haz clic en el avatar para seleccionar o cambiar la imagen. JPEG, PNG o WebP, hasta {maxSizeMB} MB. Usa la papelera para quitarlo.</p>
          </div>
        ) : (
        <div className={`flex min-w-0 flex-col items-center gap-3 ${imageShape} border border-dashed border-base-content/25 bg-base-200/50 p-4 text-center`}>
          {currentUrl ? <Image unoptimized loading="eager" src={currentUrl} width={640} height={480} alt={accessibleLabel} className={`h-36 w-full ${imageShape} object-contain`} /> : <ImagePlus aria-hidden="true" className="size-9 text-base-content/40" />}
          <div className="flex flex-wrap justify-center gap-2">
            <button ref={node => { fieldRef(node); selectButton.current = node; }} id={inputId} type="button" disabled={locked || busy} className="btn btn-soft btn-sm" aria-describedby={description} onClick={() => fileInput.current?.click()}><Upload aria-hidden="true" size={16} />{currentUrl ? "Cambiar imagen" : "Seleccionar imagen"}</button>
            {currentUrl && <button type="button" disabled={locked || busy} className="btn btn-ghost btn-sm" onClick={remove}><X aria-hidden="true" size={16} />Quitar imagen</button>}
          </div>
          <p id={hintId} className="text-xs text-base-content/60">Arrastra una imagen o selecciónala. JPEG, PNG o WebP · Hasta {maxSizeMB} MB.</p>
        </div>
        )}
        {isAvatar ? phase !== "idle" && (
          <ImageEditorModal id={modalId} onCancel={() => cancel()} onAfterClose={restoreFocus}>
            {reading}
            {editor()}
          </ImageEditorModal>
        ) : <>{reading}{editor()}</>}
        {currentUrl && !isAvatar && <a href={currentUrl} target="_blank" rel="noreferrer" className="link text-xs text-base-content/60">Abrir imagen alojada</a>}
        {fieldState.invalid && <span id={errorId} className="sr-only">{fieldState.error?.message || "La imagen no es válida."}</span>}
      </div>
    </div>
  );
}
