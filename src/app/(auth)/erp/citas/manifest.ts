import { CalendarDays } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

export const appointmentsManifest = defineApplication({
  id: "citas",
  name: "Citas odontológicas",
  description: "Agenda y seguimiento de citas del consultorio.",
  version: "0.1.0",
  icon: CalendarDays,
  depends: ["contactos"],
  access: "admin",
  models: ["DentalAppointment", "DentalTreatment"],
});
