import type { ReactNode } from "react";
import ApplicationLayout from "@/components/ui/ApplicationLayout";
import { contactsManifest } from "./manifest";

export default function ContactsLayout({ children }: { children: ReactNode }) {
  return <ApplicationLayout applicationId={contactsManifest.id}>{children}</ApplicationLayout>;
}
