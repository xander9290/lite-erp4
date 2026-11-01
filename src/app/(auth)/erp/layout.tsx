import { ReactNode } from "react";

export default function LayoutErp({ children }: { children: ReactNode }) {
  return <div className="flex-1">{children}</div>;
}
