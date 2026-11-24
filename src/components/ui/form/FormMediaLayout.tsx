"use client";

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { useInsertionAnchor } from "./insertions/Insertions";

export type FormMediaLayoutProps = ComponentPropsWithoutRef<"div"> & {
  media: ReactNode;
  position?: "left" | "right";
  /** Width of the media column; numbers are pixels. Does not resize its content. */
  mediaWidth?: CSSProperties["width"];
};

/** Media beside Fields from 32rem of available width; stacked below that. */
export default function FormMediaLayout({
  media, children, position = "left", mediaWidth = "auto", className = "", style, ...props
}: FormMediaLayoutProps) {
  const anchor = useInsertionAnchor(props.id ? `media:${props.id}` : undefined);
  const layoutStyle = {
    "--form-media-width": typeof mediaWidth === "number" ? `${mediaWidth}px` : mediaWidth,
    ...style,
  } as CSSProperties;

  return anchor.wrap(
    <div {...props} style={layoutStyle} className={`@container/form-media w-full min-w-0 ${className}`}>
      <div className={`grid min-w-0 grid-cols-1 items-start gap-[var(--form-layout-gap,1rem)] ${position === "right"
        ? "@lg/form-media:grid-cols-[minmax(0,1fr)_minmax(0,var(--form-media-width))]"
        : "@lg/form-media:grid-cols-[minmax(0,var(--form-media-width))_minmax(0,1fr)]"}`}>
        <div className={`min-w-0 max-w-full ${position === "right" ? "@lg/form-media:order-2" : ""}`}>
          {media}
        </div>
        <div className="flex min-w-0 flex-col gap-[var(--form-layout-gap,1rem)]">
          {children}
          {anchor.inside}
        </div>
      </div>
    </div>
  );
}
