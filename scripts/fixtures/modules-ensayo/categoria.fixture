import "server-only";
import { Fields, Model } from "@/lib/orm";

export class Categoria extends Model {
  name = Fields.Text({ label: "Nombre", required: true, maxLength: 80, tracking: true });
  active = Fields.Boolean({ label: "Activa", default: true });
}
