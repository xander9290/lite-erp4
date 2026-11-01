"use client";

import { Toaster } from "react-hot-toast";

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        style: {
          background: "var(--color-base-100)",
          color: "var(--color-base-content)",
          border: "1px solid var(--color-base-300)",
          borderRadius: "var(--radius-box)",
          maxWidth: "min(28rem, calc(100vw - 2rem))",
          overflowWrap: "anywhere",
          fontSize: "0.875rem",
        },
        error: {
          iconTheme: {
            primary: "var(--color-error)",
            secondary: "var(--color-error-content)",
          },
        },
      }}
    />
  );
}
